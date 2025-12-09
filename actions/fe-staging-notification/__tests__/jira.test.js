import { it, vi, expect, describe, beforeEach } from 'vitest';
import { JIRA_PATTERN, JIRA_BASE_URL, generateJiraLinks, extractJiraTickets } from '../src/jira.js';

// Mock @actions/exec
vi.mock('@actions/exec', () => ({
  exec: vi.fn(),
}));

import { exec } from '@actions/exec';

describe('jira', () => {
  describe('generateJiraLinks', () => {
    it('should return empty string for empty array', () => {
      expect(generateJiraLinks([])).toBe('');
    });

    it('should return empty string for null', () => {
      expect(generateJiraLinks(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(generateJiraLinks(undefined)).toBe('');
    });

    it('should generate single link', () => {
      const result = generateJiraLinks(['IL-1234']);
      expect(result).toBe(`<${JIRA_BASE_URL}/IL-1234|IL-1234>`);
    });

    it('should generate multiple links', () => {
      const result = generateJiraLinks(['IL-1234', 'IL-5678']);
      expect(result).toBe(
        `<${JIRA_BASE_URL}/IL-1234|IL-1234>, <${JIRA_BASE_URL}/IL-5678|IL-5678>`
      );
    });

    it('should handle tickets with different digit lengths', () => {
      const result = generateJiraLinks(['IL-123', 'IL-12345']);
      expect(result).toContain('IL-123');
      expect(result).toContain('IL-12345');
    });
  });

  describe('JIRA_PATTERN', () => {
    it('should match IL- followed by 3-5 digits', () => {
      expect('IL-123'.match(JIRA_PATTERN)).toEqual(['IL-123']);
      expect('IL-1234'.match(JIRA_PATTERN)).toEqual(['IL-1234']);
      expect('IL-12345'.match(JIRA_PATTERN)).toEqual(['IL-12345']);
    });

    it('should be case insensitive', () => {
      expect('il-1234'.match(JIRA_PATTERN)).toEqual(['il-1234']);
      expect('Il-1234'.match(JIRA_PATTERN)).toEqual(['Il-1234']);
    });

    it('should not match IL- with less than 3 digits', () => {
      expect('IL-12'.match(JIRA_PATTERN)).toBeNull();
    });

    it('should not match IL- with more than 5 digits', () => {
      // It will match the first 5 digits
      const match = 'IL-123456'.match(JIRA_PATTERN);
      expect(match[0]).toBe('IL-12345');
    });

    it('should find multiple tickets in text', () => {
      const text = 'Working on IL-1234 and IL-5678';
      expect(text.match(JIRA_PATTERN)).toEqual(['IL-1234', 'IL-5678']);
    });
  });

  describe('extractJiraTickets', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should extract tickets from git log output', async () => {
      // Mock git fetch to succeed
      exec.mockImplementationOnce(() => Promise.resolve(0));
      
      // Mock git log to return commit messages with tickets
      exec.mockImplementationOnce((cmd, args, options) => {
        options.listeners.stdout(Buffer.from('abc1234 IL-1234 Fix bug\ndef5678 IL-5678 Add feature'));

        return Promise.resolve(0);
      });

      const tickets = await extractJiraTickets();
      expect(tickets).toEqual(['IL-1234', 'IL-5678']);
    });

    it('should deduplicate tickets', async () => {
      exec.mockImplementationOnce(() => Promise.resolve(0));
      exec.mockImplementationOnce((cmd, args, options) => {
        options.listeners.stdout(Buffer.from('abc1234 IL-1234 Fix\ndef5678 IL-1234 Also fix'));

        return Promise.resolve(0);
      });

      const tickets = await extractJiraTickets();
      expect(tickets).toEqual(['IL-1234']);
    });

    it('should return empty array when no commits found', async () => {
      exec.mockImplementationOnce(() => Promise.resolve(0));
      exec.mockImplementationOnce(() => Promise.reject(new Error('No commits')));

      const tickets = await extractJiraTickets();
      expect(tickets).toEqual([]);
    });

    it('should return empty array when no tickets in commits', async () => {
      exec.mockImplementationOnce(() => Promise.resolve(0));
      exec.mockImplementationOnce((cmd, args, options) => {
        options.listeners.stdout(Buffer.from('abc1234 Fix some bug\ndef5678 Add feature'));

        return Promise.resolve(0);
      });

      const tickets = await extractJiraTickets();
      expect(tickets).toEqual([]);
    });

    it('should continue if git fetch fails', async () => {
      // Git fetch fails
      exec.mockImplementationOnce(() => Promise.reject(new Error('fetch failed')));
      
      // Git log still works
      exec.mockImplementationOnce((cmd, args, options) => {
        options.listeners.stdout(Buffer.from('abc1234 IL-9999 Fix'));

        return Promise.resolve(0);
      });

      const tickets = await extractJiraTickets();
      expect(tickets).toEqual(['IL-9999']);
    });

    it('should uppercase tickets', async () => {
      exec.mockImplementationOnce(() => Promise.resolve(0));
      exec.mockImplementationOnce((cmd, args, options) => {
        options.listeners.stdout(Buffer.from('abc1234 il-1234 Fix'));

        return Promise.resolve(0);
      });

      const tickets = await extractJiraTickets();
      expect(tickets).toEqual(['IL-1234']);
    });
  });
});
