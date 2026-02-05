import https from 'https';
import * as core from '@actions/core';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const REQUEST_TIMEOUT_MS = 30000;

/**
 * Make an HTTPS request with retry logic
 */
export async function slackRequest(method, path, token, body = null) {
  let lastError;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await makeRequest(method, path, token, body);

      if (result.ok) {
        return result;
      }

      // Don't retry on non-retryable errors - throw immediately
      if (!isRetryableError(result.error)) {
        throw new Error(`Slack API error: ${result.error}`);
      }

      lastError = new Error(`Slack API error: ${result.error}`);
      core.info(`Attempt ${attempt} failed with ${result.error}, retrying...`);
    } catch (error) {
      // If it's a non-retryable Slack error, re-throw immediately
      if (error.message.includes('Slack API error:') && !error.message.includes('rate_limited') && 
          !error.message.includes('service_unavailable') && !error.message.includes('internal_error') &&
          !error.message.includes('request_timeout')) {
        throw error;
      }
      
      lastError = error;
      if (attempt === MAX_RETRIES) {
        throw error;
      }
      core.info(`Attempt ${attempt} failed: ${error.message}, retrying...`);
    }

    // Wait before retrying
    await sleep(RETRY_DELAY_MS);
  }
  
  throw lastError;
}

export function isRetryableError(error) {
  const retryableErrors = [
    'rate_limited',
    'service_unavailable',
    'internal_error',
    'request_timeout',
  ];

  return retryableErrors.includes(error);
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeRequest(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'slack.com',
      port: 443,
      path: `/api/${path}`,
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (_e) {
          reject(new Error(`Failed to parse Slack response`));
        }
      });
    });

    req.on('error', reject);

    // Add timeout to prevent hanging requests
    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

/**
 * Search for existing message by repo and branch
 */
export async function searchExistingMessage({ userToken, channel, repo, branchName }) {
  // Calculate 30 days ago
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

  const query = encodeURIComponent(
    `in:#${channel} "${repo}" "${branchName}" after:${dateStr}`
  );

  const response = await slackRequest(
    'POST',
    `search.messages?query=${query}&count=10&sort=timestamp`,
    userToken
  );

  if (!response.ok || !response.messages?.matches?.[0]) {
    return null;
  }

  const match = response.messages.matches[0];

  return {
    ts: match.ts,
    channelId: match.channel.id,
    text: match.text,
  };
}

/**
 * Update an existing message
 */
export async function updateMessage({
  botToken,
  channelId,
  messageTs,
  currentText,
  stagingUrl,
}) {
  let updatedText = currentText;

  // Replace staging URL (show only latest)
  if (stagingUrl) {
    // Remove existing staging URL section
    updatedText = updatedText.replace(
      /\*Staging URLs?:\*[^\n]*(\n- [^\n]+)*/g,
      ''
    );
    // Add new staging URL
    updatedText = updatedText.trim() + `\n*Staging URL:* <${stagingUrl}|${stagingUrl}>`;
  }

  return slackRequest('POST', 'chat.update', botToken, {
    channel: channelId,
    ts: messageTs,
    text: updatedText,
  });
}

/**
 * Post a new message
 */
export async function postMessage({
  botToken,
  channel,
  repo,
  network,
  branchName,
  description,
  stagingUrl,
  author,
}) {
  let text = `*${repo}* - Staging Deployment (${network})\n\n`;
  text += `*Branch:* \`${branchName}\`\n`;
  text += `*Description:* ${description}\n`;
  text += `*Staging URL:* <${stagingUrl}|${stagingUrl}>\n`;
  text += `*Author:* ${author}`;

  const response = await slackRequest('POST', 'chat.postMessage', botToken, {
    channel: `#${channel}`,
    text,
  });

  return {
    ts: response.ts,
    channelId: response.channel,
    text,
  };
}

/**
 * Post a thread reply
 */
export async function postThreadReply({
  botToken,
  channel,
  threadTs,
  network,
  description,
  stagingUrl,
  author,
}) {
  let text = `🔄 *New staging link deployed (${network})*\n`;
  text += `*Description:* ${description}\n`;
  text += `*Staging URL:* <${stagingUrl}|${stagingUrl}>\n`;
  text += `*Author:* ${author}`;

  return slackRequest('POST', 'chat.postMessage', botToken, {
    channel: `#${channel}`,
    thread_ts: threadTs,
    text,
  });
}

/**
 * Add Message ID to a message
 */
export async function addMessageId({ botToken, channelId, messageTs, originalText }) {
  const updatedText = `${originalText}\n*Message ID:* \`${messageTs}\``;

  return slackRequest('POST', 'chat.update', botToken, {
    channel: channelId,
    ts: messageTs,
    text: updatedText,
  });
}
