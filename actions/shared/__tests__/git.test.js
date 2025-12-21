import { it, vi, expect, describe } from 'vitest';
import { refExists, getCommitDate, getCommitsBetweenWithMerges } from '../src/git.js';

/**
 * Tests for git utilities focusing on the timestamp-based filtering
 * that prevents old commits from previous releases being included.
 *
 * The key fix: When expanding merge commits (like "Merge pull request from org/dev"),
 * we filter out commits with timestamps <= the previous tag timestamp.
 */

describe('git', () => {
  describe('getCommitsBetweenWithMerges', () => {
    // Mock simple-git instance
    const createMockGit = (options = {}) => {
      const { tagTimestamp = 1700000000, mergeCommits = [], expandedCommits = {} } = options;

      return {
        log: vi.fn().mockImplementation((args) => {
          // Mock getCommitDate call - git.log([ref, '-1', '--format=%ct'])
          if (
            Array.isArray(args) &&
            args.length === 3 &&
            args[1] === '-1' &&
            args[2] === '--format=%ct'
          ) {
            return Promise.resolve({
              latest: { hash: String(tagTimestamp) },
            });
          }

          // Mock getCommitsBetween call (first-parent merge commits)
          return Promise.resolve({ all: mergeCommits });
        }),
        raw: vi.fn().mockImplementation((args) => {
          // Mock expanded commits for merge commit
          const commitHash = args[2]?.split('^')[0];

          return Promise.resolve(expandedCommits[commitHash] || '');
        }),
        revparse: vi.fn().mockResolvedValue('abc123'),
      };
    };

    it('should filter out commits older than the previous tag timestamp', async () => {
      const tagTimestamp = 1700000000;

      const mockGit = createMockGit({
        tagTimestamp,
        mergeCommits: [
          {
            hash: 'merge123',
            timestamp: tagTimestamp + 500,
            message: 'Merge pull request #100 from org/dev',
            authorName: 'Author',
            authorEmail: 'author@test.com',
          },
        ],
        expandedCommits: {
          merge123: [
            // New commit - should be included
            `new111|${tagTimestamp + 100}|feat: new feature|Author|author@test.com`,
            // Old commit - should be filtered out
            `old222|${tagTimestamp - 100}|fix: old fix|Author|author@test.com`,
            // Commit at exact tag time - should be filtered out
            `exact333|${tagTimestamp}|chore: at tag time|Author|author@test.com`,
          ].join('\n'),
        },
      });

      const result = await getCommitsBetweenWithMerges(mockGit, 'v1.0.0', 'master');

      // Should include: merge commit + new commit only
      expect(result).toHaveLength(2);
      expect(result.map((c) => c.hash)).toContain('merge123');
      expect(result.map((c) => c.hash)).toContain('new111');

      // Should NOT include old commits
      expect(result.map((c) => c.hash)).not.toContain('old222');
      expect(result.map((c) => c.hash)).not.toContain('exact333');
    });

    it('should include multiple new commits from expanded merge', async () => {
      const tagTimestamp = 1700000000;

      const mockGit = createMockGit({
        tagTimestamp,
        mergeCommits: [
          {
            hash: 'merge123',
            timestamp: tagTimestamp + 1000,
            message: 'Merge pull request #100 from org/dev',
            authorName: 'Author',
            authorEmail: 'author@test.com',
          },
        ],
        expandedCommits: {
          merge123: [
            `commit1|${tagTimestamp + 100}|feat: feature 1|Author|a@test.com`,
            `commit2|${tagTimestamp + 200}|feat: feature 2|Author|a@test.com`,
            `commit3|${tagTimestamp + 300}|fix: bug fix|Author|a@test.com`,
          ].join('\n'),
        },
      });

      const result = await getCommitsBetweenWithMerges(mockGit, 'v1.0.0', 'master');

      // Should include merge commit + all 3 new commits
      expect(result).toHaveLength(4);
      expect(result.map((c) => c.hash)).toEqual(['merge123', 'commit1', 'commit2', 'commit3']);
    });

    it('should filter out merge commit itself if older than tag', async () => {
      const tagTimestamp = 1700000000;

      const mockGit = createMockGit({
        tagTimestamp,
        mergeCommits: [
          {
            hash: 'oldMerge',
            timestamp: tagTimestamp - 100, // Merge commit is older than tag
            message: 'Merge pull request #99 from org/dev',
            authorName: 'Author',
            authorEmail: 'author@test.com',
          },
        ],
        expandedCommits: {
          oldMerge: `new111|${tagTimestamp + 100}|feat: new|Author|a@test.com`,
        },
      });

      const result = await getCommitsBetweenWithMerges(mockGit, 'v1.0.0', 'master');

      // Only the new expanded commit should be included, not the old merge commit
      expect(result).toHaveLength(1);
      expect(result[0].hash).toBe('new111');
    });

    it('should return empty array when no merge commits found', async () => {
      const mockGit = createMockGit({
        tagTimestamp: 1700000000,
        mergeCommits: [],
      });

      const result = await getCommitsBetweenWithMerges(mockGit, 'v1.0.0', 'master');

      expect(result).toEqual([]);
    });

    it('should handle non-PR merge commits without expansion', async () => {
      const tagTimestamp = 1700000000;

      const mockGit = createMockGit({
        tagTimestamp,
        mergeCommits: [
          {
            hash: 'direct123',
            timestamp: tagTimestamp + 100,
            message: 'feat: direct commit to master',
            authorName: 'Author',
            authorEmail: 'author@test.com',
          },
        ],
      });

      const result = await getCommitsBetweenWithMerges(mockGit, 'v1.0.0', 'master');

      // Should include the direct commit without trying to expand
      expect(result).toHaveLength(1);
      expect(result[0].hash).toBe('direct123');
      expect(mockGit.raw).not.toHaveBeenCalled();
    });

    it('should deduplicate commits by hash', async () => {
      const tagTimestamp = 1700000000;

      const mockGit = createMockGit({
        tagTimestamp,
        mergeCommits: [
          {
            hash: 'merge1',
            timestamp: tagTimestamp + 500,
            message: 'Merge pull request #100 from org/feat',
            authorName: 'Author',
            authorEmail: 'author@test.com',
          },
          {
            hash: 'merge2',
            timestamp: tagTimestamp + 600,
            message: 'Merge pull request #101 from org/fix',
            authorName: 'Author',
            authorEmail: 'author@test.com',
          },
        ],
        expandedCommits: {
          merge1: `shared|${tagTimestamp + 100}|shared commit|Author|a@test.com`,
          merge2: `shared|${tagTimestamp + 100}|shared commit|Author|a@test.com`, // Same hash
        },
      });

      const result = await getCommitsBetweenWithMerges(mockGit, 'v1.0.0', 'master');

      // Should have 3 commits: merge1, merge2, shared (not duplicated)
      expect(result).toHaveLength(3);
      expect(result.filter((c) => c.hash === 'shared')).toHaveLength(1);
    });

    it('should handle empty expanded commits gracefully', async () => {
      const tagTimestamp = 1700000000;

      const mockGit = createMockGit({
        tagTimestamp,
        mergeCommits: [
          {
            hash: 'merge123',
            timestamp: tagTimestamp + 500,
            message: 'Merge pull request #100 from org/dev',
            authorName: 'Author',
            authorEmail: 'author@test.com',
          },
        ],
        expandedCommits: {
          merge123: '', // No expanded commits
        },
      });

      const result = await getCommitsBetweenWithMerges(mockGit, 'v1.0.0', 'master');

      // Should just include the merge commit
      expect(result).toHaveLength(1);
      expect(result[0].hash).toBe('merge123');
    });
  });

  describe('refExists', () => {
    it('should return true when ref exists', async () => {
      const mockGit = {
        revparse: vi.fn().mockResolvedValue('abc123'),
      };

      const result = await refExists(mockGit, 'v1.0.0');
      expect(result).toBe(true);
      expect(mockGit.revparse).toHaveBeenCalledWith(['--verify', 'v1.0.0']);
    });

    it('should return false when ref does not exist', async () => {
      const mockGit = {
        revparse: vi.fn().mockRejectedValue(new Error('not found')),
      };

      const result = await refExists(mockGit, 'v999.0.0');
      expect(result).toBe(false);
    });
  });

  describe('getCommitDate', () => {
    it('should return timestamp for valid ref', async () => {
      const mockGit = {
        log: vi.fn().mockResolvedValue({
          latest: { hash: '1700000000' },
        }),
      };

      const result = await getCommitDate(mockGit, 'v1.0.0');
      expect(result).toBe(1700000000);
    });

    it('should throw error when ref has no commit', async () => {
      const mockGit = {
        log: vi.fn().mockResolvedValue({ latest: null }),
      };

      await expect(getCommitDate(mockGit, 'invalid')).rejects.toThrow(
        'Could not get commit date for ref: invalid'
      );
    });
  });
});
