# fe-staging-notification

A GitHub Action that extracts Jira tickets from commits and sends Slack notifications for frontend staging deployments.

## Features

- Extracts Jira tickets (IL-XXXXX) from commit messages
- Creates or updates Slack messages per branch
- Threads subsequent deployments to existing messages
- Replaces staging URL with latest (no accumulation)
- Deduplicates Jira tickets across the entire thread
- Non-fatal error handling (won't fail your CI)
- Built-in retry logic for Slack API calls

## Usage

```yaml
- uses: ./actions/fe-staging-notification
  with:
    repo: "Mito"
    network: "mainnet"
    staging_url: "https://staging.example.com"
    slack-user-token: ${{ secrets.SLACK_USER_TOKEN }}
    slack-bot-token: ${{ secrets.SLACK_BOT_TOKEN }}
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `repo` | Yes | - | Repository name (e.g., Mito, Injective) |
| `network` | Yes | - | Network name for the deployment |
| `branch` | No | Auto-detected | Branch name (auto-detected from workflow_dispatch) |
| `description` | No | "Frontend deployment" | Description of the deployment |
| `slack-user-token` | Yes | - | Slack user token for reading messages |
| `slack-bot-token` | Yes | - | Slack bot token for sending messages |
| `staging_url` | Yes | - | URL of the staging deployment |
| `slack-channel` | No | "frontend-staging" | Slack channel name |

## Outputs

| Output | Description |
|--------|-------------|
| `branch_name` | The branch name that was deployed |
| `jira_tickets` | Comma-separated list of Jira tickets found |
| `jira_links` | Formatted Jira links for Slack |
| `message_found` | Whether an existing Slack message was found |
| `existing_message_ts` | Timestamp of existing Slack message if found |
| `existing_channel_id` | Channel ID of existing Slack message if found |
| `existing_jira_tickets` | Jira tickets from existing Slack message |
| `channel_name` | Slack channel name used |
| `message_ts` | Timestamp of the Slack message |

## Slack Token Requirements

This action uses a **dual-token approach**:

| Token | Type | Required Scopes | Purpose |
|-------|------|-----------------|---------|
| `slack-user-token` | User (xoxp-) | `search:read` | Search for existing messages |
| `slack-bot-token` | Bot (xoxb-) | `chat:write`, `channels:read` | Post and update messages |

The user token is required because the Slack `search.messages` API only works with user tokens, not bot tokens.

---

## Project Structure

```
fe-staging-notification/
├── action.yml              # Action definition (node20)
├── action.bash.yml         # Backup of original bash version (for rollback)
├── package.json            # Dependencies and scripts
├── vitest.config.js        # Test configuration
│
├── src/                    # Source code
│   ├── index.js            # Main entry point - orchestrates the action
│   ├── git.js              # Branch name detection
│   ├── jira.js             # Jira ticket extraction from commits
│   └── slack.js            # Slack API helpers with retry logic
│
├── __tests__/              # Unit tests (Vitest)
│   ├── git.test.js
│   ├── jira.test.js
│   └── slack.test.js
│
├── dist/                   # Bundled output (auto-generated)
│   └── index.js            # Single-file bundle (~960KB)
│
├── .husky/                 # Git hooks
│   ├── _/husky.sh
│   └── pre-commit          # Runs tests + build before commit
│
├── coverage/               # Test coverage reports (gitignored)
├── node_modules/           # Dependencies (gitignored)
│
├── README.md               # This file
└── MIGRATION.md            # Migration guide from bash to JS
```

### Source Code Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        index.js                              │
│                    (Main Orchestrator)                       │
│                                                              │
│  1. Get inputs from action.yml                               │
│  2. Detect branch name                                       │
│  3. Extract Jira tickets from commits                        │
│  4. Search for existing Slack message                        │
│  5. Update existing OR create new message                    │
│  6. Set outputs                                              │
└─────────────────────────────────────────────────────────────┘
           │                │                │
           ▼                ▼                ▼
    ┌──────────┐     ┌──────────┐     ┌──────────┐
    │  git.js  │     │ jira.js  │     │ slack.js │
    └──────────┘     └──────────┘     └──────────┘
    
    getBranchName()   extractJiraTickets()   slackRequest()
    - INPUT_BRANCH    - git fetch origin/dev  - Retry logic (3x)
    - Event file      - git log               - Rate limiting
    - GITHUB_HEAD_REF - Pattern matching      
    - GITHUB_REF_NAME generateJiraLinks()    searchExistingMessage()
                      - Slack formatting      updateMessage()
                                              postMessage()
                                              postThreadReply()
                                              addMessageId()
```

### Key Design Decisions

1. **Dual Slack Tokens**: User token for search (API limitation), bot token for posting
2. **30-Day Search Limit**: Prevents finding stale messages from old deployments
3. **Thread-Based Deduplication**: Scans entire thread for Jira tickets, not just main message
4. **URL Replacement**: Shows only the latest staging URL (previous fix for URL accumulation)
5. **Non-Fatal Errors**: Logs warnings but never fails the CI pipeline
6. **Retry Logic**: 3 retries with 2-second delays for transient Slack errors

---

## Development

### Prerequisites

- Node.js 20+
- npm

### Setup

```bash
cd actions/fe-staging-notification
npm install
```

### Commands

| Command | Description |
|---------|-------------|
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run build` | Bundle source into dist/index.js |

### Pre-commit Hook

The `.husky/pre-commit` hook automatically:
1. Runs `lint-staged` (tests related files)
2. Runs `npm run build` to regenerate the bundle
3. Stages `dist/index.js` if it changed

This ensures:
- Tests pass before every commit
- The bundled output is always up-to-date
- No broken code gets pushed

### Adding New Features

1. Modify source files in `src/`
2. Add tests in `__tests__/`
3. Run `npm test` to verify
4. Commit (pre-commit hook will build automatically)

---

## Rollout Plan

### Phase 1: Preparation (Complete)

- [x] Create JavaScript source files
- [x] Write unit tests (45 tests)
- [x] Configure Vitest with coverage thresholds
- [x] Set up Husky pre-commit hooks
- [x] Build and verify bundle
- [x] Backup bash version to `action.bash.yml`

### Phase 2: Shadow Testing (Recommended)

Run both versions in parallel to verify parity:

```yaml
# In your workflow, temporarily run both:
- name: Notify (JS version)
  uses: ./actions/fe-staging-notification
  with:
    repo: ${{ inputs.repo }}
    # ... other inputs

- name: Notify (Bash version - shadow)
  uses: ./actions/fe-staging-notification/action.bash.yml
  with:
    repo: ${{ inputs.repo }}
    # ... other inputs
```

Compare outputs for 1-2 weeks before proceeding.

### Phase 3: Cutover (Current State)

The repository is now configured to use the JS version:

| File | Status |
|------|--------|
| `action.yml` | JS version (node20) |
| `action.bash.yml` | Bash backup (rollback ready) |

**No workflow changes required** - the action interface is identical.

### Phase 4: Monitoring

After deployment, monitor for:

1. Slack messages appearing correctly
2. Jira tickets being extracted
3. Thread replies working
4. No CI failures due to the action

### Phase 5: Cleanup (After 2+ Weeks Stable)

Once confident:

```bash
# Remove the backup
rm action.bash.yml
git add -A
git commit -m "chore: remove bash backup after successful JS migration"
```

---

## Rollback Plan

If issues arise in production, rollback takes less than 5 minutes:

### Quick Rollback

```bash
cd actions/fe-staging-notification

# Restore bash version
cp action.bash.yml action.yml

# Commit and push
git add action.yml
git commit -m "revert: rollback fe-staging-notification to bash version"
git push
```

### Verify Rollback

After pushing, trigger a test deployment and verify:
- Slack message appears
- Jira tickets are extracted
- Thread behavior works

### Root Cause Analysis

If rollback was needed, investigate:
1. Check GitHub Actions logs for errors
2. Compare JS output vs expected bash output
3. Test locally with `node dist/index.js` (mock inputs)
4. Add regression tests before re-attempting migration

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Could not determine branch name" | Missing workflow_dispatch input | Ensure workflow has `branch` input or pass it explicitly |
| "Slack API error: channel_not_found" | Wrong channel name or bot not in channel | Verify channel name, invite bot to channel |
| "Slack API error: invalid_auth" | Bad token | Regenerate Slack token |
| No Jira tickets found | Commits don't have IL-XXXXX pattern | Check commit message format |
| Message not threading | Search didn't find existing message | Message may be >30 days old |

### Debug Mode

To see detailed logs, check the GitHub Actions output. The action logs:
- Branch name detected
- Number of Jira tickets found
- Whether existing message was found
- Success/failure of Slack API calls

### Local Testing

```bash
# Set environment variables
export INPUT_REPO="TestRepo"
export INPUT_NETWORK="testnet"
export INPUT_STAGING_URL="https://test.example.com"
export INPUT_SLACK_USER_TOKEN="xoxp-..."
export INPUT_SLACK_BOT_TOKEN="xoxb-..."
export GITHUB_ACTOR="testuser"
export GITHUB_REF_NAME="feat/test-branch"

# Run the action
node dist/index.js
```

---

## Changelog

### v2.0.0 (JavaScript Migration)

- Migrated from 542-line bash script to JavaScript
- Added retry logic for Slack API calls (3 retries, 2s delay)
- Added unit tests (45 tests, 50%+ coverage)
- Added pre-commit hooks for test validation
- Fixed: Staging URL now replaces instead of accumulates
- Fixed: Message ID added to new messages for reference
- No breaking changes to action interface

### v1.x (Bash Version)

- Original bash implementation
- Preserved in `action.bash.yml` for rollback
