#!/usr/bin/env bash

# Test script for GitHub Release Notes Action
# This script simulates the GitHub Action environment locally

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -t, --tag TAG        Previous tag to compare against (default: latest tag)"
    echo "  -r, --repo URL       Repository URL (default: current repo)"
    echo "  -c, --create-test    Create test commits and tags for testing"
    echo "  -h, --help           Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Test with latest tag"
    echo "  $0 -t v1.16.15                       # Test with specific tag"
    echo "  $0 -t v1.16.15 -r https://github.com/user/repo"
    echo "  $0 --create-test                      # Create test data and run test"
}

# Default values
PREVIOUS_TAG=""
REPO_URL=""
CREATE_TEST=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--tag)
            PREVIOUS_TAG="$2"
            shift 2
            ;;
        -r|--repo)
            REPO_URL="$2"
            shift 2
            ;;
        -c|--create-test)
            CREATE_TEST=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Function to create test data
create_test_data() {
    print_status "Creating test data..."
    
    # Create a temporary branch for testing
    TEST_BRANCH="test-release-notes-$(date +%s)"
    git checkout -b "$TEST_BRANCH" 2>/dev/null || git checkout "$TEST_BRANCH"
    
    # Create some test commits
    print_status "Creating test commits..."
    
    # Create a test file
    echo "# Test Release Notes" > test-release-notes.md
    git add test-release-notes.md
    git commit -m "feat: add test release notes file"
    
    # Create another commit
    echo "This is a test commit for release notes generation." >> test-release-notes.md
    git add test-release-notes.md
    git commit -m "docs: update test file with more content"
    
    # Create a commit that looks like a merge
    echo "Merge commit test" >> test-release-notes.md
    git add test-release-notes.md
    git commit -m "Merge pull request #1234 from feature/test-branch
    
    This is a test merge commit for release notes testing"
    
    # Create a tag for testing
    TEST_TAG="v1.16.14"
    git tag "$TEST_TAG"
    
    # Create more commits after the tag
    echo "Post-tag commit 1" >> test-release-notes.md
    git add test-release-notes.md
    git commit -m "fix: resolve issue with release notes generation"
    
    echo "Post-tag commit 2" >> test-release-notes.md
    git add test-release-notes.md
    git commit -m "feat: add new feature for testing"
    
    # Create another merge commit
    echo "Another merge test" >> test-release-notes.md
    git add test-release-notes.md
    git commit -m "Merge pull request #5678 from feature/another-test
    
    Another test merge commit with multiple lines"
    
    print_success "Test data created successfully!"
    print_status "Test branch: $TEST_BRANCH"
    print_status "Test tag: $TEST_TAG"
    
    # Set the previous tag for testing
    PREVIOUS_TAG="$TEST_TAG"
}

# Function to clean up test data
cleanup_test_data() {
    if [[ -n "$TEST_BRANCH" ]]; then
        print_status "Cleaning up test data..."
        git checkout main 2>/dev/null || git checkout master 2>/dev/null || git checkout dev 2>/dev/null
        git branch -D "$TEST_BRANCH" 2>/dev/null || true
        git tag -d "$TEST_TAG" 2>/dev/null || true
        print_success "Test data cleaned up!"
    fi
}

# Function to get the latest tag if not specified
get_latest_tag() {
    if [[ -z "$PREVIOUS_TAG" ]]; then
        PREVIOUS_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
        if [[ -z "$PREVIOUS_TAG" ]]; then
            print_error "No tags found in repository. Please specify a tag with -t option or create test data with -c option."
            exit 1
        fi
        print_status "Using latest tag: $PREVIOUS_TAG"
    fi
}

