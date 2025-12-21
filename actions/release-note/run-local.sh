#!/usr/bin/env bash

# Local test runner for release-note action
# This script runs the action from the target repository directory
#
# Usage:
#   ./run-local.sh [PREVIOUS_TAG] [REPO_URL] [BRANCH] [TARGET_REPO]
#
# Examples:
#   # Use all defaults (v1.17.17, injective-helix repo, master branch)
#   ./run-local.sh
#
#   # Specify a different tag
#   ./run-local.sh v1.17.16
#
#   # Specify tag and repo URL
#   ./run-local.sh v1.17.16 https://github.com/InjectiveLabs/injective-helix
#
#   # Specify tag, repo URL, and branch
#   ./run-local.sh v1.17.16 https://github.com/InjectiveLabs/injective-helix dev
#
#   # Full custom configuration
#   ./run-local.sh v1.0.0 https://github.com/user/repo main /path/to/repo

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Default values
PREVIOUS_TAG="${1:-v1.17.17}"
REPO_URL="${2:-https://github.com/InjectiveLabs/injective-helix}"
BRANCH="${3:-master}"
TARGET_REPO="${4:-/Users/leeruianthomas/Public/injective/injective-helix}"

print_info "Running release-note action locally"
print_info "Previous tag: $PREVIOUS_TAG"
print_info "Repository URL: $REPO_URL"
print_info "Branch: $BRANCH"
print_info "Target repo: $TARGET_REPO"
echo ""

# Check if target repo exists
if [ ! -d "$TARGET_REPO" ]; then
    echo "Error: Target repository not found at $TARGET_REPO"
    exit 1
fi

# Change to target repository
cd "$TARGET_REPO"

# Set up environment variables for the action
export INPUT_PREVIOUS_TAG="$PREVIOUS_TAG"
export INPUT_REPO_URL="$REPO_URL"
export INPUT_BRANCH="$BRANCH"

# Run the action
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
node "$SCRIPT_DIR/dist/index.js"
