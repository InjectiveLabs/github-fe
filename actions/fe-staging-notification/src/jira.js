import { exec } from '@actions/exec';
import * as core from '@actions/core';

export const JIRA_BASE_URL = 'https://injective-labs.atlassian.net/browse';
export const JIRA_PATTERN = /IL-\d{3,5}/gi;

/**
 * Extract Jira tickets from git commit messages
 */
export async function extractJiraTickets() {
  // Fetch origin/dev for comparison
  try {
    await exec('git', ['fetch', 'origin', 'dev'], { silent: true });
  } catch (_error) {
    core.warning('Could not fetch origin/dev, proceeding with local reference');
  }

  // Get commit messages
  let commitMessages = '';
  try {
    await exec('git', ['log', 'origin/dev..HEAD', '--oneline'], {
      silent: true,
      listeners: {
        stdout: (data) => {
          commitMessages += data.toString();
        },
      },
    });
  } catch (_error) {
    core.info('No commits found');

    return [];
  }

  // Extract unique tickets
  const matches = commitMessages.match(JIRA_PATTERN) || [];
  const uniqueTickets = [...new Set(matches.map((t) => t.toUpperCase()))];

  return uniqueTickets;
}

/**
 * Generate Slack-formatted Jira links
 */
export function generateJiraLinks(tickets) {
  if (!tickets || tickets.length === 0) {
    return '';
  }

  return tickets.map((ticket) => `<${JIRA_BASE_URL}/${ticket}|${ticket}>`).join(', ');
}
