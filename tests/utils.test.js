import { describe, it, expect } from 'vitest';
import {
  sanitizeHtmlId,
  getParamName,
  truncate,
  capitalize,
  formatTimestamp,
} from '../src/utils.js';

describe('sanitizeHtmlId', () => {
  it('replaces non-word characters with hyphens and lowercases', () => {
    expect(sanitizeHtmlId('My File.js')).toBe('my-file-js');
  });

  it('handles consecutive special characters', () => {
    expect(sanitizeHtmlId('foo!!!bar')).toBe('foo-bar');
  });

  it('handles already clean strings', () => {
    expect(sanitizeHtmlId('simple')).toBe('simple');
  });

  it('handles empty string', () => {
    expect(sanitizeHtmlId('')).toBe('');
  });
});

describe('getParamName', () => {
  it('returns string directly if param is a string', () => {
    expect(getParamName('foo')).toBe('foo');
  });

  it('returns name property if present', () => {
    expect(getParamName({ name: 'bar' })).toBe('bar');
  });

  it('handles RestElement nodes', () => {
    expect(
      getParamName({ type: 'RestElement', argument: { name: 'args' } }),
    ).toBe('...args');
  });

  it('handles ObjectPattern nodes', () => {
    expect(getParamName({ type: 'ObjectPattern' })).toBe('{...}');
  });

  it('handles ArrayPattern nodes', () => {
    expect(getParamName({ type: 'ArrayPattern' })).toBe('[...]');
  });

  it('returns "arg" for unknown node types', () => {
    expect(getParamName({ type: 'Unknown' })).toBe('arg');
  });
});

describe('truncate', () => {
  it('returns string unchanged if within limit', () => {
    expect(truncate('short', 100)).toBe('short');
  });

  it('truncates and appends ellipsis when over limit', () => {
    expect(truncate('abcdefghij', 5)).toBe('abcde...');
  });

  it('returns string unchanged if exactly at limit', () => {
    expect(truncate('12345', 5)).toBe('12345');
  });

  it('uses default maxLength of 100', () => {
    const str = 'a'.repeat(101);
    expect(truncate(str)).toBe('a'.repeat(100) + '...');
  });
});

describe('capitalize', () => {
  it('capitalizes first letter', () => {
    expect(capitalize('hello')).toBe('Hello');
  });

  it('leaves already capitalized strings unchanged', () => {
    expect(capitalize('Hello')).toBe('Hello');
  });

  it('handles single character', () => {
    expect(capitalize('a')).toBe('A');
  });
});

describe('formatTimestamp', () => {
  it('returns ISO string for a given date', () => {
    const date = new Date('2025-06-15T12:00:00Z');
    expect(formatTimestamp(date)).toBe('2025-06-15T12:00:00.000Z');
  });

  it('returns a valid ISO string when called with no argument', () => {
    const result = formatTimestamp();
    expect(() => new Date(result).toISOString()).not.toThrow();
  });
});
