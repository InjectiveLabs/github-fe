/**
 * Slack notification utilities for production deployments
 */

import { convertMarkdownToSlack } from '../../shared/src/formatting.js';

/**
 * Build the Slack message payload for a production deployment
 * 
 * @param {Object} options
 * @param {string} options.projectName - Name of the project being deployed
 * @param {string} options.releaseNotes - Release notes (markdown formatted)
 * @param {string} options.repoUrl - GitHub repository URL
 * @param {string} options.runId - GitHub Actions run ID
 * @returns {Object} - Slack message payload
 */
export function buildDeploymentPayload({ projectName, releaseNotes, repoUrl, runId }) {
  const runUrl = `${repoUrl}/actions/runs/${runId}`;
  const hasNewCommits = releaseNotes && releaseNotes !== 'No new commits';
  
  if (hasNewCommits) {
    const slackFormattedNotes = convertMarkdownToSlack(releaseNotes);
    
    const text = [
      `<!here> :rocket: ${projectName} deployed to Mainnet!`,
      `View the deployment results on Github: <${runUrl}>.`,
      'The commits deployed are:',
      slackFormattedNotes,
    ].join('\n');
    
    return {
      text,
      attachments: [
        {
          text: `${projectName} deployed to Mainnet :white_check_mark:`,
          color: '#22bb33',
        },
      ],
    };
  } else {
    return {
      text: `<!here> :rocket: ${projectName} Rebuilt on Mainnet! Good guys, close your eyes! :hammer_and_wrench::smile:`,
      attachments: [
        {
          text: `View the deployment results on Github: <${runUrl}>.`,
          color: '#22bb33',
        },
      ],
    };
  }
}

/**
 * Validate that the URL is a valid Slack webhook URL
 * 
 * @param {string} url - URL to validate
 * @returns {boolean} - true if valid Slack webhook URL
 */
export function isValidSlackWebhookUrl(url) {
  try {
    const parsed = new URL(url);

    return parsed.protocol === 'https:' && parsed.hostname === 'hooks.slack.com';
  } catch {
    return false;
  }
}

/**
 * Send a message to Slack via webhook
 * 
 * @param {string} webhookUrl - Slack webhook URL
 * @param {Object} payload - Message payload
 * @returns {Promise<void>}
 */
export async function sendSlackNotification(webhookUrl, payload) {
  if (!isValidSlackWebhookUrl(webhookUrl)) {
    throw new Error('Invalid Slack webhook URL. Must be an HTTPS URL from hooks.slack.com');
  }
  
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Slack webhook failed: ${response.status} ${text}`);
  }
}

// Re-export for convenience
export { convertMarkdownToSlack };
