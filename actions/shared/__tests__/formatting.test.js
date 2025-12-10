import { it, expect, describe } from 'vitest';
import {
  COMMITS,
  AUTHORS,
  REPO_URL,
  PR_2322_COMMITS,
  PR_2322_EXTENDED,
  RELEASE_SCENARIOS,
  generateMockReleaseNotes,
} from './fixtures.js';
import {
  formatGitAuthor,
  extractPRNumber,
  isPRMergeCommit,
  formatCommitLine,
  formatReleaseNotes,
  isDevToMasterMerge,
  escapeCommitMessage,
  isBranchMergeCommit,
  filterOldMergeCommits,
  convertMarkdownToSlack,
} from '../src/formatting.js';

describe('formatting', () => {
  describe('convertMarkdownToSlack', () => {
    it('should convert a single commit link', () => {
      const markdown = `[f09968a](${REPO_URL}/commit/f09968a) - chore: copy change by @ThomasRalee`;
      const expected = `<${REPO_URL}/commit/f09968a|f09968a> - chore: copy change by @ThomasRalee`;
      expect(convertMarkdownToSlack(markdown)).toBe(expected);
    });

    it('should convert commit link with PR link', () => {
      const markdown = `[9fadb5c](${REPO_URL}/commit/9fadb5c) - Merge pull request #2318 by @ThomasRalee in [#2318](${REPO_URL}/pull/2318)`;
      const expected = `<${REPO_URL}/commit/9fadb5c|9fadb5c> - Merge pull request #2318 by @ThomasRalee in <${REPO_URL}/pull/2318|#2318>`;
      expect(convertMarkdownToSlack(markdown)).toBe(expected);
    });

    it('should convert multiple markdown links', () => {
      const markdown = `- [abc1234](${REPO_URL}/commit/abc1234) - first commit
- [def5678](${REPO_URL}/commit/def5678) - second commit in [#123](${REPO_URL}/pull/123)`;

      const result = convertMarkdownToSlack(markdown);

      expect(result).toContain(`<${REPO_URL}/commit/abc1234|abc1234>`);
      expect(result).toContain(`<${REPO_URL}/commit/def5678|def5678>`);
      expect(result).toContain(`<${REPO_URL}/pull/123|#123>`);
      expect(result).not.toMatch(/\[.*\]\(.*\)/);
    });

    it('should handle text with special character /', () => {
      const releaseNotes = generateMockReleaseNotes([COMMITS.fixWithSlash]);
      const result = convertMarkdownToSlack(releaseNotes);

      expect(result).toContain('includes /');
      expect(result).not.toMatch(/\[.*\]\(.*\)/);
    });

    it('should handle text with special character >', () => {
      const releaseNotes = generateMockReleaseNotes([COMMITS.fixWithGreaterThanAndJira]);
      const result = convertMarkdownToSlack(releaseNotes);

      expect(result).toContain('trade form > tp sl form issues');
    });

    it('should handle text with + character', () => {
      const releaseNotes = generateMockReleaseNotes([COMMITS.fixWithPlusSign]);
      const result = convertMarkdownToSlack(releaseNotes);

      expect(result).toContain('direct number input + direct submit');
    });

    it('should convert large release notes with multiple commits', () => {
      const releaseNotes = generateMockReleaseNotes(RELEASE_SCENARIOS.largeRelease);
      const result = convertMarkdownToSlack(releaseNotes);

      // Should not contain any markdown links
      expect(result).not.toMatch(/\[.*\]\(.*\)/);

      // Should contain Slack-formatted links for all commits
      RELEASE_SCENARIOS.largeRelease.forEach((commit) => {
        const shortHash = commit.hash.substring(0, 7);
        expect(result).toContain(`<${REPO_URL}/commit/${commit.hash}|${shortHash}>`);
      });
    });

    it('should return empty string for null/undefined input', () => {
      expect(convertMarkdownToSlack(null)).toBe('');
      expect(convertMarkdownToSlack(undefined)).toBe('');
      expect(convertMarkdownToSlack('')).toBe('');
    });

    it('should handle text without any markdown links', () => {
      expect(convertMarkdownToSlack('No new commits')).toBe('No new commits');
      expect(convertMarkdownToSlack('Plain text message')).toBe('Plain text message');
    });
  });

  describe('escapeCommitMessage', () => {
    it('should escape backticks', () => {
      expect(escapeCommitMessage('fix: update `config` file')).toBe(
        'fix: update \\`config\\` file'
      );
    });

    it('should escape double quotes', () => {
      expect(escapeCommitMessage('fix: change "value" to "other"')).toBe(
        'fix: change \\"value\\" to \\"other\\"'
      );
    });

    it('should escape both backticks and quotes', () => {
      expect(escapeCommitMessage('fix: `value` is "broken"')).toBe(
        'fix: \\`value\\` is \\"broken\\"'
      );
    });

    it('should handle empty/null input', () => {
      expect(escapeCommitMessage('')).toBe('');
      expect(escapeCommitMessage(null)).toBe('');
      expect(escapeCommitMessage(undefined)).toBe('');
    });

    it('should not modify messages without special characters', () => {
      expect(escapeCommitMessage(COMMITS.fixSimple.message)).toBe('fix: minor');
      expect(escapeCommitMessage(COMMITS.chorePackageBump.message)).toBe('chore: package bump');
    });

    it('should handle real commit messages with special characters', () => {
      // These messages don't have backticks or quotes, so should pass through unchanged
      expect(escapeCommitMessage(COMMITS.fixWithSlash.message)).toBe(COMMITS.fixWithSlash.message);
      expect(escapeCommitMessage(COMMITS.fixWithGreaterThanAndJira.message)).toBe(
        COMMITS.fixWithGreaterThanAndJira.message
      );
    });
  });

  describe('formatGitAuthor', () => {
    it('should format GitHub noreply email to @username', () => {
      const { name, email, expectedFormat } = AUTHORS.thomasNoreply;
      expect(formatGitAuthor(name, email)).toBe(expectedFormat);
    });

    it('should handle ID+username noreply format', () => {
      const { name, email, expectedFormat } = AUTHORS.ivanNoreplyWithId;
      expect(formatGitAuthor(name, email)).toBe(expectedFormat);
    });

    it('should format username without spaces as @username (personal email)', () => {
      const { name, email, expectedFormat } = AUTHORS.thomasPersonal;
      expect(formatGitAuthor(name, email)).toBe(expectedFormat);
    });

    it('should format username without spaces as @username (corporate email)', () => {
      const { name, email, expectedFormat } = AUTHORS.arthurCorporate;
      expect(formatGitAuthor(name, email)).toBe(expectedFormat);
    });

    it('should format full name with email', () => {
      const { name, email, expectedFormat } = AUTHORS.fullNameAuthor;
      expect(formatGitAuthor(name, email)).toBe(expectedFormat);
    });

    it('should handle missing email for full name', () => {
      expect(formatGitAuthor('John Doe', null)).toBe('John Doe');
      expect(formatGitAuthor('John Doe', undefined)).toBe('John Doe');
    });

    it('should return unknown for missing author name', () => {
      expect(formatGitAuthor(null, 'email@example.com')).toBe('unknown');
      expect(formatGitAuthor(undefined, 'email@example.com')).toBe('unknown');
      expect(formatGitAuthor('', 'email@example.com')).toBe('unknown');
    });

    it('should handle all real authors from fixtures', () => {
      Object.values(AUTHORS).forEach((author) => {
        const result = formatGitAuthor(author.name, author.email);
        expect(result).toBe(author.expectedFormat);
      });
    });

    it('should handle bangjelkoski noreply email', () => {
      const { name, email, expectedFormat } = AUTHORS.bangjelkoskiNoreply;
      expect(formatGitAuthor(name, email)).toBe(expectedFormat);
    });

    it('should handle Frederick-88 with hyphen in username', () => {
      const { name, email, expectedFormat } = AUTHORS.frederickPersonal;
      expect(formatGitAuthor(name, email)).toBe(expectedFormat);
    });
  });

  describe('extractPRNumber', () => {
    it('should extract PR number from merge commit message', () => {
      expect(extractPRNumber(COMMITS.mergeDevToMaster.message)).toBe('2320');
    });

    it('should extract PR number from feature branch merge', () => {
      expect(extractPRNumber(COMMITS.mergeFeatureBranch.message)).toBe('2303');
    });

    it('should extract PR number from fix branch merge', () => {
      expect(extractPRNumber(COMMITS.mergeFixBranch.message)).toBe('2314');
    });

    it('should extract PR number from long branch name with Jira', () => {
      expect(extractPRNumber(COMMITS.mergeLongBranchWithJira.message)).toBe('2318');
    });

    it('should return null for non-merge commits', () => {
      expect(extractPRNumber(COMMITS.fixSimple.message)).toBeNull();
      expect(extractPRNumber(COMMITS.chorePackageBump.message)).toBeNull();
      expect(extractPRNumber(COMMITS.featWithJira.message)).toBeNull();
    });

    it('should return null for merge branch into feature (no PR)', () => {
      expect(extractPRNumber(COMMITS.mergeBranchIntoFeature.message)).toBeNull();
    });

    it('should handle empty/null input', () => {
      expect(extractPRNumber('')).toBeNull();
      expect(extractPRNumber(null)).toBeNull();
      expect(extractPRNumber(undefined)).toBeNull();
    });
  });

  describe('formatCommitLine', () => {
    it('should format a simple fix commit', () => {
      const result = formatCommitLine(COMMITS.fixSimple, REPO_URL);

      expect(result).toMatch(/^- \[c178bb6\]/);
      expect(result).toContain(`${REPO_URL}/commit/${COMMITS.fixSimple.hash}`);
      expect(result).toContain('fix: minor');
      expect(result).toContain('by @ThomasRalee');
    });

    it('should format a merge commit with PR link', () => {
      const result = formatCommitLine(COMMITS.mergeDevToMaster, REPO_URL);

      expect(result).toContain('[d01f2f9]');
      expect(result).toContain('Merge pull request #2320');
      expect(result).toContain(`in [#2320](${REPO_URL}/pull/2320)`);
    });

    it('should format a merge commit with feature branch', () => {
      const result = formatCommitLine(COMMITS.mergeFeatureBranch, REPO_URL);

      expect(result).toContain('Merge pull request #2303');
      expect(result).toContain('feat/megavault');
      expect(result).toContain(`in [#2303](${REPO_URL}/pull/2303)`);
    });

    it('should format a commit with GitHub noreply email', () => {
      const result = formatCommitLine(COMMITS.chorePackageBump, REPO_URL);

      expect(result).toContain('by @ThomasRalee');
    });

    it('should format a commit with corporate email', () => {
      const result = formatCommitLine(COMMITS.fixSlippage, REPO_URL);

      expect(result).toContain('by @0xA1337');
    });

    it('should handle commits with special characters in message', () => {
      const resultSlash = formatCommitLine(COMMITS.fixWithSlash, REPO_URL);
      expect(resultSlash).toContain('includes /');

      const resultGreaterThan = formatCommitLine(COMMITS.fixWithGreaterThanAndJira, REPO_URL);
      expect(resultGreaterThan).toContain('trade form > tp sl form issues');

      const resultPlus = formatCommitLine(COMMITS.fixWithPlusSign, REPO_URL);
      expect(resultPlus).toContain('direct number input + direct submit');
    });

    it('should handle commits with Jira tickets in parentheses', () => {
      const result = formatCommitLine(COMMITS.fixWithJiraParentheses, REPO_URL);

      expect(result).toContain('(IL-2360)');
    });

    it('should handle commits from all different authors', () => {
      const commits = [
        COMMITS.choreCopyChange, // ThomasRalee - personal email
        COMMITS.fixSlippage, // 0xA1337 - corporate email
        COMMITS.choreMinorAutosign, // ivan-angjelkoski - personal email
        COMMITS.fixWithPlusSign, // Frederick-88 - personal email
      ];

      commits.forEach((commit) => {
        const result = formatCommitLine(commit, REPO_URL);
        expect(result).toContain('by @');
        expect(result).toMatch(/^- \[/);
      });
    });
  });

  describe('formatReleaseNotes', () => {
    it('should format simple fix release', () => {
      const result = formatReleaseNotes(RELEASE_SCENARIOS.simpleFixRelease, REPO_URL);
      const lines = result.split('\n');

      // Only first merge commit + non-merge commits should be included
      expect(lines).toHaveLength(3);
      expect(lines[0]).toContain('Merge pull request #2320');
      expect(lines[1]).toContain('fix: minor');
      expect(lines[2]).toContain('chore: package bump');
    });

    it('should format feature release', () => {
      const result = formatReleaseNotes(RELEASE_SCENARIOS.featureRelease, REPO_URL);
      const lines = result.split('\n');

      expect(lines).toHaveLength(4);
      expect(result).toContain('feat/megavault');
      expect(result).toContain('deposit/withdraw flow');
    });

    it('should format release with multiple authors', () => {
      const result = formatReleaseNotes(RELEASE_SCENARIOS.mixedAuthorsRelease, REPO_URL);

      expect(result).toContain('@ThomasRalee');
      expect(result).toContain('@0xA1337');
      expect(result).toContain('@ivan-angjelkoski');
      expect(result).toContain('@Frederick-88');
    });

    it('should format release with Jira tickets', () => {
      const result = formatReleaseNotes(RELEASE_SCENARIOS.jiraTicketsRelease, REPO_URL);

      expect(result).toContain('IL-2390');
      expect(result).toContain('IL-2360');
      expect(result).toContain('IL-2382');
    });

    it('should format release with special characters', () => {
      const result = formatReleaseNotes(RELEASE_SCENARIOS.specialCharsRelease, REPO_URL);

      expect(result).toContain('includes /');
      expect(result).toContain('form > tp sl');
      expect(result).toContain('input + direct');
    });

    it('should keep feature branch merges in large release (only filter old dev merges)', () => {
      const result = formatReleaseNotes(RELEASE_SCENARIOS.largeRelease, REPO_URL);
      const lines = result.split('\n');

      // largeRelease has 10 commits with 2 merge commits:
      // - mergeDevToMaster (dev merge) - KEEP (first dev merge)
      // - mergeFeatureBranch (feature merge, not dev) - KEEP
      // All 10 commits should be kept since there's only 1 dev merge
      expect(lines).toHaveLength(10);

      // Both merge commits should be included (one is dev merge, one is feature merge)
      expect(result).toContain('Merge pull request #2320');
      expect(result).toContain('Merge pull request #2303');
    });

    it('should return "No new commits" for empty array', () => {
      expect(formatReleaseNotes([], REPO_URL)).toBe('No new commits');
    });

    it('should return "No new commits" for null/undefined', () => {
      expect(formatReleaseNotes(null, REPO_URL)).toBe('No new commits');
      expect(formatReleaseNotes(undefined, REPO_URL)).toBe('No new commits');
    });

    it('should include PR links for merge commits', () => {
      const result = formatReleaseNotes([COMMITS.mergeDevToMaster, COMMITS.fixSimple], REPO_URL);

      expect(result).toContain(`[#2320](${REPO_URL}/pull/2320)`);
    });

    it('should not include PR links for non-merge commits', () => {
      const result = formatReleaseNotes([COMMITS.fixSimple, COMMITS.chorePackageBump], REPO_URL);

      expect(result).not.toContain('[#');
      expect(result).not.toContain('/pull/');
    });
  });

  describe('isPRMergeCommit', () => {
    it('should return true for PR merge commits', () => {
      expect(isPRMergeCommit(COMMITS.mergeDevToMaster)).toBe(true);
      expect(isPRMergeCommit(COMMITS.mergeFeatureBranch)).toBe(true);
      expect(isPRMergeCommit(COMMITS.mergeFixBranch)).toBe(true);
      expect(isPRMergeCommit(COMMITS.mergeLongBranchWithJira)).toBe(true);
      expect(isPRMergeCommit(COMMITS.mergeChoreBranch)).toBe(true);
    });

    it('should return false for non-merge commits', () => {
      expect(isPRMergeCommit(COMMITS.fixSimple)).toBe(false);
      expect(isPRMergeCommit(COMMITS.chorePackageBump)).toBe(false);
      expect(isPRMergeCommit(COMMITS.featWithJira)).toBe(false);
    });

    it('should return false for branch merge commits (not PR)', () => {
      expect(isPRMergeCommit(COMMITS.mergeBranchIntoFeature)).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(isPRMergeCommit(null)).toBe(false);
      expect(isPRMergeCommit(undefined)).toBe(false);
      expect(isPRMergeCommit({ message: null })).toBe(false);
    });
  });

  describe('isDevToMasterMerge', () => {
    it('should return true for dev-to-master merge commits', () => {
      expect(isDevToMasterMerge(COMMITS.mergeDevToMaster)).toBe(true);
      expect(
        isDevToMasterMerge({ message: 'Merge pull request #2321 from InjectiveLabs/dev' })
      ).toBe(true);
      expect(isDevToMasterMerge({ message: 'Merge pull request #100 from someorg/dev' })).toBe(
        true
      );
    });

    it('should return false for feature branch merges', () => {
      expect(isDevToMasterMerge(COMMITS.mergeFeatureBranch)).toBe(false);
      expect(isDevToMasterMerge(COMMITS.mergeFixBranch)).toBe(false);
      expect(isDevToMasterMerge(COMMITS.mergeChoreBranch)).toBe(false);
      expect(isDevToMasterMerge(COMMITS.mergeLongBranchWithJira)).toBe(false);
    });

    it('should return false for branch merge commits', () => {
      expect(isDevToMasterMerge(COMMITS.mergeBranchIntoFeature)).toBe(false);
    });

    it('should return false for non-merge commits', () => {
      expect(isDevToMasterMerge(COMMITS.fixSimple)).toBe(false);
      expect(isDevToMasterMerge(COMMITS.chorePackageBump)).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(isDevToMasterMerge(null)).toBe(false);
      expect(isDevToMasterMerge(undefined)).toBe(false);
    });
  });

  describe('isBranchMergeCommit', () => {
    it('should return true for branch merge commits', () => {
      expect(isBranchMergeCommit(COMMITS.mergeBranchIntoFeature)).toBe(true);
    });

    it('should return false for PR merge commits', () => {
      expect(isBranchMergeCommit(COMMITS.mergeDevToMaster)).toBe(false);
      expect(isBranchMergeCommit(COMMITS.mergeFeatureBranch)).toBe(false);
    });

    it('should return false for non-merge commits', () => {
      expect(isBranchMergeCommit(COMMITS.fixSimple)).toBe(false);
      expect(isBranchMergeCommit(COMMITS.chorePackageBump)).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(isBranchMergeCommit(null)).toBe(false);
      expect(isBranchMergeCommit(undefined)).toBe(false);
    });
  });

  describe('filterOldMergeCommits', () => {
    it('should keep feature branch merges but filter old dev merges', () => {
      const commits = [
        COMMITS.mergeDevToMaster, // First dev merge - KEEP
        COMMITS.fixSimple, // Non-merge - KEEP
        COMMITS.mergeFeatureBranch, // Feature branch merge - KEEP (not a dev merge)
        COMMITS.chorePackageBump, // Non-merge - KEEP
        {
          hash: 'old1',
          message: 'Merge pull request #2319 from InjectiveLabs/dev',
          authorName: 'User',
          authorEmail: 'user@test.com',
        }, // Old dev merge - FILTER
      ];

      const result = filterOldMergeCommits(commits);

      expect(result).toHaveLength(4);
      expect(result[0]).toBe(COMMITS.mergeDevToMaster);
      expect(result[1]).toBe(COMMITS.fixSimple);
      expect(result[2]).toBe(COMMITS.mergeFeatureBranch);
      expect(result[3]).toBe(COMMITS.chorePackageBump);
    });

    it('should keep all non-merge commits', () => {
      const commits = [COMMITS.fixSimple, COMMITS.chorePackageBump, COMMITS.featWithJira];

      const result = filterOldMergeCommits(commits);

      expect(result).toHaveLength(3);
      expect(result).toEqual(commits);
    });

    it('should keep branch merge commits (they are useful context)', () => {
      const commits = [
        COMMITS.mergeDevToMaster,
        COMMITS.mergeBranchIntoFeature, // Branch merge - KEEP
        COMMITS.fixSimple,
      ];

      const result = filterOldMergeCommits(commits);

      expect(result).toHaveLength(3);
      expect(result).toEqual(commits);
    });

    it('should return empty array for empty input', () => {
      expect(filterOldMergeCommits([])).toEqual([]);
      expect(filterOldMergeCommits(null)).toEqual([]);
      expect(filterOldMergeCommits(undefined)).toEqual([]);
    });

    it('should handle single dev merge commit', () => {
      const commits = [COMMITS.mergeDevToMaster];
      const result = filterOldMergeCommits(commits);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(COMMITS.mergeDevToMaster);
    });

    it('should handle only non-merge commits', () => {
      const commits = [COMMITS.fixSimple, COMMITS.chorePackageBump];
      const result = filterOldMergeCommits(commits);

      expect(result).toEqual(commits);
    });

    // Real data test cases from PR #2322
    describe('PR #2322 real data', () => {
      it('should filter old dev merges from PR_2322_COMMITS', () => {
        const result = filterOldMergeCommits(PR_2322_COMMITS);

        // Should keep: current dev merge (#2323), chore branch merge (#2322), and the actual commit
        // Should filter: all old dev merges (#2321, #2320, #2319, #2316, #2315, #2311, #2310)
        expect(result).toHaveLength(3);

        // Verify kept commits
        expect(result[0].message).toBe('Merge pull request #2323 from InjectiveLabs/dev');
        expect(result[1].message).toBe(
          'Merge pull request #2322 from InjectiveLabs/chore/deploy-mv-mainnet'
        );
        expect(result[2].message).toBe('chore: deploy mv mainnet');

        // Verify old dev merges are filtered
        const messages = result.map((c) => c.message);
        expect(messages).not.toContain('Merge pull request #2321 from InjectiveLabs/dev');
        expect(messages).not.toContain('Merge pull request #2320 from InjectiveLabs/dev');
        expect(messages).not.toContain('Merge pull request #2319 from InjectiveLabs/dev');
      });

      it('should handle extended PR_2322 data with mixed commit types', () => {
        const result = filterOldMergeCommits(PR_2322_EXTENDED);

        // Should filter only old dev merges, keep everything else
        const devMerges = result.filter((c) => isDevToMasterMerge(c));
        expect(devMerges).toHaveLength(1); // Only the first one
        expect(devMerges[0].message).toBe('Merge pull request #2323 from InjectiveLabs/dev');

        // Should keep feature branch merges
        const featureMerges = result.filter((c) => isPRMergeCommit(c) && !isDevToMasterMerge(c));
        expect(featureMerges.length).toBeGreaterThan(0);
        expect(featureMerges.some((c) => c.message.includes('chore/deploy-mv-mainnet'))).toBe(true);
        expect(featureMerges.some((c) => c.message.includes('fix/volume-no-spacing'))).toBe(true);
        expect(featureMerges.some((c) => c.message.includes('feat/pnpm-build'))).toBe(true);

        // Should keep branch merges
        const branchMerges = result.filter((c) => isBranchMergeCommit(c));
        expect(branchMerges).toHaveLength(1);
        expect(branchMerges[0].message).toContain("Merge branch 'dev' into feat/pnpm-build");

        // Should keep regular commits
        const regularCommits = result.filter((c) => !isPRMergeCommit(c) && !isBranchMergeCommit(c));
        expect(regularCommits.some((c) => c.message === 'chore: deploy mv mainnet')).toBe(true);
        expect(regularCommits.some((c) => c.message === 'feat: pnpm build')).toBe(true);
        expect(regularCommits.some((c) => c.message === 'fix: add missing spacing')).toBe(true);
      });

      it('should produce correct release notes for PR #2322', () => {
        const result = formatReleaseNotes(PR_2322_COMMITS, REPO_URL);
        const lines = result.split('\n');

        // Should have 3 lines (filtered from 10 commits)
        expect(lines).toHaveLength(3);

        // Should contain the relevant commits
        expect(result).toContain('Merge pull request #2323');
        expect(result).toContain('chore/deploy-mv-mainnet');
        expect(result).toContain('chore: deploy mv mainnet');

        // Should NOT contain old dev merges
        expect(result).not.toContain('Merge pull request #2321 from InjectiveLabs/dev');
        expect(result).not.toContain('Merge pull request #2320 from InjectiveLabs/dev');
      });
    });
  });
});
