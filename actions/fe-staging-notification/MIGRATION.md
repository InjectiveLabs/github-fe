# fe-staging-notification JavaScript Migration Guide

This document outlines the plan to migrate `fe-staging-notification` from a bash-based composite action to a JavaScript-based GitHub Action.

## Why Migrate?

1. **Readability**: The current bash script is 542 lines with complex string manipulation
2. **Maintainability**: JavaScript is easier to debug, test, and extend
3. **Error handling**: Better try/catch patterns vs bash error handling
4. **Portability**: No issues with platform-specific commands (e.g., `base64 -w 0`)
5. **Testing**: Can use Vitest for fast, reliable tests with pre-commit hooks

## Current Architecture

```
fe-staging-notification/
└── action.yml              # 542 lines of bash
```

## Target Architecture

```
fe-staging-notification/
├── action.yml              # Thin wrapper (< 30 lines)
├── action.bash.yml         # Backup of original bash version (for rollback)
├── package.json
├── vitest.config.js
├── src/
│   ├── index.js            # Main entry point
│   ├── slack.js            # Slack API helpers
│   ├── jira.js             # Jira ticket extraction
│   └── git.js              # Git operations
├── dist/
│   └── index.js            # Bundled output (auto-generated)
└── __tests__/
    ├── slack.test.js
    ├── jira.test.js
    └── git.test.js
```

---

## Migration Strategy (Zero Downtime)

### Phase 1: Preparation (No Production Impact)

1. Create all JS files alongside existing bash action
2. Keep `action.yml` unchanged (still using bash)
3. Build and test JS version locally
4. Run JS version in a test workflow on a non-critical branch

### Phase 2: Shadow Testing

1. Create a separate `action-js.yml` that uses the JS version
2. Run BOTH actions in parallel on staging deployments for 1-2 weeks
3. Compare outputs to ensure parity
4. Fix any discrepancies

### Phase 3: Cutover

1. Backup current `action.yml` to `action.bash.yml`
2. Replace `action.yml` with JS version
3. Monitor for 24-48 hours
4. Keep `action.bash.yml` for quick rollback if needed

### Phase 4: Cleanup

1. After 1-2 weeks of stable operation, remove `action.bash.yml`
2. Document any lessons learned

---

## Step-by-Step Implementation

### Step 1: Initialize the Project

```bash
cd actions/fe-staging-notification
npm init -y
npm install @actions/core @actions/exec
npm install -D @vercel/ncc vitest husky lint-staged
```

### Step 2: Update package.json

```json
{
  "name": "fe-staging-notification",
  "version": "1.0.0",
  "description": "Extract Jira tickets and send Slack notifications for deployments",
  "main": "src/index.js",
  "type": "module",
  "scripts": {
    "build": "ncc build src/index.js -o dist",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "prepare": "cd ../.. && husky actions/fe-staging-notification/.husky",
    "lint-staged": "lint-staged"
  },
  "lint-staged": {
    "src/**/*.js": [
      "vitest related --run"
    ]
  },
  "dependencies": {
    "@actions/core": "^1.10.0",
    "@actions/exec": "^1.1.1"
  },
  "devDependencies": {
    "@vercel/ncc": "^0.38.1",
    "vitest": "^2.0.0",
    "husky": "^9.0.0",
    "lint-staged": "^15.0.0"
  }
}
```

### Step 3: Configure Vitest

Create `vitest.config.js`:

```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.js'],
      exclude: ['src/index.js'], // Entry point is hard to unit test
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
```

### Step 4: Setup Husky Pre-commit Hook

```bash
# Initialize husky
npx husky init

# Create pre-commit hook
```

Create `.husky/pre-commit`:

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

cd actions/fe-staging-notification

# Run tests for changed files
npx lint-staged

# Ensure build is up to date
npm run build

# Check if dist/index.js changed and needs to be staged
if git diff --name-only | grep -q "dist/index.js"; then
  echo "dist/index.js was updated, staging it..."
  git add dist/index.js
