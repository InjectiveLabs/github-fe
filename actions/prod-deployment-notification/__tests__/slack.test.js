import { it, vi, expect, describe, beforeEach } from 'vitest';
import {
  sendSlackNotification,
  buildDeploymentPayload,
  convertMarkdownToSlack,
} from '../src/slack.js';

// Real commit data from InjectiveLabs/injective-helix repository
const REAL_COMMITS = {
  copyChange: {
    hash: 'f09968a6989cd77df646cf0306ae3b5f68b05ce5',
    message: 'chore: copy change',
    authorName: 'thomasRalee',
    authorEmail: '12345+thomasRalee@users.noreply.github.com',
  },
  mergePR2318: {
    hash: '9fadb5c17be12b0234fe344bed0140c2f68dabb3',
    message:
      'Merge pull request #2318 from InjectiveLabs/feat/add-support-to-query-seda-pricefeed-for-24/5-markets-IL-2390',
    authorName: 'ThomasRalee',
    authorEmail: 'ThomasRalee@users.noreply.github.com',
  },
  oracleSlash: {
    hash: 'ed4a581f3bdf850787af8d8597e3f78a3c60f304',
    message: 'fix: handle edge case of when market oracle base includes /',
    authorName: 'thomasRalee',
    authorEmail: 'thomasRalee@users.noreply.github.com',
  },
  packageBump: {
    hash: '629aaa7abc1234567890abcdef1234567890abcd',
    message: 'chore: package bump',
    authorName: 'ThomasRalee',
    authorEmail: 'ThomasRalee@users.noreply.github.com',
  },
  sedaPricefeed: {
    hash: '5796f4523293b5c8de60c014fb96ba3b2660497f',
    message:
      'feat: add support to query seda pricefeed for market is_open for 24/5 markets - IL-2390',
    authorName: 'thomasRalee',
    authorEmail: 'thomasRalee@users.noreply.github.com',
  },
  stopMarket: {
    hash: '7a87e7aabc1234567890abcdef1234567890abcd',
    message: 'fix: stop market slippage warnings',
    authorName: '0xA1337',
    authorEmail: '0xA1337@users.noreply.github.com',
  },
};

const REPO_URL = 'https://github.com/InjectiveLabs/injective-helix';

/**
 * Helper to generate release notes in the format produced by release-note action
 */
