/**
 * Release notes generation utilities
 */

import { createGit, getCommitsBetween, refExists } from '../../shared/src/git.js';
import { formatReleaseNotes, formatCommitLine } from '../../shared/src/formatting.js';
import { incrementPatch } from '../../shared/src/version.js';

/**
 * Generate release notes between a previous tag and a branch
 * 
 * @param {Object} options
 * @param {string} options.previousTag - The previous tag to compare against
 * @param {string} options.repoUrl - Repository URL for creating links
 * @param {string} options.branch - Branch to get commits from (default: 'master')
 * @param {string} options.baseDir - Git repository base directory
 * @returns {Promise<Object>} - { releaseNotes, newVersion, commits }
 */
export async function generateReleaseNotes({ previousTag, repoUrl, branch = 'master', baseDir = process.cwd() }) {
  const git = createGit(baseDir);
  
  // Validate that the previous tag exists
  const tagExists = await refExists(git, previousTag);
  if (!tagExists) {
    throw new Error(`Tag '${previousTag}' does not exist`);
  }
  
  // Get commits between the tag and the branch
  const commits = await getCommitsBetween(git, previousTag, branch);
  
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
