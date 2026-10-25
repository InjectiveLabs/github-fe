import https from 'https';
import * as core from '@actions/core';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const REQUEST_TIMEOUT_MS = 30000;
const MAX_TICKETS_PER_RUN = 20;

/**
 * Extract Linear ticket IDs from an array of text strings
 * Matches patterns like INJ-142, SEC-146, I-42, ILO-796
 */
export function extractLinearTickets(texts) {
  const pattern = /\b[A-Z]{1,5}-\d{1,5}\b/g;
  const tickets = new Set();

  for (const text of texts) {
    if (!text) {continue;}
    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches) {
        tickets.add(match);
      }
    }
  }

  const result = [...tickets];

  if (result.length > MAX_TICKETS_PER_RUN) {
    core.warning(
      `Found ${result.length} Linear tickets, capping at ${MAX_TICKETS_PER_RUN} to avoid rate limiting`
    );

    return result.slice(0, MAX_TICKETS_PER_RUN);
  }

  return result;
}

/**
 * Make a GraphQL request to Linear API with retry logic
 */
export async function linearRequest(query, variables, apiKey) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await makeLinearRequest(query, variables, apiKey);

      if (result.errors) {
        const errorMsg = result.errors.map((e) => e.message).join(', ');
        throw new Error(`Linear GraphQL error: ${errorMsg}`);
      }

      return result.data;
    } catch (error) {
      lastError = error;

      // Don't retry GraphQL or auth errors (non-transient)
      if (error.message.includes('Linear GraphQL error')) {
        throw error;
      }

      if (attempt === MAX_RETRIES) {
        throw error;
      }

      core.info(`Linear API attempt ${attempt} failed: ${error.message}, retrying...`);
      await sleep(RETRY_DELAY_MS);
    }
  }

  throw lastError;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeLinearRequest(query, variables, apiKey) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query, variables });

    const options = {
      hostname: 'api.linear.app',
      port: 443,
      path: '/graphql',
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (_e) {
          reject(new Error('Failed to parse Linear API response'));
        }
      });
    });

    req.on('error', reject);

    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error('Linear API request timeout'));
    });

    req.write(body);
    req.end();
  });
}

/**
 * Look up a Linear issue by its identifier (e.g., "INJ-142")
 * Returns { id, identifier, title, url } or null if not found
 */
export async function lookupIssue(ticketId, apiKey) {
  try {
    const data = await linearRequest(
      `query GetIssue($id: String!) {
        issue(id: $id) {
          id
          identifier
          title
          url
        }
      }`,
      { id: ticketId },
      apiKey
    );

    return data.issue || null;
  } catch (error) {
    core.warning(`Failed to look up Linear issue ${ticketId}: ${error.message}`);

    return null;
  }
}

/**
 * Post a comment on a Linear issue
 */
export async function postIssueComment(issueId, body, apiKey) {
  try {
    const data = await linearRequest(
      `mutation CreateComment($input: CommentCreateInput!) {
        commentCreate(input: $input) {
          success
          comment {
            id
          }
        }
      }`,
      { input: { issueId, body } },
      apiKey
    );

    return data.commentCreate?.success || false;
  } catch (error) {
    core.warning(`Failed to post comment on Linear issue: ${error.message}`);

    return false;
  }
}

/**
 * Format the comment body for a Linear issue
 */
export function formatLinearComment({ repo, branchName, stagingUrl, author }) {
  return [
    '**Staging Deployment**',
    `- **Repo:** ${repo}`,
    `- **Branch:** \`${branchName}\``,
    `- **Staging URL:** ${stagingUrl}`,
    `- **Author:** ${author}`,
  ].join('\n');
}
