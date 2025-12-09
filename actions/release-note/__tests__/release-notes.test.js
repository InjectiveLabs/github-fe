import { it, expect, describe } from 'vitest';
import { formatCommitLine, formatReleaseNotes, computeBugsnagVersion } from '../src/release-notes.js';

// Real commit data from InjectiveLabs/injective-helix repository
const REAL_COMMITS = {
  copyChange: { 
    hash: 'f09968a6989cd77df646cf0306ae3b5f68b05ce5', 
    message: 'chore: copy change', 
    authorName: 'thomasRalee',
    authorEmail: '12345+thomasRalee@users.noreply.github.com'
  },
  mergePR2318: { 
    hash: '9fadb5c17be12b0234fe344bed0140c2f68dabb3', 
    message: 'Merge pull request #2318 from InjectiveLabs/feat/add-support-to-query-seda-pricefeed-for-24/5-markets-IL-2390', 
    authorName: 'ThomasRalee',
    authorEmail: 'ThomasRalee@users.noreply.github.com'
  },
  oracleSlash: { 
    hash: 'ed4a581f3bdf850787af8d8597e3f78a3c60f304', 
    message: 'fix: handle edge case of when market oracle base includes /', 
    authorName: 'thomasRalee',
    authorEmail: 'thomasRalee@users.noreply.github.com'
  },
  packageBump: { 
    hash: '629aaa7abc1234567890abcdef1234567890abcd', 
    message: 'chore: package bump', 
    authorName: 'ThomasRalee',
    authorEmail: 'ThomasRalee@users.noreply.github.com'
  },
  sedaPricefeed: { 
    hash: '5796f4523293b5c8de60c014fb96ba3b2660497f', 
    message: 'feat: add support to query seda pricefeed for market is_open for 24/5 markets - IL-2390', 
    authorName: 'thomasRalee',
    authorEmail: 'thomasRalee@users.noreply.github.com'
  },
};

const REPO_URL = 'https://github.com/InjectiveLabs/injective-helix';

describe('release-notes', () => {
  describe('computeBugsnagVersion', () => {
    it('should return new version when there are new commits', () => {
      expect(computeBugsnagVersion('v1.17.13', 'v1.17.12', true)).toBe('v1.17.13');
    });

    it('should return previous tag when there are no new commits', () => {
      expect(computeBugsnagVersion('v1.17.13', 'v1.17.12', false)).toBe('v1.17.12');
    });

    it('should handle version without v prefix', () => {
      expect(computeBugsnagVersion('v1.0.1', '1.0.0', true)).toBe('v1.0.1');
      expect(computeBugsnagVersion('v1.0.1', '1.0.0', false)).toBe('1.0.0');
    });
  });

  describe('formatCommitLine', () => {
    it('should format a simple commit correctly', () => {
      const result = formatCommitLine(REAL_COMMITS.copyChange, REPO_URL);
      
      expect(result).toMatch(/^- \[f09968a\]/);
      expect(result).toContain(`${REPO_URL}/commit/${REAL_COMMITS.copyChange.hash}`);
      expect(result).toContain('chore: copy change');
      expect(result).toContain('by @thomasRalee');
    });

    it('should format a merge commit with PR number', () => {
      const result = formatCommitLine(REAL_COMMITS.mergePR2318, REPO_URL);
      
      expect(result).toContain('[9fadb5c]');
      expect(result).toContain('Merge pull request #2318');
      expect(result).toContain(`in [#2318](${REPO_URL}/pull/2318)`);
      expect(result).toContain('by @ThomasRalee');
    });

    it('should handle commit message with special character /', () => {
      const result = formatCommitLine(REAL_COMMITS.oracleSlash, REPO_URL);
      
      expect(result).toContain('[ed4a581]');
      expect(result).toContain('fix: handle edge case of when market oracle base includes /');
    });

    it('should handle commit with Jira ticket in message', () => {
      const result = formatCommitLine(REAL_COMMITS.sedaPricefeed, REPO_URL);
      
      expect(result).toContain('IL-2390');
      expect(result).toContain('feat: add support to query seda pricefeed');
    });
  });

  describe('formatReleaseNotes', () => {
    it('should format multiple commits as release notes', () => {
      const commits = [
        REAL_COMMITS.copyChange,
        REAL_COMMITS.mergePR2318,
        REAL_COMMITS.oracleSlash,
        REAL_COMMITS.packageBump,
        REAL_COMMITS.sedaPricefeed,
      ];
      
      const result = formatReleaseNotes(commits, REPO_URL);
      const lines = result.split('\n');
      
      expect(lines).toHaveLength(5);
      
      // Verify order is preserved
      expect(lines[0]).toContain('chore: copy change');
      expect(lines[1]).toContain('Merge pull request #2318');
      expect(lines[2]).toContain('fix: handle edge case');
      expect(lines[3]).toContain('chore: package bump');
      expect(lines[4]).toContain('feat: add support to query seda pricefeed');
    });

    it('should return "No new commits" for empty array', () => {
      expect(formatReleaseNotes([], REPO_URL)).toBe('No new commits');
    });

    it('should include PR links in release notes', () => {
      const commits = [REAL_COMMITS.mergePR2318];
      const result = formatReleaseNotes(commits, REPO_URL);
      
      expect(result).toContain(`[#2318](${REPO_URL}/pull/2318)`);
    });

    it('should format GitHub-style release notes compatible with markdown', () => {
      const commits = [REAL_COMMITS.copyChange];
      const result = formatReleaseNotes(commits, REPO_URL);
      
      // Should be a markdown list item
      expect(result).toMatch(/^- \[/);
      
      // Should have markdown link format
      expect(result).toMatch(/\[f09968a\]\(https:\/\//);
    });
  });
});