function generateMockReleaseNotes(commits) {
  return commits
    .map((commit) => {
      const shortHash = commit.hash.substring(0, 7);
      const commitLink = `[${shortHash}](${REPO_URL}/commit/${commit.hash})`;
      const prMatch = commit.message.match(/#(\d+)/);
      const prInfo = prMatch ? ` in [#${prMatch[1]}](${REPO_URL}/pull/${prMatch[1]})` : '';

      return `- ${commitLink} - ${commit.message} by @${commit.authorName}${prInfo}`;
    })
    .join('\n');
}

describe('slack', () => {
  describe('convertMarkdownToSlack', () => {
    it('should convert commit links to Slack format', () => {
      const markdown = `[f09968a](${REPO_URL}/commit/f09968a) - chore: copy change by @ThomasRalee`;
      const result = convertMarkdownToSlack(markdown);

      expect(result).toBe(
        `<${REPO_URL}/commit/f09968a|f09968a> - chore: copy change by @ThomasRalee`
      );
    });

    it('should convert PR links to Slack format', () => {
      const markdown = `[9fadb5c](${REPO_URL}/commit/9fadb5c) - Merge PR by @ThomasRalee in [#2318](${REPO_URL}/pull/2318)`;
      const result = convertMarkdownToSlack(markdown);

      expect(result).toContain(`<${REPO_URL}/commit/9fadb5c|9fadb5c>`);
      expect(result).toContain(`<${REPO_URL}/pull/2318|#2318>`);
    });

    it('should handle real release notes with multiple commits', () => {
      const releaseNotes = generateMockReleaseNotes([
        REAL_COMMITS.copyChange,
        REAL_COMMITS.mergePR2318,
        REAL_COMMITS.oracleSlash,
      ]);

      const result = convertMarkdownToSlack(releaseNotes);

      // Should not contain any markdown links
      expect(result).not.toMatch(/\[.*\]\(.*\)/);

      // Should contain Slack-formatted links
      expect(result).toContain(`<${REPO_URL}/commit/${REAL_COMMITS.copyChange.hash}|f09968a>`);
      expect(result).toContain(`<${REPO_URL}/commit/${REAL_COMMITS.mergePR2318.hash}|9fadb5c>`);
      expect(result).toContain(`<${REPO_URL}/pull/2318|#2318>`);
    });

    it('should preserve special characters in commit messages', () => {
      const releaseNotes = generateMockReleaseNotes([REAL_COMMITS.oracleSlash]);
      const result = convertMarkdownToSlack(releaseNotes);

      expect(result).toContain('includes /');
    });

    it('should handle empty/null input', () => {
      expect(convertMarkdownToSlack('')).toBe('');
      expect(convertMarkdownToSlack(null)).toBe('');
      expect(convertMarkdownToSlack(undefined)).toBe('');
    });
  });

  describe('buildDeploymentPayload', () => {
    const baseOptions = {
      projectName: 'Helix',
      repoUrl: REPO_URL,
      runId: '20041603958',
    };

    it('should build payload for deployment with new commits', () => {
      const releaseNotes = generateMockReleaseNotes([
        REAL_COMMITS.copyChange,
        REAL_COMMITS.mergePR2318,
      ]);

      const payload = buildDeploymentPayload({
        ...baseOptions,
        releaseNotes,
      });

      // Check main text
      expect(payload.text).toContain(':rocket:');
      expect(payload.text).toContain('Helix deployed to Mainnet!');
      expect(payload.text).toContain('The commits deployed are:');

      // Check links are in Slack format
      expect(payload.text).toContain(
        `<${REPO_URL}/commit/${REAL_COMMITS.copyChange.hash}|f09968a>`
      );
      expect(payload.text).not.toMatch(/\[.*\]\(.*\)/);

      // Check attachment
      expect(payload.attachments).toHaveLength(1);
      expect(payload.attachments[0].text).toContain('Helix deployed to Mainnet');
      expect(payload.attachments[0].text).toContain(':white_check_mark:');
      expect(payload.attachments[0].color).toBe('#22bb33');
    });

    it('should build payload for rebuild without new commits', () => {
      const payload = buildDeploymentPayload({
        ...baseOptions,
        releaseNotes: 'No new commits',
      });

      expect(payload.text).toContain(':rocket:');
      expect(payload.text).toContain('Rebuilt on Mainnet');
      expect(payload.text).toContain('Good guys, close your eyes!');
      expect(payload.text).not.toContain('The commits deployed are:');

      // Attachment should have run link
      expect(payload.attachments[0].text).toContain(`<${REPO_URL}/actions/runs/20041603958>`);
    });

    it('should treat empty release notes as rebuild', () => {
      const payload = buildDeploymentPayload({
        ...baseOptions,
        releaseNotes: '',
      });

      expect(payload.text).toContain('Rebuilt on Mainnet');
    });

    it('should include GitHub Actions run URL in deployment message', () => {
      const releaseNotes = generateMockReleaseNotes([REAL_COMMITS.copyChange]);

      const payload = buildDeploymentPayload({
        ...baseOptions,
        releaseNotes,
      });

      expect(payload.text).toContain(`<${REPO_URL}/actions/runs/20041603958>`);
    });

    it('should handle real-world release notes with Jira tickets', () => {
      const releaseNotes = generateMockReleaseNotes([
        REAL_COMMITS.sedaPricefeed, // Has IL-2390
        REAL_COMMITS.mergePR2318, // Has PR #2318
      ]);

      const payload = buildDeploymentPayload({
        ...baseOptions,
        releaseNotes,
      });

      // Jira tickets should be preserved
      expect(payload.text).toContain('IL-2390');

      // PR link should be in Slack format
      expect(payload.text).toContain(`<${REPO_URL}/pull/2318|#2318>`);
    });

    it('should handle multiple authors in release notes', () => {
      const releaseNotes = generateMockReleaseNotes([
        REAL_COMMITS.copyChange, // thomasRalee
        REAL_COMMITS.stopMarket, // 0xA1337
      ]);

      const payload = buildDeploymentPayload({
        ...baseOptions,
        releaseNotes,
      });

      expect(payload.text).toContain('@thomasRalee');
      expect(payload.text).toContain('@0xA1337');
    });
  });

  describe('sendSlackNotification', () => {
    beforeEach(() => {
      vi.resetAllMocks();
      global.fetch = vi.fn();
    });

    it('should send POST request to webhook URL', async () => {
      global.fetch.mockResolvedValue({ ok: true });

      const webhookUrl = 'https://hooks.slack.com/services/xxx/yyy/zzz';
      const payload = { text: 'Hello' };

      await sendSlackNotification(webhookUrl, payload);

      expect(global.fetch).toHaveBeenCalledWith(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    });

    it('should throw error on non-ok response', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('invalid_payload'),
      });

      const webhookUrl = 'https://hooks.slack.com/services/xxx/yyy/zzz';
      const payload = { text: 'Hello' };

      await expect(sendSlackNotification(webhookUrl, payload)).rejects.toThrow(
        'Slack webhook failed: 400 invalid_payload'
      );
    });

    it('should handle network errors', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      const webhookUrl = 'https://hooks.slack.com/services/xxx/yyy/zzz';
      const payload = { text: 'Hello' };

      await expect(sendSlackNotification(webhookUrl, payload)).rejects.toThrow('Network error');
    });

    it('should send real deployment payload', async () => {
      global.fetch.mockResolvedValue({ ok: true });

      const releaseNotes = generateMockReleaseNotes([
        REAL_COMMITS.copyChange,
        REAL_COMMITS.mergePR2318,
      ]);

      const payload = buildDeploymentPayload({
        projectName: 'Helix',
        releaseNotes,
        repoUrl: REPO_URL,
        runId: '20041603958',
      });

      await sendSlackNotification('https://hooks.slack.com/test', payload);

      const sentPayload = JSON.parse(global.fetch.mock.calls[0][1].body);

      // Verify the payload structure
      expect(sentPayload.text).toContain('Helix deployed to Mainnet');
      expect(sentPayload.attachments).toHaveLength(1);
      expect(sentPayload.attachments[0].color).toBe('#22bb33');
    });
  });
});
