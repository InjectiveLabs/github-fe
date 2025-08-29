# GitHub Frontend Actions

A collection of reusable GitHub Actions for frontend development workflows. These actions are designed to be shared across multiple repositories to reduce duplication and maintain consistency.

## Available Actions

### 🚀 [Deployment Notification](./actions/deployment-notification/)

A comprehensive action that handles deployment notifications with Jira ticket extraction and Slack integration.

**Features:**

- Automatic Jira ticket extraction from commit messages
- Smart Slack threading to avoid duplicate messages
- Jira ticket tracking and deduplication
- Pre-configured for Injective Labs (IL- tickets, test-slack channel)
- Repository branding in Slack messages

**Use Case:** Perfect for any deployment workflow that needs to notify teams and track Jira tickets.

## Repository Structure

```
github-fe/
├── actions/
│   └── deployment-notification/
│       ├── action.yml          # Action definition
│       └── README.md           # Action documentation
├── examples/                    # Example workflows and usage
│   └── deployment-workflow.yml # Example deployment workflow
├── README.md                   # This file
├── STRUCTURE.md                # Repository organization guide
└── LICENSE                     # Repository license
```

## How to Use

### 1. Reference Actions in Your Workflows

```yaml
# In your repository's .github/workflows/ file
- uses: InjectiveLabs/github-fe/actions/deployment-notification@master
  with:
    repo: "Mito"
    network: "Testnet"
    description: "Feature deployment"
    slack-user-token: ${{ secrets.SLACK_USER_TOKEN }}
    slack-bot-token: ${{ secrets.SLACK_BOT_TOKEN }}
```

### 2. Required Secrets

Most actions require specific secrets to be configured in your repository:

- **Slack Integration**: `SLACK_USER_TOKEN`, `SLACK_BOT_TOKEN`
- **Jira Integration**: Pre-configured for Injective Labs
- **Other Services**: Check individual action documentation

### 3. Version Pinning

For production use, pin to specific versions or tags:

```yaml
- uses: InjectiveLabs/github-fe/actions/deployment-notification@v1.0.0
```

## Adding New Actions

To add a new reusable action:

1. Create a new directory under `actions/`
2. Include an `action.yml` file with the action definition
3. Add comprehensive documentation in a `README.md`
4. Update this main README with the new action
5. Test thoroughly before releasing

## Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch
3. Add your action with proper documentation
4. Test thoroughly
5. Submit a pull request

## Best Practices

- **Documentation**: Every action should have comprehensive documentation
- **Testing**: Test actions in real workflows before releasing
- **Versioning**: Use semantic versioning for releases
- **Backward Compatibility**: Maintain backward compatibility when possible
- **Error Handling**: Include proper error handling and fallbacks

## Support

For issues or questions:

1. Check the action's individual README
2. Review the action's source code
3. Open an issue in this repository
4. Contact the maintainers

## License

This repository is licensed under the same license as specified in the LICENSE file.
