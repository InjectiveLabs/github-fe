/**
 * Git utilities for GitHub Actions
 * Handles git operations like fetching commits using simple-git
 */

import { simpleGit } from 'simple-git';

/**
 * Create a simple-git instance
 *
 * @param {string} baseDir - Base directory for git operations (defaults to cwd)
 * @returns {SimpleGit} - simple-git instance
 */
export function createGit(baseDir = process.cwd()) {
  return simpleGit(baseDir);
}

/**
 * Get the commit date (Unix timestamp) for a given tag or ref
 *
 * @param {SimpleGit} git - simple-git instance
 * @param {string} ref - Git reference (tag, branch, or commit)
 * @returns {Promise<number>} - Unix timestamp
 */
export async function getCommitDate(git, ref) {
  const log = await git.log({
    from: ref,
    to: ref,
    maxCount: 1,
    format: { timestamp: '%ct' },
  });

  if (!log.latest) {
    throw new Error(`Could not get commit date for ref: ${ref}`);
  }

  return parseInt(log.latest.timestamp, 10);
}

/**
 * Check if a git reference exists
 *
 * @param {SimpleGit} git - simple-git instance
 * @param {string} ref - Git reference to check
 * @returns {Promise<boolean>} - True if ref exists
 */
export async function refExists(git, ref) {
  try {
    await git.revparse(['--verify', ref]);

    return true;
  } catch {
    return false;
  }
}

/**
 * Get commits from a branch since a given ref/tag
 *
 * @param {SimpleGit} git - simple-git instance
 * @param {string} branch - Branch name
 * @param {string} sinceRef - Reference to start from (e.g., tag name)
 * @returns {Promise<Array<Object>>} - Array of commit objects
 */
export async function getCommitsSince(git, branch, sinceRef) {
  try {
    const log = await git.log({
      from: sinceRef,
      to: branch,
      format: {
        hash: '%H',
        timestamp: '%ct',
        message: '%s',
        authorName: '%an',
        authorEmail: '%ae',
      },
    });

    return log.all.map((commit) => ({
      hash: commit.hash,
      timestamp: parseInt(commit.timestamp, 10),
      message: commit.message,
      authorName: commit.authorName,
      authorEmail: commit.authorEmail,
    }));
  } catch (error) {
    console.warn(`Warning: git log failed: ${error.message}`);

    return [];
  }
}

/**
 * Get commits between two refs (exclusive of the 'from' ref)
 * This is useful for generating release notes between tags
 *
 * @param {SimpleGit} git - simple-git instance
 * @param {string} fromRef - Starting reference (exclusive)
 * @param {string} toRef - Ending reference (inclusive)
 * @param {Object} options - Additional options
 * @param {boolean} options.firstParent - Only follow first parent (useful for merge commits)
 * @returns {Promise<Array<Object>>} - Array of commit objects
 */
export async function getCommitsBetween(git, fromRef, toRef, options = {}) {
  try {
    const logOptions = {
      from: fromRef,
      to: toRef,
      format: {
        hash: '%H',
        timestamp: '%ct',
        message: '%s',
        authorName: '%an',
        authorEmail: '%ae',
      },
    };

    // Add --first-parent flag if requested
    // This only follows the first parent of merge commits, which gives us
    // the direct history on the target branch without diving into merged branches
    if (options.firstParent) {
      logOptions['--first-parent'] = null;
    }

    const log = await git.log(logOptions);

    return log.all.map((commit) => ({
      hash: commit.hash,
      timestamp: parseInt(commit.timestamp, 10),
      message: commit.message,
      authorName: commit.authorName,
      authorEmail: commit.authorEmail,
    }));
  } catch (error) {
    console.warn(`Warning: git log failed: ${error.message}`);

    return [];
  }
}

/**
 * Get commits between two refs, including commits from merged branches.
 * This finds the merge commit(s) between the refs using --first-parent,
 * then gets all commits within those merges.
 *
 * This is the correct way to get release notes when tags may be on
 * different branches than the target.
 *
 * IMPORTANT: When expanding merge commits, we filter commits to only include
 * those with timestamps AFTER the fromRef. This prevents old commits from
 * previous releases from being included when the dev branch has a longer
 * history than what's being released.
 *
 * @param {SimpleGit} git - simple-git instance
 * @param {string} fromRef - Starting reference (exclusive)
 * @param {string} toRef - Ending reference (inclusive)
 * @returns {Promise<Array<Object>>} - Array of commit objects
 */
