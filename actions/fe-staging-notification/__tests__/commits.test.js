import { tmpdir } from 'os';
import { join } from 'path';
import { unlinkSync, mkdtempSync, writeFileSync } from 'fs';
import { it, expect, describe, afterEach, beforeEach } from 'vitest';
import { getCommitMessages } from '../src/commits.js';

describe('commits', () => {
  describe('getCommitMessages', () => {
    const originalEnv = process.env;
    let tempDir;
    let eventFilePath;

    beforeEach(() => {
      process.env = { ...originalEnv };
      delete process.env.GITHUB_EVENT_PATH;
      tempDir = mkdtempSync(join(tmpdir(), 'commits-test-'));
      eventFilePath = join(tempDir, 'event.json');
    });

    afterEach(() => {
      process.env = originalEnv;
      try {
        unlinkSync(eventFilePath);
      } catch (_e) {
        // Ignore
      }
    });

    it('should return empty array when no event path', () => {
      expect(getCommitMessages()).toEqual([]);
    });

    it('should extract commit messages from push event', () => {
      const eventData = {
        commits: [
          { message: 'feat: add login INJ-142' },
          { message: 'fix: resolve SEC-146 bug' },
        ],
      };
      writeFileSync(eventFilePath, JSON.stringify(eventData));
      process.env.GITHUB_EVENT_PATH = eventFilePath;

      expect(getCommitMessages()).toEqual([
        'feat: add login INJ-142',
        'fix: resolve SEC-146 bug',
      ]);
    });

    it('should extract PR title and body from PR event', () => {
      const eventData = {
        pull_request: {
          title: 'feat: new feature INJ-100',
          body: 'Closes INJ-101 and INJ-102',
        },
      };
      writeFileSync(eventFilePath, JSON.stringify(eventData));
      process.env.GITHUB_EVENT_PATH = eventFilePath;

      expect(getCommitMessages()).toEqual([
        'feat: new feature INJ-100',
        'Closes INJ-101 and INJ-102',
      ]);
    });

    it('should filter out null/empty messages from commits', () => {
      const eventData = {
        commits: [
          { message: 'feat: something' },
          { message: '' },
          { message: null },
          { message: 'fix: another' },
        ],
      };
      writeFileSync(eventFilePath, JSON.stringify(eventData));
      process.env.GITHUB_EVENT_PATH = eventFilePath;

      expect(getCommitMessages()).toEqual([
        'feat: something',
        'fix: another',
      ]);
    });

    it('should handle PR event with no body', () => {
      const eventData = {
        pull_request: {
          title: 'feat: title only',
        },
      };
      writeFileSync(eventFilePath, JSON.stringify(eventData));
      process.env.GITHUB_EVENT_PATH = eventFilePath;

      expect(getCommitMessages()).toEqual(['feat: title only']);
    });

    it('should return empty array for malformed JSON', () => {
      writeFileSync(eventFilePath, 'not json');
      process.env.GITHUB_EVENT_PATH = eventFilePath;

      expect(getCommitMessages()).toEqual([]);
    });

    it('should return empty array for empty commits', () => {
      const eventData = { commits: [] };
      writeFileSync(eventFilePath, JSON.stringify(eventData));
      process.env.GITHUB_EVENT_PATH = eventFilePath;

      expect(getCommitMessages()).toEqual([]);
    });

    it('should return empty array for unrecognized event type', () => {
      const eventData = { action: 'labeled' };
      writeFileSync(eventFilePath, JSON.stringify(eventData));
      process.env.GITHUB_EVENT_PATH = eventFilePath;

      expect(getCommitMessages()).toEqual([]);
    });
  });
});