fi
```

### Step 5: Create src/index.js (Main Entry Point)

```javascript
import * as core from '@actions/core';
import { getBranchName } from './git.js';
import { extractJiraTickets, generateJiraLinks } from './jira.js';
import {
  searchExistingMessage,
  updateMessage,
  postMessage,
  postThreadReply,
  addMessageId,
} from './slack.js';

async function run() {
  try {
    // Get inputs
    const inputs = {
      repo: core.getInput('repo', { required: true }),
      network: core.getInput('network', { required: true }),
      description: core.getInput('description') || 'Frontend deployment',
      slackUserToken: core.getInput('slack-user-token', { required: true }),
      slackBotToken: core.getInput('slack-bot-token', { required: true }),
      stagingUrl: core.getInput('staging_url', { required: true }),
      slackChannel: core.getInput('slack-channel') || 'frontend-staging',
    };

    // Step 1: Get branch name
    const branchName = getBranchName();
    core.setOutput('branch_name', branchName);
    core.info(`Branch: ${branchName}`);

    // Step 2: Extract Jira tickets
    const jiraTickets = await extractJiraTickets();
    const jiraLinks = generateJiraLinks(jiraTickets);
    core.setOutput('jira_tickets', jiraTickets.join(', '));
    core.setOutput('jira_links', jiraLinks);
    core.info(`Jira tickets: ${jiraTickets.join(', ') || 'none'}`);

    // Step 3: Search for existing Slack message
    const existingMessage = await searchExistingMessage({
      userToken: inputs.slackUserToken,
      channel: inputs.slackChannel,
      repo: inputs.repo,
      branchName,
    });

    core.setOutput('message_found', existingMessage ? 'true' : 'false');

    let messageTs;

    if (existingMessage) {
      // Update existing message and post thread reply
      core.info(`Found existing message: ${existingMessage.ts}`);
      core.setOutput('existing_message_ts', existingMessage.ts);

      // Update main message with latest staging URL
      await updateMessage({
        botToken: inputs.slackBotToken,
        channelId: existingMessage.channelId,
        messageTs: existingMessage.ts,
        currentText: existingMessage.text,
        stagingUrl: inputs.stagingUrl,
        newJiraTickets: jiraTickets,
        existingJiraTickets: existingMessage.jiraTickets,
      });

      // Post thread reply
      await postThreadReply({
        botToken: inputs.slackBotToken,
        channel: inputs.slackChannel,
        threadTs: existingMessage.ts,
        network: inputs.network,
        description: inputs.description,
        stagingUrl: inputs.stagingUrl,
        author: process.env.GITHUB_ACTOR,
      });

      messageTs = existingMessage.ts;
    } else {
      // Create new message
      core.info('Creating new message');

      const result = await postMessage({
        botToken: inputs.slackBotToken,
        channel: inputs.slackChannel,
        repo: inputs.repo,
        network: inputs.network,
        branchName,
        description: inputs.description,
        stagingUrl: inputs.stagingUrl,
        author: process.env.GITHUB_ACTOR,
        jiraLinks,
      });

      messageTs = result.ts;

      // Update message to include the Message ID
      if (messageTs) {
        await addMessageId({
          botToken: inputs.slackBotToken,
          channelId: result.channelId,
          messageTs,
          originalText: result.text,
        });
      }
    }

    core.setOutput('message_ts', messageTs);
    core.info('Slack notification completed successfully');
  } catch (error) {
    // Don't fail the action, just log the error
    core.warning(`Slack notification failed: ${error.message}`);
    core.info('Continuing despite notification failure...');
  }
}

run();
```

### Step 6: Create src/slack.js

```javascript
import https from 'https';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

/**
 * Make an HTTPS request with retry logic
 */