export async function getCommitsBetweenWithMerges(git, fromRef, toRef) {
  try {
    // Get the timestamp of the fromRef (previous tag) to filter old commits
    const fromRefTimestamp = await getCommitDate(git, fromRef);

    // First, get the merge commits on the main branch history
    const mergeCommits = await getCommitsBetween(git, fromRef, toRef, { firstParent: true });

    if (mergeCommits.length === 0) {
      return [];
    }

    // For each merge commit that is a "Merge pull request" commit,
    // we need to get the commits that were merged
    const allCommits = [];
    const seenHashes = new Set();

    for (const commit of mergeCommits) {
      // Add the merge commit itself (if it's after the fromRef timestamp)
      if (!seenHashes.has(commit.hash) && commit.timestamp > fromRefTimestamp) {
        allCommits.push(commit);
        seenHashes.add(commit.hash);
      }

      // If this is a merge commit, get the commits from the merged branch
      if (commit.message.startsWith('Merge pull request')) {
        try {
          // Get the commits that were merged (second parent's history)
          // This uses the ^1..^2 range which gets commits reachable from
          // the second parent but not from the first parent
          const mergedCommits = await git.raw([
            'log',
            '--pretty=format:%H|%ct|%s|%an|%ae',
            `${commit.hash}^1..${commit.hash}^2`,
          ]);

          if (mergedCommits && mergedCommits.trim()) {
            for (const line of mergedCommits.trim().split('\n')) {
              const [hash, timestamp, message, authorName, authorEmail] = line.split('|');
              const commitTimestamp = parseInt(timestamp, 10);

              // Only include commits that are AFTER the fromRef timestamp
              // This filters out old commits from previous releases
              if (hash && !seenHashes.has(hash) && commitTimestamp > fromRefTimestamp) {
                allCommits.push({
                  hash,
                  timestamp: commitTimestamp,
                  message,
                  authorName,
                  authorEmail,
                });
                seenHashes.add(hash);
              }
            }
          }
        } catch {
          // Ignore errors for individual merge commits
          // This can happen if the merge commit doesn't have a second parent
        }
      }
    }

    return allCommits;
  } catch (error) {
    console.warn(`Warning: git log failed: ${error.message}`);

    return [];
  }
}

/**
 * Find the previous dev-to-master merge commit on the master branch.
 * This is useful when tags may be placed on commits that are not on the
 * master branch's first-parent history.
 *
 * @param {SimpleGit} git - simple-git instance
 * @param {string} branch - Branch to search on (default: 'master')
 * @param {string} currentHead - Current HEAD to start from
 * @returns {Promise<Object|null>} - The previous merge commit or null
 */
export async function findPreviousDevMerge(git, _branch = 'master', currentHead = 'HEAD') {
  try {
    // Get the first-parent history of the branch
    const result = await git.raw([
      'log',
      '--first-parent',
      '--pretty=format:%H|%s',
      '-n',
      '10', // Look at last 10 merge commits
      currentHead,
    ]);

    if (!result || !result.trim()) {
      return null;
    }

    const lines = result.trim().split('\n');

    // Skip the first one (current commit) and find the previous dev merge
    for (let i = 1; i < lines.length; i++) {
      const [hash, message] = lines[i].split('|');
      if (message && /^Merge pull request #\d+ from [^/]+\/dev$/i.test(message)) {
        return { hash, message };
      }
    }

    return null;
  } catch (error) {
    console.warn(`Warning: findPreviousDevMerge failed: ${error.message}`);

    return null;
  }
}

/**
 * Get the latest tag in the repository
 *
 * @param {SimpleGit} git - simple-git instance
 * @returns {Promise<string|null>} - Latest tag name or null
 */
export async function getLatestTag(git) {
  try {
    const tags = await git.tags(['--sort=-creatordate']);

    return tags.latest || null;
  } catch {
    return null;
  }
}
