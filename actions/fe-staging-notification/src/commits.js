import { readFileSync } from 'fs';
import * as core from '@actions/core';

/**
 * Get commit messages from GitHub event payload
 * For push events: returns commits[].message
 * For PR events: returns [pull_request.title, pull_request.body]
 * Returns empty array on failure
 */
export function getCommitMessages() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    return [];
  }

  try {
    const eventData = JSON.parse(readFileSync(eventPath, 'utf8'));

    // Push event - commits array
    if (eventData.commits && Array.isArray(eventData.commits)) {
      return eventData.commits
        .map((c) => c.message)
        .filter(Boolean);
    }

    // PR event - title and body
    if (eventData.pull_request) {
      return [
        eventData.pull_request.title,
        eventData.pull_request.body,
      ].filter(Boolean);
    }

    return [];
  } catch (_error) {
    core.info('Could not read commit messages from event payload');

    return [];
  }
}
