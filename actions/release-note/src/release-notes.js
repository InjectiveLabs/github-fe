/**
 * Release notes generation utilities
 */

import { incrementPatch } from '../../shared/src/version.js';
import { formatCommitLine, formatReleaseNotes } from '../../shared/src/formatting.js';
import { createGit, refExists, getCommitsBetweenWithMerges } from '../../shared/src/git.js';

/**
 * Generate release notes between a previous tag and a branch
 *
 * Uses --first-parent to follow the main branch history, then expands
 * merge commits to show the commits that were merged. This handles the
 * case where tags may be placed on commits that are not on the main
 * branch's direct history.
 *
 * @param {Object} options
 * @param {string} options.previousTag - The previous tag to compare against
 * @param {string} options.repoUrl - Repository URL for creating links
 * @param {string} options.branch - Branch to get commits from (default: 'master')
 * @param {string} options.baseDir - Git repository base directory
 * @returns {Promise<Object>} - { releaseNotes, newVersion, commits }
 */
export async function generateReleaseNotes({
  previousTag,
  repoUrl,
  branch = 'master',
  baseDir = process.cwd(),
}) {
  const git = createGit(baseDir);

  // Validate that the previous tag exists
  const tagExists = await refExists(git, previousTag);
  if (!tagExists) {
    throw new Error(`Tag '${previousTag}' does not exist`);
  }

  // Get commits between the tag and the branch using first-parent
  // This correctly handles the case where the tag is on a diverged commit
  const commits = await getCommitsBetweenWithMerges(git, previousTag, branch);

  // Format the release notes
  const releaseNotes = formatReleaseNotes(commits, repoUrl);

  // Calculate new version
  const newVersion = incrementPatch(previousTag);

  return {
    releaseNotes,
    newVersion,
    commits,
    hasNewCommits: commits.length > 0,
  };
}

/**
 * Compute the Bugsnag app version
 * Returns the new version if there are commits, otherwise returns the previous tag
 *
 * @param {string} newVersion - The incremented version
 * @param {string} previousTag - The previous tag
 * @param {boolean} hasNewCommits - Whether there are new commits
 * @returns {string} - The app version to use for Bugsnag
 */
export function computeBugsnagVersion(newVersion, previousTag, hasNewCommits) {
  return hasNewCommits ? newVersion : previousTag;
}

export { formatCommitLine, formatReleaseNotes };
