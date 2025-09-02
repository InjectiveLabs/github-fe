# GitHub Frontend Actions

A collection of reusable GitHub Actions for injective's frontend development workflows. These actions are designed to be shared across multiple repositories to reduce duplication and maintain consistency.

## Available Actions

### 🚀 [Deployment Notification](./actions/fe-staging-notification/)

A comprehensive action that handles deployment notifications with Jira ticket extraction and Slack integration.

**Features:**

- Automatic Jira ticket extraction from commit messages
- Smart Slack threading to avoid duplicate messages
- Jira ticket tracking and deduplication
- Pre-configured for Injective Labs (IL- tickets, test-slack channel)
- Repository branding in Slack messages
- Staging URL integration
- Branch-specific deployment tracking

**Use Case:** Perfect for staging deployment workflows that need to notify teams and track Jira tickets.

### 🎯 [Production Deployment Notification](./actions/prod-deployment-notification/)

A specialized action for production deployment notifications with release notes integration.

**Features:**

- Production-specific messaging with @here notifications
- Release notes integration
- Smart handling of rebuilds vs new deployments
- GitHub Actions run linking
- Clean, professional production messaging

**Use Case:** Essential for production deployment workflows that need to notify teams about live releases.

### 📝 [Release Note](./actions/release-note/)

An intelligent action that generates comprehensive release notes from git commits with automatic PR linking.

**Features:**

- Automatic version incrementing (patch version)
- Smart PR commit detection and linking
- Clean commit message formatting
- Author attribution with GitHub links
- Bugsnag version computation for error tracking
- Handles edge cases like no commits or merge commits

**Use Case:** Essential for automated release workflows that need professional release notes with proper attribution.

### 📦 [Package Bump](./actions/package-bump/)

A utility action that automatically bumps package versions and commits changes to a repository.

**Features:**

- Automatic package dependency updates
- Configurable folder path support
- Cross-repository package bumping
- Safe commit handling with change detection
- Configurable branch targeting
- Built-in delay for CI/CD coordination

**Use Case:** Perfect for monorepos or multi-repository setups where packages need to be updated across different repositories.

## How to Use

### 1. Reference Actions in Your Workflows

**Staging Deployment Notification:**

```yaml
# In your repository's .github/workflows/ file
- name: Send deployment notification
  uses: InjectiveLabs/github-fe/actions/fe-staging-notification@master
  with:
    repo: "Mito"
    network: ${{ env.network_display }}
    description: ${{ github.event.inputs.description || 'Staging deployment' }}
    staging_url: ${{ steps.netlify_deploy.outputs.staging_url }}
    slack-bot-token: ${{ secrets.SLACK_BOT_TOKEN }}
    slack-user-token: ${{ secrets.SLACK_USER_TOKEN }}
```

**Production Deployment Notification:**

```yaml
- name: "Notify Slack"
  uses: InjectiveLabs/github-fe/actions/prod-deployment-notification@master
  with:
    project-name: "Mito UI"
    webhook-url: ${{ secrets.PRODUCTION_CHANNEL_WEBHOOK_URL }}
    release-notes: ${{ needs.mainnet-release.outputs.release_notes }}
```

**Release Note Generation:**

```yaml
- name: Generate GitHub Release Notes
  uses: InjectiveLabs/github-fe/actions/release-note@master
  with:
    previous_tag: ${{ env.current_version }}
    repo_url: "https://github.com/MitoFinance/mito-ui"
```

**Package Bump:**

```yaml
- uses: InjectiveLabs/github-fe/actions/package-bump@master
  with:
    gh_token: ${{ secrets.GITHUB_TOKEN }}
    repository_url: "InjectiveLabs/mito-ui"
    repository_branch: "main"
    folder_path: "packages/ui" # Optional
```

### 2. Required Secrets

Most actions require specific secrets to be configured in your repository:

- **Slack Integration**:
  - `SLACK_USER_TOKEN`, `SLACK_BOT_TOKEN` (for fe-staging-notification)
  - `PRODUCTION_CHANNEL_WEBHOOK_URL` (for prod-deployment-notification)
- **GitHub Integration**: `GITHUB_TOKEN` (for package-bump and release-note)
- **Jira Integration**: Pre-configured for Injective Labs (for fe-staging-notification)
- **Deployment Services**:
  - `NETLIFY_TOKEN`, `NETLIFY_SITE_ID` (for staging deployments)
  - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID` (for production deployments)
- **Other Services**: Check individual action documentation

### 3. Version Pinning

For production use, pin to specific versions or tags:

```yaml
- uses: InjectiveLabs/github-fe/actions/fe-staging-notification@v1.0.0
- uses: InjectiveLabs/github-fe/actions/prod-deployment-notification@v1.0.0
- uses: InjectiveLabs/github-fe/actions/release-note@v1.0.0
- uses: InjectiveLabs/github-fe/actions/package-bump@v1.0.0
```

## License

This repository is licensed under the same license as specified in the LICENSE file.
