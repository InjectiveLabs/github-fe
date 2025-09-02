# Production Deployment Notification

A reusable GitHub Action that sends Slack notifications for production deployments with release notes.

## Features

- Sends Slack notifications for deployments
- Handles both deployments with new commits and rebuilds without new commits
- Configurable project name and release notes
- Links to GitHub Actions run results

## Usage

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Notify Slack on Deployment
        uses: ./.github/actions/prod-deployment-notification
        with:
          webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
          project-name: "MyApp"
          release-notes: ${{ steps.generate-release-notes.outputs.notes }}
```

## Inputs

| Input           | Description                         | Required |
| --------------- | ----------------------------------- | -------- |
| `webhook-url`   | Slack webhook URL for notifications | ✅       |
| `project-name`  | Name of the project being deployed  | ✅       |
| `release-notes` | Release notes or commit information | ✅       |

## Example Workflow

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  mainnet-release:
    runs-on: ubuntu-latest
    outputs:
      release_notes: ${{ steps.generate-notes.outputs.notes }}
    steps:
      - name: Generate Release Notes
        id: generate-notes
        run: |
          # Your release notes generation logic here
          echo "notes=Some release notes" >> $GITHUB_OUTPUT

  notify-deployment:
    runs-on: ubuntu-latest
    needs: mainnet-release
    steps:
      - name: Notify Slack on Deployment
        uses: ./.github/actions/prod-deployment-notification
        with:
          webhook-url: ${{ secrets.PRODUCTION_CHANNEL_WEBHOOK_URL }}
          project-name: "Helix"
          release-notes: ${{ needs.mainnet-release.outputs.release_notes }}
```

## Slack Message Examples

### Deployment with New Commits

```
<!here> 🚀 Helix deployed to Mainnet!
View the deployment results on Github: https://github.com/InjectiveLabs/injective-helix/actions/runs/1234567890.
The commits deployed are:
- feat: Add new feature
- fix: Fix critical bug
```

### Rebuild without New Commits

```
<!here> 🚀 Helix Rebuilt on Mainnet! Good guys, close your eyes! 🛠️😄.
```

## Requirements

- A Slack webhook URL configured in your repository secrets
- The action must be run in a workflow that has access to the webhook URL secret

## License

This action is part of the Injective Labs project.
