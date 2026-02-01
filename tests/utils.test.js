import { describe, it, expect } from 'vitest';
import {
  sanitizeHtmlId,
  getParamName,
  truncate,
  capitalize,
  formatTimestamp,
  escapeHtml,
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

describe('escapeHtml', () => {
  it('escapes ampersands', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes angle brackets', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#039;s');
  });

  it('passes clean strings through unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });

  it('escapes all special characters together', () => {
    expect(escapeHtml('<a href="x">&\'</a>')).toBe(
      '&lt;a href=&quot;x&quot;&gt;&amp;&#039;&lt;/a&gt;',
    );
  });
});
