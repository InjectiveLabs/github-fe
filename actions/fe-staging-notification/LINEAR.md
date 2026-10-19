# Linear Integration

This document describes the Linear ticket integration for the staging notification action.

## Overview

When a staging deployment occurs, the action:

1. Extracts Linear ticket IDs from commit messages and PR titles
2. Looks up each ticket via Linear's GraphQL API
3. Posts a staging deployment comment on each valid ticket
4. Posts a Slack thread reply listing the linked tickets with URLs

## Ticket ID Format

Linear tickets are detected using the pattern: `[A-Z]{1,5}-[0-9]{1,5}`

Examples of supported formats:
- `INJ-142` - Injective team
- `SEC-146` - Security team
- `I-42` - Single letter prefix
- `ILO-796` - Three letter prefix
- `ID-1364`, `IC-930`, `IA-920` - Other team prefixes

Multiple tickets can appear in a single commit message or PR title. Tickets are deduplicated across all sources.

## How Ticket Sources Work

The action reads tickets from multiple sources (in order):

1. **GitHub event payload** (automatic)
   - **Push events**: All commit messages from `commits[].message`
   - **PR events**: Pull request title and body

2. **`commit-messages` input** (manual, for `workflow_dispatch`)
   - Newline-separated commit messages passed by the calling workflow
   - Use when the event payload has no commits (manual triggers)

3. **`pr-title` input** (optional)
   - Pass `${{ github.event.pull_request.title }}` from the calling workflow

All sources are combined and deduplicated before processing.

## Linear API

### Authentication

Requires a Linear API key with the following permissions:
- **Read issues** - to look up tickets by identifier
- **Create comments** - to post staging deployment comments

Generate an API key at: Settings > API > Personal API keys

Store it as a GitHub Actions secret (e.g., `LINEAR_API_KEY`).

### GraphQL Queries Used

**Issue lookup:**
```graphql
query GetIssue($id: String!) {
  issue(id: $id) {
    id
    identifier
    title
    url
  }
}
```

**Comment creation:**
```graphql
mutation CreateComment($input: CommentCreateInput!) {
  commentCreate(input: $input) {
    success
    comment { id }
  }
}
```

### Rate Limiting

- Linear allows 1500 requests/hour for most plans
- The action caps at 20 tickets per run to stay well within limits
- If more than 20 tickets are found, a warning is logged and only the first 20 are processed

### Retry Logic

- 3 retries with 2-second delays for transient network errors
- GraphQL errors (issue not found, auth errors) are not retried
- 30-second timeout per request

## Comment Format

The comment posted on each Linear ticket looks like:

```
**Staging Deployment**
- **Repo:** injective-fe
- **Branch:** `feat/new-feature`
- **Staging URL:** https://staging.example.com
- **Author:** github-username
```

## Slack Thread Notification

After posting Linear comments, a Slack thread reply is added listing all linked tickets:

```
New staging link deployed (mainnet)
Description: Linear tickets linked:
  - INJ-142 - Add login page
  - SEC-146 - Fix auth vulnerability
Staging URL: https://staging.example.com
Author: github-username
```

Each ticket ID is a clickable link to the Linear issue.

## Configuration

### Required Secrets

| Secret | Description |
|--------|-------------|
| `LINEAR_API_KEY` | Linear API key with read issues + create comments permissions |

### Workflow Example

```yaml
- uses: ./actions/fe-staging-notification
  with:
    repo: ${{ inputs.repo }}
    network: ${{ inputs.network }}
    staging_url: ${{ steps.deploy.outputs.url }}
    slack-user-token: ${{ secrets.SLACK_USER_TOKEN }}
    slack-bot-token: ${{ secrets.SLACK_BOT_TOKEN }}
    linear-api-key: ${{ secrets.LINEAR_API_KEY }}
    pr-title: ${{ github.event.pull_request.title }}
```

### For `workflow_dispatch` Triggers

Since `workflow_dispatch` events don't include commit data in the payload, pass commit messages explicitly:

```yaml
- name: Get recent commits
  id: commits
  run: echo "messages=$(git log --format='%s' -10)" >> $GITHUB_OUTPUT

- uses: ./actions/fe-staging-notification
  with:
    repo: ${{ inputs.repo }}
    network: ${{ inputs.network }}
    staging_url: ${{ steps.deploy.outputs.url }}
    slack-user-token: ${{ secrets.SLACK_USER_TOKEN }}
    slack-bot-token: ${{ secrets.SLACK_BOT_TOKEN }}
    linear-api-key: ${{ secrets.LINEAR_API_KEY }}
    commit-messages: ${{ steps.commits.outputs.messages }}
```

## Backwards Compatibility

The Linear integration is fully optional. If `linear-api-key` is not provided:
- No Linear API calls are made
- `linear_tickets` and `linear_links` outputs are empty strings
- All existing Slack notification behavior is unchanged

## Error Handling

Linear integration failures are non-fatal:
- If a ticket ID doesn't exist in Linear, it's skipped with a log message
- If the Linear API is unreachable, a warning is logged and the action continues
- The Slack notification always completes regardless of Linear status
