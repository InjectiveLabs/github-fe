import { it, vi, expect, describe, afterEach, beforeEach } from 'vitest';
import {
  sleep,
  slackRequest,
  isRetryableError,
  extractJiraFromText,
} from '../src/slack.js';

// Mock https module
vi.mock('https', () => ({
  default: {
    request: vi.fn(),
  },
}));

import https from 'https';

describe('slack', () => {
  describe('extractJiraFromText', () => {
    it('should extract tickets from text', () => {
      const text = 'Working on IL-1234 and IL-5678';
      expect(extractJiraFromText(text)).toEqual(['IL-1234', 'IL-5678']);
    });

    it('should handle lowercase', () => {
      const text = 'Working on il-1234';
      expect(extractJiraFromText(text)).toEqual(['IL-1234']);
    });

    it('should deduplicate', () => {
      const text = 'IL-1234 and IL-1234 again';
      expect(extractJiraFromText(text)).toEqual(['IL-1234']);
    });

    it('should return empty array for no matches', () => {
      const text = 'No tickets here';
      expect(extractJiraFromText(text)).toEqual([]);
    });

    it('should handle empty string', () => {
      expect(extractJiraFromText('')).toEqual([]);
    });

    it('should handle Slack link format', () => {
      const text = 'Jira tickets: <https://injective-labs.atlassian.net/browse/IL-1234|IL-1234>';
      expect(extractJiraFromText(text)).toEqual(['IL-1234']);
    });

    it('should extract tickets from multi-line text', () => {
      const text = `Branch: feat/IL-1234-new-feature
Description: Working on IL-5678
Jira tickets: IL-9999`;
      expect(extractJiraFromText(text)).toEqual(['IL-1234', 'IL-5678', 'IL-9999']);
    });
  });

  describe('isRetryableError', () => {
    it('should return true for rate_limited', () => {
      expect(isRetryableError('rate_limited')).toBe(true);
    });

    it('should return true for service_unavailable', () => {
      expect(isRetryableError('service_unavailable')).toBe(true);
    });

    it('should return true for internal_error', () => {
      expect(isRetryableError('internal_error')).toBe(true);
    });

    it('should return true for request_timeout', () => {
      expect(isRetryableError('request_timeout')).toBe(true);
    });

    it('should return false for channel_not_found', () => {
      expect(isRetryableError('channel_not_found')).toBe(false);
    });

    it('should return false for invalid_auth', () => {
      expect(isRetryableError('invalid_auth')).toBe(false);
    });

    it('should return false for unknown errors', () => {
      expect(isRetryableError('some_random_error')).toBe(false);
    });
  });

  describe('sleep', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should resolve after specified time', async () => {
      const promise = sleep(1000);
      vi.advanceTimersByTime(1000);
      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe('slackRequest', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should make successful request', async () => {
      const mockResponse = { ok: true, ts: '123.456' };
      
      https.request.mockImplementation((options, callback) => {
        const res = {
          on: (event, handler) => {
            if (event === 'data') {handler(JSON.stringify(mockResponse));}
            if (event === 'end') {handler();}
          },
        };
        callback(res);

        return {
          on: vi.fn(),
          write: vi.fn(),
          end: vi.fn(),
        };
      });

      const result = await slackRequest('POST', 'chat.postMessage', 'token', { text: 'hello' });
      expect(result).toEqual(mockResponse);
    });

    it('should throw on non-retryable error', async () => {
      const mockResponse = { ok: false, error: 'channel_not_found' };
      
      https.request.mockImplementation((options, callback) => {
        const res = {
          on: (event, handler) => {
            if (event === 'data') {handler(JSON.stringify(mockResponse));}
            if (event === 'end') {handler();}
          },
        };
        callback(res);

        return {
          on: vi.fn(),
          write: vi.fn(),
          end: vi.fn(),
        };
      });

      await expect(slackRequest('POST', 'chat.postMessage', 'token', {}))
        .rejects.toThrow('Slack API error: channel_not_found');
    });

    it('should retry on retryable error and succeed', async () => {
      let attempt = 0;
      
      https.request.mockImplementation((options, callback) => {
        attempt++;
        const mockResponse = attempt < 2 
          ? { ok: false, error: 'rate_limited' }
          : { ok: true, ts: '123.456' };
        
        const res = {
          on: (event, handler) => {
            if (event === 'data') {handler(JSON.stringify(mockResponse));}
            if (event === 'end') {handler();}
          },
        };
        callback(res);

        return {
          on: vi.fn(),
          write: vi.fn(),
          end: vi.fn(),
        };
      });

      const resultPromise = slackRequest('POST', 'chat.postMessage', 'token', {});
      
      // Advance past first retry delay
      await vi.advanceTimersByTimeAsync(2000);
      
      const result = await resultPromise;
      expect(result.ok).toBe(true);
      expect(attempt).toBe(2);
    });

    it('should handle request without body', async () => {
      const mockResponse = { ok: true };
      let writeWasCalled = false;
      
      https.request.mockImplementation((options, callback) => {
        const res = {
          on: (event, handler) => {
            if (event === 'data') {handler(JSON.stringify(mockResponse));}
            if (event === 'end') {handler();}
          },
        };
        callback(res);

        return {
          on: vi.fn(),
          write: () => { writeWasCalled = true; },
          end: vi.fn(),
        };
      });

      await slackRequest('GET', 'conversations.list', 'token');
      expect(writeWasCalled).toBe(false);
    });
  });
});