export async function slackRequest(method, path, token, body = null) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await makeRequest(method, path, token, body);

      if (result.ok) {
        return result;
      }

      // Don't retry on non-retryable errors
      if (!isRetryableError(result.error)) {
        throw new Error(`Slack API error: ${result.error}`);
      }

      console.log(`Attempt ${attempt} failed with ${result.error}, retrying...`);
    } catch (error) {
      if (attempt === MAX_RETRIES) {
        throw error;
      }
      console.log(`Attempt ${attempt} failed: ${error.message}, retrying...`);
    }

    // Wait before retrying
    await sleep(RETRY_DELAY_MS);
  }
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
  let text = `New staging link deployed (${network})\n`;
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
```

### Step 7: Create src/jira.js

```javascript
import { exec } from '@actions/exec';

export const JIRA_BASE_URL = 'https://injective-labs.atlassian.net/browse';
export const JIRA_PATTERN = /IL-\d{3,5}/gi;

/**
 * Extract Jira tickets from git commit messages
 */
export async function extractJiraTickets() {
  // Fetch origin/dev for comparison
  try {
    await exec('git', ['fetch', 'origin', 'dev'], { silent: true });
  } catch (error) {
    console.log('Could not fetch origin/dev, proceeding with local reference');
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
  } catch (error) {
    console.log('No commits found');
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
```

### Step 8: Create src/git.js

```javascript
/**
 * Get the branch name from GitHub context
 */
export function getBranchName() {
  // From workflow_dispatch input (GitHub converts input names to INPUT_<NAME>)
  const branch =
    process.env.INPUT_BRANCH ||
    process.env.GITHUB_HEAD_REF ||
    process.env.GITHUB_REF_NAME;

  if (!branch) {
    throw new Error('Could not determine branch name');
  }

  return branch;
}
```

### Step 9: Create Tests

Create `__tests__/jira.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { generateJiraLinks, JIRA_BASE_URL, JIRA_PATTERN } from '../src/jira.js';

describe('jira', () => {
  describe('generateJiraLinks', () => {
    it('should return empty string for empty array', () => {
      expect(generateJiraLinks([])).toBe('');
    });

    it('should return empty string for null', () => {
      expect(generateJiraLinks(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(generateJiraLinks(undefined)).toBe('');
    });

    it('should generate single link', () => {
      const result = generateJiraLinks(['IL-1234']);
      expect(result).toBe(`<${JIRA_BASE_URL}/IL-1234|IL-1234>`);
    });

    it('should generate multiple links', () => {
      const result = generateJiraLinks(['IL-1234', 'IL-5678']);
      expect(result).toBe(
        `<${JIRA_BASE_URL}/IL-1234|IL-1234>, <${JIRA_BASE_URL}/IL-5678|IL-5678>`
      );
    });

    it('should handle tickets with different digit lengths', () => {
      const result = generateJiraLinks(['IL-123', 'IL-12345']);
      expect(result).toContain('IL-123');
      expect(result).toContain('IL-12345');
    });
  });

  describe('JIRA_PATTERN', () => {
    it('should match IL- followed by 3-5 digits', () => {
      expect('IL-123'.match(JIRA_PATTERN)).toEqual(['IL-123']);
      expect('IL-1234'.match(JIRA_PATTERN)).toEqual(['IL-1234']);
      expect('IL-12345'.match(JIRA_PATTERN)).toEqual(['IL-12345']);
    });

    it('should be case insensitive', () => {
      expect('il-1234'.match(JIRA_PATTERN)).toEqual(['il-1234']);
      expect('Il-1234'.match(JIRA_PATTERN)).toEqual(['Il-1234']);
    });

    it('should not match IL- with less than 3 digits', () => {
      expect('IL-12'.match(JIRA_PATTERN)).toBeNull();
    });

    it('should not match IL- with more than 5 digits', () => {
      // It will match the first 5 digits
      const match = 'IL-123456'.match(JIRA_PATTERN);
      expect(match[0]).toBe('IL-12345');
    });

    it('should find multiple tickets in text', () => {
      const text = 'Working on IL-1234 and IL-5678';
      expect(text.match(JIRA_PATTERN)).toEqual(['IL-1234', 'IL-5678']);
    });
  });
});
```

Create `__tests__/slack.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  extractJiraFromText,
  isRetryableError,
  sleep,
} from '../src/slack.js';

describe('slack', () => {
  describe('extractJiraFromText', () => {
    it('should extract tickets from text', () => {
      const text = 'Working on IL-1234 and IL-5678';
      expect(extractJiraFromText(text)).toEqual(['IL-1234', 'IL-5678']);
    });

    it('should handle lowercase', () => {
      const text = 'Working on il-1234';
      expect(extractJiraFromText(text)).toEqual(['IL-1234']);
    });

    it('should deduplicate', () => {
      const text = 'IL-1234 and IL-1234 again';
      expect(extractJiraFromText(text)).toEqual(['IL-1234']);
    });

    it('should return empty array for no matches', () => {
      const text = 'No tickets here';
      expect(extractJiraFromText(text)).toEqual([]);
    });

    it('should handle empty string', () => {
      expect(extractJiraFromText('')).toEqual([]);
    });

    it('should handle Slack link format', () => {
      const text = 'Jira tickets: <https://injective-labs.atlassian.net/browse/IL-1234|IL-1234>';
      expect(extractJiraFromText(text)).toEqual(['IL-1234']);
    });

    it('should extract tickets from multi-line text', () => {
      const text = `Branch: feat/IL-1234-new-feature
Description: Working on IL-5678
Jira tickets: IL-9999`;
      expect(extractJiraFromText(text)).toEqual(['IL-1234', 'IL-5678', 'IL-9999']);
    });
  });

  describe('isRetryableError', () => {
    it('should return true for rate_limited', () => {
      expect(isRetryableError('rate_limited')).toBe(true);
    });

    it('should return true for service_unavailable', () => {
      expect(isRetryableError('service_unavailable')).toBe(true);
    });

    it('should return true for internal_error', () => {
      expect(isRetryableError('internal_error')).toBe(true);
    });

    it('should return true for request_timeout', () => {
      expect(isRetryableError('request_timeout')).toBe(true);
    });

    it('should return false for channel_not_found', () => {
      expect(isRetryableError('channel_not_found')).toBe(false);
    });

    it('should return false for invalid_auth', () => {
      expect(isRetryableError('invalid_auth')).toBe(false);
    });

    it('should return false for unknown errors', () => {
      expect(isRetryableError('some_random_error')).toBe(false);
    });
  });

  describe('sleep', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should resolve after specified time', async () => {
      const promise = sleep(1000);
      vi.advanceTimersByTime(1000);
      await expect(promise).resolves.toBeUndefined();
    });
  });
});
```

Create `__tests__/git.test.js`:

```javascript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getBranchName } from '../src/git.js';

