# Deployment Notification Action

A reusable GitHub Action that extracts Jira tickets from commits and sends Slack notifications for deployments. This action automatically threads new deployments to existing messages and tracks Jira tickets across deployments.

**Note**: This action is specifically configured for Injective Labs with hardcoded values for Jira and Slack.

## Features

- **Jira Ticket Extraction**: Automatically finds and formats Jira ticket references in commit messages
- **Smart Slack Threading**: Creates threaded replies for existing deployments instead of duplicate messages
- **Jira Ticket Tracking**: Updates main messages with new tickets and avoids duplicates
- **Injective Labs Integration**: Pre-configured for IL- tickets and test-slack channel

## Prerequisites

This action requires the following secrets to be configured in your repository:

- `SLACK_USER_TOKEN`: Slack user token with read access to search messages
- `SLACK_BOT_TOKEN`: Slack bot token with write access to send messages

## Usage

### Basic Usage

```yaml
- uses: your-org/github-fe/actions/deployment-notification@main
  with:
    network: "Testnet"
    description: "Feature deployment"
```

### Advanced Usage

```yaml
- uses: your-org/github-fe/actions/deployment-notification@main
  with:
    network: "Mainnet"
    description: "Production deployment for user authentication"
```

### Complete Workflow Example

```yaml
name: Deploy to Staging

on:
  workflow_dispatch:
    inputs:
      branch:
        description: "Branch to deploy"
        required: false
        default: ""
      network:
        description: "Network to deploy to"
        required: false
        default: "Testnet"
      description:
        description: "Deployment description"
        required: false
        default: "Feature deployment"

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Required for git history analysis

      # Your deployment steps here
      - name: Deploy to staging
        run: echo "Deploying..."

      # Use the reusable action
      - uses: your-org/github-fe/actions/deployment-notification@main
        with:
          network: ${{ github.event.inputs.network }}
          description: ${{ github.event.inputs.description }}
```

## Inputs

| Input         | Description                     | Required | Default               |
| ------------- | ------------------------------- | -------- | --------------------- |
| `network`     | Network name for the deployment | No       | `Mainnet`             |
| `description` | Description of the deployment   | No       | `Frontend deployment` |

## Hardcoded Values

This action is pre-configured with the following values for Injective Labs:

- **Slack Channel**: `test-slack`
- **Jira Base URL**: `https://injective-labs.atlassian.net/browse/`
- **Jira Ticket Prefix**: `IL` (case-insensitive)

## Outputs

| Output                      | Description                                                       |
| --------------------------- | ----------------------------------------------------------------- |
| `branch_name`               | The branch name that was deployed                                 |
| `jira_tickets`              | Comma-separated list of Jira tickets found                        |
| `jira_links`                | Formatted Jira links for Slack                                    |
| `message_found`             | Whether an existing Slack message was found                       |
| `existing_message_ts`       | Timestamp of existing Slack message if found                      |
| `existing_channel_id`       | Channel ID of existing Slack message if found                     |
| `existing_jira_tickets`     | Jira tickets from existing Slack message                          |
| `existing_message_text_b64` | Base64 encoded existing message text                              |
| `channel_name`              | Slack channel name used                                           |
| `message_ts`                | Timestamp of the Slack message (either existing or newly created) |

## How It Works

1. **Branch Analysis**: Determines the branch name based on the GitHub event type
2. **Jira Ticket Extraction**: Analyzes commit messages to find IL- ticket references
3. **Slack Message Search**: Looks for existing deployment messages for the same branch in #test-slack
4. **Smart Threading**: Creates threaded replies instead of duplicate messages
5. **Ticket Tracking**: Updates main messages with new Jira tickets while avoiding duplicates

## Supported Events

- `pull_request`: Automatically detects PR source branch
- `workflow_dispatch`: Supports manual workflow triggers with optional branch parameter
- Other events: Uses the current branch name

## Jira Ticket Format

The action looks for tickets in the format: `IL-{NUMBER}` where:

- `IL` is the hardcoded prefix for Injective Labs (case-insensitive)
- `NUMBER` is 3-5 digits

Examples: `IL-123`, `il-4567`, `IL-89`

## Error Handling

- **Slack API Failures**: Gracefully falls back to creating new messages if search fails
- **Jira Extraction**: Continues with empty ticket lists if no tickets are found
- **Message Updates**: Handles failures gracefully when updating existing messages

## Important Notes

- **Branch Protection**: This action does not include branch protection checks. Implement them in your workflow before calling this action.
- **Injective Labs Specific**: This action is configured specifically for Injective Labs workflows.
- **Slack Channel**: All notifications are sent to the `#test-slack` channel.
- **Message Timestamps**: The `message_ts` output always contains a valid timestamp, whether threading to an existing message or creating a new one.

## Contributing

This action is part of the `github-fe` repository. To contribute:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This action is licensed under the same license as the parent repository.
