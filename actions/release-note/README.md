# GitHub Release Notes Action

This GitHub Action generates release notes from git commits between two tags.

## Features

- Increments version numbers automatically
- Generates formatted release notes from git commits
- Maps commits to pull requests when possible
- Handles merge commits and regular commits
- Provides debugging information
- Computes Bugsnag app version

## Usage

### In GitHub Actions

```yaml
- name: Generate GitHub Release Notes
  id: release_notes
  uses: InjectiveLabs/github-fe/actions/release-note@master
  with:
    previous_tag: ${{ env.current_version }}
    repo_url: "https://github.com/InjectiveLabs/injective-helix"
```

### Inputs

- `previous_tag` (required): The previous tag to compare against
- `repo_url` (required): The URL of the repository

### Outputs

- `new_version`: Incremented github tag number
- `release_notes`: Generated release notes from git commits
- `bugsnag_version`: The app version to use for Bugsnag

## Local Testing

A comprehensive test script is provided to test the action locally before deploying.

### Prerequisites

- Bash shell
- Git repository
- The script must be run from within a git repository

### Basic Usage

```bash
# Test with the latest tag in your repository
./test-action.sh

# Test with a specific tag
./test-action.sh -t v1.16.15

# Test with a specific tag and repository URL
./test-action.sh -t v1.16.15 -r https://github.com/user/repo

# Create test data and run test
./test-action.sh --create-test
```

### Options

- `-t, --tag TAG`: Previous tag to compare against (default: latest tag)
- `-r, --repo URL`: Repository URL (default: current repo)
- `-c, --create-test`: Create test commits and tags for testing
- `-h, --help`: Show help message

### Test Scenarios

The test script supports several scenarios:

1. **Real Repository Testing**: Test with actual tags and commits in your repository
2. **Test Data Creation**: Create temporary test commits and tags for isolated testing
3. **Edge Cases**: Test with no commits, merge commits, and various commit types

### Example Output

```
[INFO] GitHub Release Notes Action Test Script

[INFO] Using latest tag: v1.16.15
[INFO] Using repository URL: https://github.com/InjectiveLabs/injective-helix
[INFO] Simulating GitHub Action...
[INFO] Previous tag: v1.16.15
[INFO] Repository URL: https://github.com/InjectiveLabs/injective-helix

[INFO] Step 1: Incrementing version...
[SUCCESS] New version: v1.16.16

[INFO] Step 2: Generating release notes...
Previous tag: v1.16.15
Current HEAD: abc123def456
Tag commit: def456abc123
Found 5 commits between v1.16.15 and HEAD
Raw commits found:
abc1234|feat: add new feature|John Doe|john@example.com
def5678|fix: resolve bug|Jane Smith|jane@example.com
...

[INFO] Step 3: Computing Bugsnag app version...

[SUCCESS] Action simulation completed!

=== RESULTS ===
New version: v1.16.16
Bugsnag version: v1.16.16

Release notes:
- abc1234 - feat: add new feature by John Doe (john@example.com) in [#1234](https://github.com/user/repo/pull/1234)
- def5678 - fix: resolve bug by Jane Smith (jane@example.com)
```

### Creating Test Data

When using the `--create-test` option, the script will:

1. Create a temporary branch
2. Add several test commits with different types (feat, fix, docs, merge)
3. Create a test tag
4. Add more commits after the tag
5. Run the test
6. Clean up the test data

This is useful for testing the action without affecting your main repository.

### Troubleshooting

#### No commits found

- Ensure you're in a git repository
- Check that the specified tag exists
- Verify there are commits between the tag and HEAD

#### Permission denied

- Make sure the script is executable: `chmod +x test-action.sh`

#### Invalid tag format

- Tags should follow semantic versioning: `v1.2.3` or `1.2.3`

## Development

### Testing Changes

1. Make changes to `action.yml`
2. Run the test script: `./test-action.sh --create-test`
3. Verify the output matches expectations
4. Test with real repository data: `./test-action.sh -t <your-tag>`

### Debugging

The test script provides extensive debugging output:

- Commit counts
- Raw commit data
- Tag and HEAD information
- Step-by-step execution

## Contributing

1. Make changes to the action
2. Test locally using the test script
3. Create a pull request with your changes
4. Ensure all tests pass

## License

This action is part of the InjectiveLabs GitHub Actions collection.
