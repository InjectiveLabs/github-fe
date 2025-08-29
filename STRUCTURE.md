# Repository Structure

```
github-fe/
├── .git/                           # Git repository
├── actions/                        # Reusable GitHub Actions
│   └── deployment-notification/   # Deployment notification action
│       ├── action.yml             # Action definition and implementation
│       └── README.md              # Action-specific documentation
├── examples/                       # Example workflows and usage
│   └── deployment-workflow.yml    # Example deployment workflow
├── LICENSE                         # Repository license
├── README.md                       # Main repository documentation
└── STRUCTURE.md                    # This file
```

## Action Structure

Each action follows this structure:

```
actions/{action-name}/
├── action.yml                      # Action definition (required)
├── README.md                       # Action documentation (required)
└── {other files}                  # Additional resources if needed
```

## File Descriptions

### Core Files
- **`action.yml`**: Defines the action's inputs, outputs, and implementation
- **`README.md`**: Comprehensive documentation for the action
- **`LICENSE`**: Repository license information

### Documentation
- **`README.md`**: Main repository overview and usage guide
- **`STRUCTURE.md`**: This file - repository organization guide
- **`examples/`**: Example workflows showing how to use actions

## Adding New Actions

When adding a new action:

1. Create a new directory under `actions/`
2. Include required files (`action.yml`, `README.md`)
3. Update the main `README.md` with the new action
4. Add examples if helpful
5. Test thoroughly before releasing

## Naming Conventions

- **Action directories**: Use kebab-case (e.g., `deployment-notification`)
- **Action names**: Use Title Case with spaces (e.g., `Deployment Notification`)
- **Files**: Use kebab-case for most files, except `README.md` and `action.yml`
- **Inputs/Outputs**: Use snake_case for consistency with GitHub Actions

## Versioning

Actions should be versioned using:
- Git tags (e.g., `v1.0.0`, `v1.1.0`)
- Semantic versioning principles
- Clear changelog documentation

## Testing

Before releasing actions:
1. Test in real workflows
2. Verify all inputs/outputs work correctly
3. Check error handling scenarios
4. Validate documentation accuracy
5. Test with different GitHub event types 