# Function to get repository URL if not specified
get_repo_url() {
    if [[ -z "$REPO_URL" ]]; then
        REPO_URL=$(git config --get remote.origin.url 2>/dev/null || echo "https://github.com/user/repo")
        # Convert SSH URL to HTTPS if needed
        if [[ "$REPO_URL" =~ git@github.com: ]]; then
            REPO_URL=$(echo "$REPO_URL" | sed 's/git@github.com:/https:\/\/github.com\//' | sed 's/\.git$//')
        fi
        print_status "Using repository URL: $REPO_URL"
    fi
}

# Function to simulate the GitHub Action
simulate_action() {
    print_status "Simulating GitHub Action..."
    print_status "Previous tag: $PREVIOUS_TAG"
    print_status "Repository URL: $REPO_URL"
    echo ""
    
    # Set up environment variables (simulating GitHub environment)
    export GITHUB_OUTPUT="/tmp/github_output_$$"
    export GITHUB_ENV="/tmp/github_env_$$"
    
    # Create temporary files
    touch "$GITHUB_OUTPUT" "$GITHUB_ENV"
    
    # Step 1: Increment version
    print_status "Step 1: Incrementing version..."
    tag_without_v="$PREVIOUS_TAG"
    tag_without_v="${tag_without_v#v}"
    IFS='.' read -r major minor patch <<< "$tag_without_v"
    
    if [[ -z "$major" || -z "$minor" || -z "$patch" ]]; then
        print_error "Invalid tag format. Expected format: v1.2.3 or 1.2.3"
        exit 1
    fi
    
    patch=$((patch + 1))
    new_version="v$major.$minor.$patch"
    echo "new_version=${new_version}" >> "$GITHUB_ENV"
    echo "new_version=${new_version}" >> "$GITHUB_OUTPUT"
    
    print_success "New version: $new_version"
    
    # Step 2: Generate Release Notes
    print_status "Step 2: Generating release notes..."
    
    # Validate that the previous tag exists
    if ! git rev-parse --verify "$PREVIOUS_TAG" >/dev/null 2>&1; then
        print_error "Tag '$PREVIOUS_TAG' does not exist"
        exit 1
    fi
    
    # Debug: Show current HEAD and tag info
    echo "Previous tag: $PREVIOUS_TAG"
    echo "Current HEAD: $(git rev-parse HEAD)"
    echo "Tag commit: $(git rev-parse "$PREVIOUS_TAG")"
    
    # Check if there are any commits between the previous tag and HEAD
    commit_count=$(git rev-list --count "$PREVIOUS_TAG"..HEAD 2>/dev/null || echo "0")
    
    if [[ "$commit_count" -eq 0 ]]; then
        echo "No commits found between ${PREVIOUS_TAG} and HEAD."
        formatted_notes="No new commits"
    else
        echo "Found $commit_count commits between ${PREVIOUS_TAG} and HEAD"
        
        # Create associative array to map commits to PR numbers
        # Check if associative arrays are supported
        if [[ "${BASH_VERSION%%.*}" -ge 4 ]]; then
            declare -A commit_to_pr
        else
            # Fallback for older bash versions
            commit_to_pr=""
        fi
        
        # Get all merge commits and map their child commits to PR numbers
        if [[ "${BASH_VERSION%%.*}" -ge 4 ]]; then
            while IFS='|' read -r merge_hash merge_message; do
                if [[ -n "$merge_hash" && -n "$merge_message" ]]; then
                    # Extract PR number from merge message
                    pr_number=$(echo "$merge_message" | grep -oE "#[0-9]+")
                    if [[ -n "$pr_number" ]]; then
                        # Get all commits that were merged in this PR (the feature branch commits)
                        while read -r commit_hash; do
                            if [[ -n "$commit_hash" ]]; then
                                commit_to_pr["$commit_hash"]="$pr_number"
                            fi
                        done < <(git log --pretty=format:"%H" "$merge_hash^1..$merge_hash^2" 2>/dev/null)
                    fi
                fi
            done < <(git log "$PREVIOUS_TAG"..HEAD --grep="Merge pull request" --pretty=format:"%H|%s" 2>/dev/null)
        fi
        
        # Get all commits in the range (including merge commits for better visibility)
        all_commits=$(git log "$PREVIOUS_TAG"..HEAD --pretty=format:"%H|%s|%an|%ae" 2>/dev/null)
        
        # Debug: Show raw commit data
        echo "Raw commits found:"
        echo "$all_commits" | head -10
        
        formatted_notes=""
        
        # Process each commit
        if [[ -n "$all_commits" ]]; then
            while IFS='|' read -r commit_hash commit_message commit_author commit_email; do
                if [[ -n "$commit_hash" && -n "$commit_message" ]]; then
                    # Clean up commit message (escape backticks and quotes)
                    commit_message=$(echo "$commit_message" | sed 's/`/\\`/g' | sed 's/"/\\"/g')
                    
                    # Format author
                    if [[ "$commit_author" =~ " " ]]; then
                        github_author="${commit_author} (${commit_email})"
                    else
                        github_author="@${commit_author}"
                    fi
                    
                    # Check if this commit is part of a PR
                    pr_info=""
                    if [[ "${BASH_VERSION%%.*}" -ge 4 ]] && [[ -n "${commit_to_pr[$commit_hash]:-}" ]]; then
                        pr_number="${commit_to_pr[$commit_hash]}"
                        pr_link="[${pr_number}](${REPO_URL}/pull/${pr_number:1})"
                        pr_info=" in ${pr_link}"
                    fi
                    
                    # Add to formatted notes
                    formatted_notes="${formatted_notes}\n- ${commit_hash:0:7} - ${commit_message} by ${github_author}${pr_info}"
                fi
            done <<< "$all_commits"
        else
            echo "No commits found in the specified range"
        fi
    fi
    
    if [[ -z "$formatted_notes" ]]; then
        formatted_notes="No new commits"
    fi
    
    # Export the formatted notes to the GitHub environment
    echo "release_notes<<EOF" >> "$GITHUB_OUTPUT"
    echo -e "${formatted_notes}" >> "$GITHUB_OUTPUT"
    echo "EOF" >> "$GITHUB_OUTPUT"
    
    # Step 3: Compute Bugsnag App Version
    print_status "Step 3: Computing Bugsnag app version..."
    
    # Assign new_version from earlier step output to a shell variable
    new_version="$new_version"
    release_notes="$formatted_notes"
    
    # Initialize app_version with new_version
    app_version="$new_version"
    
    # Conditional assignment based on release_notes output
    if [[ "$release_notes" == "No new commits" ]]; then
        app_version="$PREVIOUS_TAG"
    fi
    
    # Set the app_version as an output
    echo "app_version=$app_version" >> "$GITHUB_OUTPUT"
    
    # Log for debug purposes
    echo "Release notes: $release_notes"
    echo "Bugsnag version: $app_version"
    
    # Display results
    echo ""
    print_success "Action simulation completed!"
    echo ""
    echo "=== RESULTS ==="
    echo "New version: $new_version"
    echo "Bugsnag version: $app_version"
    echo ""
    echo "Release notes:"
    echo -e "$formatted_notes"
    echo ""
    
    # Clean up temporary files
    rm -f "$GITHUB_OUTPUT" "$GITHUB_ENV"
}

# Main execution
main() {
    print_status "GitHub Release Notes Action Test Script"
    echo ""
    
    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        print_error "Not in a git repository. Please run this script from a git repository."
        exit 1
    fi
    
    # Create test data if requested
    if [[ "$CREATE_TEST" == true ]]; then
        create_test_data
    fi
    
    # Get default values if not specified
    get_latest_tag
    get_repo_url
    
    # Run the simulation
    simulate_action
    
    # Clean up test data if created
    if [[ "$CREATE_TEST" == true ]]; then
        cleanup_test_data
    fi
}

# Trap to clean up on exit
trap cleanup_test_data EXIT

# Run main function
main "$@"
