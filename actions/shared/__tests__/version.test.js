import { it, expect, describe } from 'vitest';
import {
  parseVersion,
  formatVersion,
  incrementPatch,
  incrementMinor,
  incrementMajor,
} from '../src/version.js';

describe('version', () => {
  describe('parseVersion', () => {
    it('should parse version with v prefix', () => {
      const result = parseVersion('v1.2.3');
      expect(result).toEqual({ major: 1, minor: 2, patch: 3, prefix: 'v' });
    });

    it('should parse version without v prefix', () => {
      const result = parseVersion('1.2.3');
      expect(result).toEqual({ major: 1, minor: 2, patch: 3, prefix: '' });
    });

    it('should parse version with zero components', () => {
      const result = parseVersion('v0.0.1');
      expect(result).toEqual({ major: 0, minor: 0, patch: 1, prefix: 'v' });
    });

    it('should parse large version numbers', () => {
      const result = parseVersion('v1.17.12');
      expect(result).toEqual({ major: 1, minor: 17, patch: 12, prefix: 'v' });
    });

    it('should throw for empty version', () => {
      expect(() => parseVersion('')).toThrow('Version string is required');
      expect(() => parseVersion(null)).toThrow('Version string is required');
      expect(() => parseVersion(undefined)).toThrow('Version string is required');
    });

    it('should throw for invalid format - too few parts', () => {
      expect(() => parseVersion('v1.2')).toThrow('Invalid version format');
      expect(() => parseVersion('1')).toThrow('Invalid version format');
    });

    it('should throw for invalid format - too many parts', () => {
      expect(() => parseVersion('v1.2.3.4')).toThrow('Invalid version format');
    });

    it('should throw for non-numeric components', () => {
      expect(() => parseVersion('v1.2.x')).toThrow('Version components must be numbers');
      expect(() => parseVersion('va.b.c')).toThrow('Version components must be numbers');
    });

    it('should throw for negative components', () => {
      expect(() => parseVersion('v1.-2.3')).toThrow('Version components must be non-negative');
    });
  });

  describe('incrementPatch', () => {
    it('should increment patch version', () => {
      expect(incrementPatch('v1.2.3')).toBe('v1.2.4');
    });

    it('should handle version without prefix', () => {
      expect(incrementPatch('1.2.3')).toBe('v1.2.4');
    });

    it('should increment from zero', () => {
      expect(incrementPatch('v1.0.0')).toBe('v1.0.1');
    });

    it('should handle real version numbers', () => {
      expect(incrementPatch('v1.17.11')).toBe('v1.17.12');
      expect(incrementPatch('v1.17.12')).toBe('v1.17.13');
    });
  });

  describe('incrementMinor', () => {
    it('should increment minor version and reset patch', () => {
      expect(incrementMinor('v1.2.3')).toBe('v1.3.0');
    });

    it('should handle version without prefix', () => {
      expect(incrementMinor('1.2.3')).toBe('v1.3.0');
    });

    it('should increment from zero', () => {
      expect(incrementMinor('v1.0.5')).toBe('v1.1.0');
    });
  });

  describe('incrementMajor', () => {
    it('should increment major version and reset minor and patch', () => {
      expect(incrementMajor('v1.2.3')).toBe('v2.0.0');
    });

    it('should handle version without prefix', () => {
      expect(incrementMajor('1.2.3')).toBe('v2.0.0');
    });

    it('should increment from zero', () => {
      expect(incrementMajor('v0.5.10')).toBe('v1.0.0');
    });
  });

  describe('formatVersion', () => {
    it('should format version with prefix by default', () => {
      expect(formatVersion({ major: 1, minor: 2, patch: 3 })).toBe('v1.2.3');
    });

    it('should format version without prefix when specified', () => {
      expect(formatVersion({ major: 1, minor: 2, patch: 3 }, false)).toBe('1.2.3');
    });

    it('should handle zero components', () => {
      expect(formatVersion({ major: 0, minor: 0, patch: 1 })).toBe('v0.0.1');
    });

    it('should handle large numbers', () => {
      expect(formatVersion({ major: 1, minor: 17, patch: 12 })).toBe('v1.17.12');
    });
  });
});
