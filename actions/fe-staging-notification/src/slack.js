import https from 'https';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

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
      console.log(`Attempt ${attempt} failed with ${result.error}, retrying...`);
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
      console.log(`Attempt ${attempt} failed: ${error.message}, retrying...`);
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
        } catch (e) {
          reject(new Error(`Failed to parse Slack response: ${data}`));
        }
      });
    });

    req.on('error', reject);

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

  // Fetch thread to get all Jira tickets
  const threadResponse = await slackRequest(
    'GET',
    `conversations.replies?channel=${match.channel.id}&ts=${match.ts}`,
    userToken
  );

  let allJiraTickets = [];
  if (threadResponse.ok && threadResponse.messages) {
    const allText = threadResponse.messages.map((m) => m.text).join(' ');
    allJiraTickets = extractJiraFromText(allText);
  }

  return {
    ts: match.ts,
    channelId: match.channel.id,
    text: threadResponse.messages?.[0]?.text || match.text,
    jiraTickets: allJiraTickets,
  };
}

/**
 * Extract Jira tickets from text
 */
export function extractJiraFromText(text) {
  const matches = text.match(/IL-\d{3,5}/gi) || [];
  return [...new Set(matches.map((t) => t.toUpperCase()))];
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
  newJiraTickets,
  existingJiraTickets,
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

  // Add new Jira tickets
  const ticketsToAdd = newJiraTickets.filter(
    (t) => !existingJiraTickets.includes(t)
  );

  if (ticketsToAdd.length > 0) {
    const newLinks = ticketsToAdd
      .map((t) => `<https://injective-labs.atlassian.net/browse/${t}|${t}>`)
      .join(', ');

    if (updatedText.includes('Jira tickets:')) {
      updatedText = updatedText.replace(
        /(\*Jira tickets:\* [^\n]*)/,
        `$1, ${newLinks}`
      );
    } else {
      updatedText += `\n*Jira tickets:* ${newLinks}`;
    }
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
  jiraLinks,
}) {
  let text = `*${repo}* - Staging Deployment (${network})\n\n`;
  text += `*Branch:* \`${branchName}\`\n`;
  text += `*Description:* ${description}\n`;
  text += `*Staging URL:* <${stagingUrl}|${stagingUrl}>\n`;
  text += `*Author:* ${author}`;

  if (jiraLinks) {
    text += `\n*Jira tickets:* ${jiraLinks}`;
  }

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