describe('git', () => {
  describe('getBranchName', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
      // Clear all branch-related env vars
      delete process.env.INPUT_BRANCH;
      delete process.env.GITHUB_HEAD_REF;
      delete process.env.GITHUB_REF_NAME;
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should return INPUT_BRANCH if set', () => {
      process.env.INPUT_BRANCH = 'feat/test-branch';
      expect(getBranchName()).toBe('feat/test-branch');
    });

    it('should return GITHUB_HEAD_REF if INPUT_BRANCH not set', () => {
      process.env.GITHUB_HEAD_REF = 'feat/pr-branch';
      expect(getBranchName()).toBe('feat/pr-branch');
    });

    it('should return GITHUB_REF_NAME if others not set', () => {
      process.env.GITHUB_REF_NAME = 'main';
      expect(getBranchName()).toBe('main');
    });

    it('should prefer INPUT_BRANCH over others', () => {
      process.env.INPUT_BRANCH = 'input-branch';
      process.env.GITHUB_HEAD_REF = 'head-ref';
      process.env.GITHUB_REF_NAME = 'ref-name';
      expect(getBranchName()).toBe('input-branch');
    });

    it('should throw error if no branch env var is set', () => {
      expect(() => getBranchName()).toThrow('Could not determine branch name');
    });
  });
});
```

### Step 10: Update action.yml for JS

```yaml
name: "Deployment Notification"
description: "Extract Jira tickets and send Slack notifications for deployments"

