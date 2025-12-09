import { it, expect, describe } from 'vitest';
import { filterCommitsAfter } from '../src/git.js';

// Note: Git operations that require actual git calls (getCommitDate, refExists, getCommitsSince, getCommitsBetween)
// are tested in integration tests, not unit tests. This file tests the pure functions.

describe('git', () => {
  describe('filterCommitsAfter', () => {
    const baseTimestamp = 1700000000;
    
    const mockCommits = [
      { hash: 'aaa', timestamp: baseTimestamp, message: 'tag commit' },
      { hash: 'bbb', timestamp: baseTimestamp + 100, message: 'commit after tag' },
      { hash: 'ccc', timestamp: baseTimestamp + 200, message: 'another commit' },
      { hash: 'ddd', timestamp: baseTimestamp - 100, message: 'old commit before tag' },
    ];

    it('should filter commits after timestamp and skip first commit', () => {
      const result = filterCommitsAfter(mockCommits, baseTimestamp);
      
      expect(result).toHaveLength(2);
      expect(result[0].hash).toBe('bbb');
      expect(result[1].hash).toBe('ccc');
    });

    it('should exclude commits with timestamp equal to or before the given timestamp', () => {
      const result = filterCommitsAfter(mockCommits, baseTimestamp);
      
      expect(result.find(c => c.hash === 'aaa')).toBeUndefined();
      expect(result.find(c => c.hash === 'ddd')).toBeUndefined();
    });

    it('should return empty array for empty input', () => {
      expect(filterCommitsAfter([], baseTimestamp)).toEqual([]);
    });

    it('should return empty array for null/undefined input', () => {
      expect(filterCommitsAfter(null, baseTimestamp)).toEqual([]);
      expect(filterCommitsAfter(undefined, baseTimestamp)).toEqual([]);
    });

    it('should return empty array if only one commit (the tag commit)', () => {
      const singleCommit = [{ hash: 'aaa', timestamp: baseTimestamp, message: 'tag commit' }];
      expect(filterCommitsAfter(singleCommit, baseTimestamp)).toEqual([]);
    });

    it('should return empty array if no commits after timestamp', () => {
      const oldCommits = [
        { hash: 'aaa', timestamp: baseTimestamp, message: 'tag commit' },
        { hash: 'bbb', timestamp: baseTimestamp - 100, message: 'old commit' },
      ];
      expect(filterCommitsAfter(oldCommits, baseTimestamp)).toEqual([]);
    });
  });
});
