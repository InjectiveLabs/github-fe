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
    
    return log.all.map(commit => ({
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
 * @returns {Promise<Array<Object>>} - Array of commit objects
 */
export async function getCommitsBetween(git, fromRef, toRef) {
  try {
    const log = await git.log({
      from: fromRef,
      to: toRef,
      format: {
        hash: '%H',
        timestamp: '%ct',
        message: '%s',
        authorName: '%an',
        authorEmail: '%ae',
      },
    });
    
    return log.all.map(commit => ({
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

/**
 * Filter commits to only include those after a specific timestamp
 * Also excludes the first commit (which is typically the tag commit itself)
 * 
 * @param {Array<Object>} commits - Array of commit objects
 * @param {number} afterTimestamp - Only include commits after this timestamp
 * @returns {Array<Object>} - Filtered commits
 */
export function filterCommitsAfter(commits, afterTimestamp) {
  if (!commits || commits.length === 0) {
    return [];
  }
  
  // Skip the first commit (tag commit) and filter by timestamp
  return commits.slice(1).filter(commit => commit.timestamp > afterTimestamp);
}
