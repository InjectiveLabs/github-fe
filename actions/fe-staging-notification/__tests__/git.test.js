import { tmpdir } from 'os';
import { join } from 'path';
import { unlinkSync, mkdtempSync, writeFileSync } from 'fs';
import { it, expect, describe, afterEach, beforeEach } from 'vitest';
import { getBranchName } from '../src/git.js';

describe('git', () => {
  describe('getBranchName', () => {
    const originalEnv = process.env;
    let tempDir;
    let eventFilePath;

    beforeEach(() => {
      process.env = { ...originalEnv };
      // Clear all branch-related env vars
      delete process.env.INPUT_BRANCH;
      delete process.env.GITHUB_HEAD_REF;
      delete process.env.GITHUB_REF_NAME;
      delete process.env.GITHUB_EVENT_PATH;
      
      // Create temp directory for event files
      tempDir = mkdtempSync(join(tmpdir(), 'git-test-'));
      eventFilePath = join(tempDir, 'event.json');
    });

    afterEach(() => {
      process.env = originalEnv;
      // Clean up temp file if exists
      try {
        unlinkSync(eventFilePath);
      } catch (_e) {
        // Ignore if file doesn't exist
      }
    });

    it('should return INPUT_BRANCH if set', () => {
      process.env.INPUT_BRANCH = 'feat/test-branch';
      expect(getBranchName()).toBe('feat/test-branch');
    });

    it('should read branch from GITHUB_EVENT_PATH workflow_dispatch inputs', () => {
      const eventData = {
        inputs: {
          branch: 'feat/from-event-file'
        }
      };
      writeFileSync(eventFilePath, JSON.stringify(eventData));
      process.env.GITHUB_EVENT_PATH = eventFilePath;
      
      expect(getBranchName()).toBe('feat/from-event-file');
    });

    it('should prefer INPUT_BRANCH over event file', () => {
      const eventData = {
        inputs: {
          branch: 'feat/from-event-file'
        }
      };
      writeFileSync(eventFilePath, JSON.stringify(eventData));
      process.env.GITHUB_EVENT_PATH = eventFilePath;
      process.env.INPUT_BRANCH = 'feat/from-input';
      
      expect(getBranchName()).toBe('feat/from-input');
    });

    it('should return GITHUB_HEAD_REF if INPUT_BRANCH and event not set', () => {
      process.env.GITHUB_HEAD_REF = 'feat/pr-branch';
      expect(getBranchName()).toBe('feat/pr-branch');
    });

    it('should return GITHUB_REF_NAME if others not set', () => {
      process.env.GITHUB_REF_NAME = 'main';
      expect(getBranchName()).toBe('main');
    });

    it('should prefer INPUT_BRANCH over all others', () => {
      process.env.INPUT_BRANCH = 'input-branch';
      process.env.GITHUB_HEAD_REF = 'head-ref';
      process.env.GITHUB_REF_NAME = 'ref-name';
      expect(getBranchName()).toBe('input-branch');
    });

    it('should throw error if no branch env var is set', () => {
      expect(() => getBranchName()).toThrow('Could not determine branch name');
    });

    it('should handle malformed event file gracefully', () => {
      writeFileSync(eventFilePath, 'not valid json');
      process.env.GITHUB_EVENT_PATH = eventFilePath;
      process.env.GITHUB_REF_NAME = 'fallback-branch';
      
      expect(getBranchName()).toBe('fallback-branch');
    });

    it('should handle event file without inputs gracefully', () => {
      const eventData = { action: 'opened' };
      writeFileSync(eventFilePath, JSON.stringify(eventData));
      process.env.GITHUB_EVENT_PATH = eventFilePath;
      process.env.GITHUB_REF_NAME = 'fallback-branch';
      
      expect(getBranchName()).toBe('fallback-branch');
    });
  });
});
