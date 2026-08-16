import { it, vi, expect, describe, afterEach, beforeEach } from 'vitest';
import {
  lookupIssue,
  linearRequest,
  postIssueComment,
  formatLinearComment,
  extractLinearTickets,
} from '../src/linear.js';

// Mock https module
vi.mock('https', () => ({
  default: {
    request: vi.fn(),
  },
}));

import https from 'https';

describe('linear', () => {
  describe('extractLinearTickets', () => {
    it('should extract a single ticket from one message', () => {
      expect(extractLinearTickets(['feat: add login INJ-142'])).toEqual(['INJ-142']);
    });

    it('should extract multiple tickets from one message', () => {
      const result = extractLinearTickets(['fix: resolve INJ-142 and SEC-146']);
      expect(result).toEqual(['INJ-142', 'SEC-146']);
    });

    it('should deduplicate across multiple messages', () => {
      const result = extractLinearTickets([
        'feat: add login INJ-142',
        'fix: related to INJ-142 and SEC-146',
      ]);
      expect(result).toEqual(['INJ-142', 'SEC-146']);
    });

    it('should return empty array for no matches', () => {
      expect(extractLinearTickets(['no tickets here'])).toEqual([]);
    });

    it('should not match lowercase tickets', () => {
      expect(extractLinearTickets(['inj-142 is lowercase'])).toEqual([]);
    });

    it('should handle minimum length ticket I-1', () => {
      expect(extractLinearTickets(['ticket I-1 here'])).toEqual(['I-1']);
    });

    it('should handle various team prefixes', () => {
      const result = extractLinearTickets([
        'ID-1364 IC-930 SEC-146 IA-920 I-42 ILO-796',
      ]);
      expect(result).toEqual(['ID-1364', 'IC-930', 'SEC-146', 'IA-920', 'I-42', 'ILO-796']);
    });

    it('should skip null/empty texts', () => {
      expect(extractLinearTickets([null, '', undefined, 'INJ-1'])).toEqual(['INJ-1']);
    });

    it('should handle empty array', () => {
      expect(extractLinearTickets([])).toEqual([]);
    });
  });

  describe('formatLinearComment', () => {
    it('should generate expected markdown', () => {
      const result = formatLinearComment({
        repo: 'injective-fe',
        branchName: 'feat/login',
        stagingUrl: 'https://staging.example.com',
        author: 'testuser',
      });

      expect(result).toContain('**Staging Deployment**');
      expect(result).toContain('injective-fe');
      expect(result).toContain('`feat/login`');
      expect(result).toContain('https://staging.example.com');
      expect(result).toContain('testuser');
    });
  });

  describe('linearRequest', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    function mockLinearResponse(response) {
      https.request.mockImplementation((_options, callback) => {
        const res = {
          on: (event, handler) => {
            if (event === 'data') {handler(JSON.stringify(response));}
            if (event === 'end') {handler();}
          },
        };
        callback(res);

        return {
          on: vi.fn(),
          write: vi.fn(),
          end: vi.fn(),
          setTimeout: vi.fn(),
        };
      });
    }

    it('should make successful request', async () => {
      const mockData = { data: { issue: { id: '123', title: 'Test' } } };
      mockLinearResponse(mockData);

      const result = await linearRequest('query { viewer { id } }', {}, 'api-key');
      expect(result).toEqual(mockData.data);
    });

    it('should throw on GraphQL errors without retrying', async () => {
      mockLinearResponse({
        errors: [{ message: 'Issue not found' }],
      });

      await expect(
        linearRequest('query { issue(id: "X-1") { id } }', {}, 'api-key')
      ).rejects.toThrow('Linear GraphQL error: Issue not found');

      // Should not retry on GraphQL errors
      expect(https.request).toHaveBeenCalledTimes(1);
    });

    it('should not retry on auth errors', async () => {
      mockLinearResponse({
        errors: [{ message: 'Unauthorized' }],
      });

      await expect(
        linearRequest('query { viewer { id } }', {}, 'bad-key')
      ).rejects.toThrow();

      expect(https.request).toHaveBeenCalledTimes(1);
    });

    it('should retry on network errors and succeed', async () => {
      let attempt = 0;

      https.request.mockImplementation((_options, callback) => {
        attempt++;

        if (attempt < 2) {
          return {
            on: (event, handler) => {
              if (event === 'error') {handler(new Error('ECONNRESET'));}
            },
            write: vi.fn(),
            end: vi.fn(),
            setTimeout: vi.fn(),
          };
        }

        const res = {
          on: (event, handler) => {
            if (event === 'data') {handler(JSON.stringify({ data: { ok: true } }));}
            if (event === 'end') {handler();}
          },
        };
        callback(res);

        return {
          on: vi.fn(),
          write: vi.fn(),
          end: vi.fn(),
          setTimeout: vi.fn(),
        };
      });

      const resultPromise = linearRequest('query { viewer { id } }', {}, 'api-key');
      await vi.advanceTimersByTimeAsync(2000);
      const result = await resultPromise;
      expect(result).toEqual({ ok: true });
      expect(attempt).toBe(2);
    });
  });

  describe('lookupIssue', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return issue when found', async () => {
      const issue = { id: 'uuid-123', identifier: 'INJ-142', title: 'Test', url: 'https://linear.app/team/issue/INJ-142' };
      https.request.mockImplementation((_options, callback) => {
        const res = {
          on: (event, handler) => {
            if (event === 'data') {handler(JSON.stringify({ data: { issue } }));}
            if (event === 'end') {handler();}
          },
        };
        callback(res);

        return { on: vi.fn(), write: vi.fn(), end: vi.fn(), setTimeout: vi.fn() };
      });

      const result = await lookupIssue('INJ-142', 'api-key');
      expect(result).toEqual(issue);
    });

    it('should return null when issue not found', async () => {
      https.request.mockImplementation((_options, callback) => {
        const res = {
          on: (event, handler) => {
            if (event === 'data') {handler(JSON.stringify({ data: { issue: null } }));}
            if (event === 'end') {handler();}
          },
        };
        callback(res);

        return { on: vi.fn(), write: vi.fn(), end: vi.fn(), setTimeout: vi.fn() };
      });

      const result = await lookupIssue('FAKE-999', 'api-key');
      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      https.request.mockImplementation((_options, callback) => {
        const res = {
          on: (event, handler) => {
            if (event === 'data') {handler(JSON.stringify({ errors: [{ message: 'Unauthorized' }] }));}
            if (event === 'end') {handler();}
          },
        };
        callback(res);

        return { on: vi.fn(), write: vi.fn(), end: vi.fn(), setTimeout: vi.fn() };
      });

      const result = await lookupIssue('INJ-1', 'bad-key');
      expect(result).toBeNull();
    });
  });

  describe('postIssueComment', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return true on success', async () => {
      https.request.mockImplementation((_options, callback) => {
        const res = {
          on: (event, handler) => {
            if (event === 'data') {handler(JSON.stringify({
              data: { commentCreate: { success: true, comment: { id: 'c-1' } } },
            }));}
            if (event === 'end') {handler();}
          },
        };
        callback(res);

        return { on: vi.fn(), write: vi.fn(), end: vi.fn(), setTimeout: vi.fn() };
      });

      const result = await postIssueComment('uuid-123', 'Test comment', 'api-key');
      expect(result).toBe(true);
    });

    it('should return false on failure', async () => {
      https.request.mockImplementation((_options, callback) => {
        const res = {
          on: (event, handler) => {
            if (event === 'data') {handler(JSON.stringify({ errors: [{ message: 'Unauthorized' }] }));}
            if (event === 'end') {handler();}
          },
        };
        callback(res);

        return { on: vi.fn(), write: vi.fn(), end: vi.fn(), setTimeout: vi.fn() };
      });

      const result = await postIssueComment('uuid-123', 'Test', 'bad-key');
      expect(result).toBe(false);
    });
  });
});
