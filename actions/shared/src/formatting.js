/**
 * Formatting utilities for GitHub Actions
 * Handles conversion between different markdown formats (GitHub, Slack, etc.)
 */

/**
 * Convert GitHub markdown links to Slack mrkdwn format
 * GitHub format: [text](url)
 * Slack format: <url|text>
 *
 * @param {string} text - Text containing GitHub markdown links
 * @returns {string} - Text with Slack formatted links
 */
export function convertMarkdownToSlack(text) {
  if (!text) {
    return '';
  }

  // Convert [text](url) to <url|text>
  return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<$2|$1>');
}

/**
 * Escape special characters in commit messages for safe output
 *
 * @param {string} message - The commit message to escape
 * @returns {string} - Escaped message
 */
export function escapeCommitMessage(message) {
  if (!message) {
    return '';
  }

  return message.replace(/`/g, '\\`').replace(/"/g, '\\"');
}

/**
 * Extract GitHub username from git author information
 * Handles various email formats including GitHub noreply emails
 *
 * @param {string} authorName - Git author name
 * @param {string} authorEmail - Git author email
 * @returns {string} - Formatted author string (e.g., "@username" or "Name (email)")
 */
export function formatGitAuthor(authorName, authorEmail) {
  if (!authorName) {
    return 'unknown';
  }

  // GitHub noreply email format: username@users.noreply.github.com
  // or ID+username@users.noreply.github.com
  const noReplyMatch = authorEmail?.match(/^(?:\d+\+)?([^@]+)@users\.noreply\.github\.com$/i);
  if (noReplyMatch) {
    return `@${noReplyMatch[1]}`;
  }

  // If author name has no spaces, assume it's a GitHub username
  if (!authorName.includes(' ')) {
    return `@${authorName}`;
  }

  // Full name with spaces, show with email
  return authorEmail ? `${authorName} (${authorEmail})` : authorName;
}

/**
 * Extract PR number from a commit message
 * Looks for patterns like "#1234" or "pull request #1234"
 *
 * @param {string} message - Commit message
 * @returns {string|null} - PR number (e.g., "1234") or null if not found
 */
export function extractPRNumber(message) {
  if (!message) {
    return null;
  }

  const match = message.match(/#(\d+)/);

  return match ? match[1] : null;
}

/**
 * Check if a commit is a PR merge commit
 * PR merge commits have messages like "Merge pull request #XXX from ..."
 *
 * @param {Object} commit - Commit object with message property
 * @returns {boolean} - True if commit is a PR merge commit
 */
export function isPRMergeCommit(commit) {
  if (!commit?.message) {
    return false;
  }

  return /^Merge pull request #\d+ from /i.test(commit.message);
}

/**
 * Check if a commit is a dev-to-master merge commit
 * These are specifically "Merge pull request #XXX from .../dev" commits
 * which represent previous releases when doing dev -> master merges.
 *
 * @param {Object} commit - Commit object with message property
 * @returns {boolean} - True if commit is a dev-to-master merge
 */
export function isDevToMasterMerge(commit) {
  if (!commit?.message) {
    return false;
  }

  // Match "Merge pull request #XXX from org/dev" or "Merge pull request #XXX from InjectiveLabs/dev"
  return /^Merge pull request #\d+ from [^/]+\/dev$/i.test(commit.message);
}

/**
 * Check if a commit is a branch merge commit (e.g., "Merge branch 'dev' into master")
 *
 * @param {Object} commit - Commit object with message property
 * @returns {boolean} - True if commit is a branch merge commit
 */
export function isBranchMergeCommit(commit) {
  if (!commit?.message) {
    return false;
  }

  return /^Merge branch ['"]?\w+['"]? into /i.test(commit.message);
}

/**
 * Filter commits to exclude old dev-to-master merge commits.
 *
 * Context: This is used for release notes when merging dev -> master.
 * We want to keep:
 * - The first dev-to-master merge commit (the current PR being merged)
 * - All feature branch merge commits (e.g., "Merge pull request #XXX from org/feat/something")
 * - All non-merge commits (actual feature/fix commits)
 * - All branch merge commits (e.g., "Merge branch 'dev' into feat/something")
 *
 * We filter out:
 * - Old "Merge pull request #XXX from org/dev" commits (previous releases)
 *
 * @param {Array<Object>} commits - Array of commit objects
 * @returns {Array<Object>} - Filtered commits
 */
export function filterOldMergeCommits(commits) {
  if (!commits || commits.length === 0) {
    return [];
  }

  let foundFirstDevMerge = false;

  return commits.filter((commit) => {
    // Only filter dev-to-master merges, keep everything else
    if (!isDevToMasterMerge(commit)) {
      return true;
    }

    // Keep the first dev-to-master merge (current PR)
    if (!foundFirstDevMerge) {
      foundFirstDevMerge = true;

      return true;
    }

    // Filter out subsequent dev-to-master merges (old releases)
    return false;
  });
}

/**
 * Format a single commit as a markdown list item for release notes
 *
 * @param {Object} commit - Commit information
 * @param {string} commit.hash - Full commit hash
 * @param {string} commit.message - Commit message
 * @param {string} commit.authorName - Author name
 * @param {string} commit.authorEmail - Author email
 * @param {string} repoUrl - Repository URL (e.g., "https://github.com/org/repo")
 * @returns {string} - Formatted markdown line
 */
export function formatCommitLine(commit, repoUrl) {
  const shortHash = commit.hash.substring(0, 7);
  const escapedMessage = escapeCommitMessage(commit.message);
  const author = formatGitAuthor(commit.authorName, commit.authorEmail);

  // Create clickable commit link
  const commitLink = `[${shortHash}](${repoUrl}/commit/${commit.hash})`;

  // Check for PR number in message
  const prNumber = extractPRNumber(commit.message);
  const prInfo = prNumber ? ` in [#${prNumber}](${repoUrl}/pull/${prNumber})` : '';

  return `- ${commitLink} - ${escapedMessage} by ${author}${prInfo}`;
}

/**
 * Format multiple commits as release notes
 * Filters out old merge commits from branch history to only show relevant changes
 *
 * @param {Array<Object>} commits - Array of commit objects
 * @param {string} repoUrl - Repository URL
 * @returns {string} - Formatted release notes or "No new commits"
 */
export function formatReleaseNotes(commits, repoUrl) {
  if (!commits || commits.length === 0) {
    return 'No new commits';
  }

  // Filter out old merge commits from dev branch history
  const filteredCommits = filterOldMergeCommits(commits);

  if (filteredCommits.length === 0) {
    return 'No new commits';
  }

  return filteredCommits.map((commit) => formatCommitLine(commit, repoUrl)).join('\n');
}