inputs:
  repo:
    description: "Repository name (e.g., Mito, Injective)"
    required: true
  network:
    description: "Network name for the deployment"
    required: true
  description:
    description: "Description of the deployment"
    required: false
    default: "Frontend deployment"
  slack-user-token:
    description: "Slack user token for reading messages"
    required: true
  slack-bot-token:
    description: "Slack bot token for sending messages"
    required: true
  staging_url:
    description: "URL of the staging deployment"
    required: true
  slack-channel:
    description: "Slack channel name for notifications"
    required: false
    default: "frontend-staging"

outputs:
  branch_name:
    description: "The branch name that was deployed"
  jira_tickets:
    description: "Comma-separated list of Jira tickets found"
  jira_links:
    description: "Formatted Jira links for Slack"
  message_found:
    description: "Whether an existing Slack message was found"
  existing_message_ts:
    description: "Timestamp of existing Slack message if found"
  message_ts:
    description: "Timestamp of the Slack message (either existing or newly created)"

runs:
  using: "node20"
  main: "dist/index.js"
```

---

## Build and Test Commands

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run tests in watch mode (during development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Build the bundle (required before committing)
npm run build
```

---

## Pre-commit Validation with Husky

The pre-commit hook ensures:

1. **Tests pass** for any changed source files
2. **Build is up to date** - regenerates `dist/index.js` if needed
3. **dist/index.js is staged** if it was updated

This prevents pushing code that:
- Breaks existing functionality
- Has outdated bundled code
- Fails tests

### How it works:

```
Developer modifies src/slack.js
    ↓
git commit
    ↓
Husky pre-commit hook runs
    ↓
lint-staged runs vitest for related test files
    ↓
If tests pass → npm run build
    ↓
If dist/index.js changed → auto-stage it
    ↓
Commit proceeds
```

---

## Rollback Plan

If issues arise in production:

### Quick Rollback (< 5 minutes)

```bash
# Restore the bash version
cp action.bash.yml action.yml
git add action.yml
git commit -m "revert: rollback to bash action"
git push
```

### The backup file `action.bash.yml` contains the original 542-line bash implementation.

---

## Testing Checklist

Before deploying to production, verify:

- [ ] All unit tests pass (`npm test`)
- [ ] Coverage meets thresholds (`npm run test:coverage`)
- [ ] Build succeeds (`npm run build`)
- [ ] Manual test: New message creation works
- [ ] Manual test: Thread reply works
- [ ] Manual test: Message update (staging URL replacement) works
- [ ] Manual test: Jira ticket extraction works
- [ ] Manual test: Message ID is added to new messages
- [ ] Shadow test: Run both bash and JS versions in parallel for 1 week

---

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| @actions/core | ^1.10.0 | GitHub Actions input/output handling |
| @actions/exec | ^1.1.1 | Git command execution |
| @vercel/ncc | ^0.38.1 | Bundle into single file |
| vitest | ^2.0.0 | Fast testing framework |
| husky | ^9.0.0 | Git hooks |
| lint-staged | ^15.0.0 | Run tests on staged files |

---

## Key Improvements in JS Version

1. **Retry logic**: Built-in 3-retry mechanism with 2-second delays for Slack API calls
2. **Better error handling**: Try/catch blocks with proper error messages
3. **Testable**: Comprehensive unit tests with 80%+ coverage requirement
4. **Pre-commit validation**: Husky ensures tests pass before every commit
5. **No platform issues**: No `base64 -w 0` or other platform-specific commands
6. **Cleaner code**: ~300 lines vs 542 lines of bash
7. **Type safety potential**: Can easily migrate to TypeScript later
