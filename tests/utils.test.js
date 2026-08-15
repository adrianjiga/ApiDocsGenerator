import { describe, it, expect } from 'vitest';
import {
  sanitizeHtmlId,
  githubSlug,
  getParamName,
  escapeHtml,
  calcPercentage,
  getParamTags,
  getReturnTags,
  cleanTagDescription,
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

  it('strips leading and trailing hyphens produced by non-ASCII characters', () => {
    expect(sanitizeHtmlId('用户.js')).toBe('js');
  });

  it('handles a filename that is entirely non-ASCII', () => {
    expect(sanitizeHtmlId('用户')).toBe('');
  });

  it('keeps inner hyphens from non-ASCII characters between word chars', () => {
    expect(sanitizeHtmlId('file用户name.js')).toBe('file-name-js');
  });
});

describe('githubSlug', () => {
  it('strips dots like GitHub instead of replacing them with hyphens', () => {
    expect(githubSlug('advanced-sample.js')).toBe('advanced-samplejs');
  });

  it('matches GitHub slug for headings without punctuation', () => {
    expect(githubSlug('My File')).toBe('my-file');
  });

  it('strips punctuation and collapses whitespace runs', () => {
    expect(githubSlug('Hello,   World!')).toBe('hello-world');
  });

  it('keeps hyphens and underscores', () => {
    expect(githubSlug('foo_bar-baz')).toBe('foo_bar-baz');
  });

  it('handles empty string', () => {
    expect(githubSlug('')).toBe('');
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

  it('handles ObjectPattern nodes without properties', () => {
    expect(getParamName({ type: 'ObjectPattern' })).toBe('{...}');
  });

  it('handles ObjectPattern nodes with properties', () => {
    expect(
      getParamName({
        type: 'ObjectPattern',
        properties: [
          { type: 'Property', key: { name: 'a' } },
          { type: 'Property', key: { name: 'b' } },
        ],
      }),
    ).toBe('{a, b}');
  });

  it('handles ObjectPattern nodes with rest element', () => {
    expect(
      getParamName({
        type: 'ObjectPattern',
        properties: [
          { type: 'Property', key: { name: 'a' } },
          { type: 'RestElement', argument: { name: 'rest' } },
        ],
      }),
    ).toBe('{a, ...rest}');
  });

  it('handles ArrayPattern nodes without elements', () => {
    expect(getParamName({ type: 'ArrayPattern' })).toBe('[...]');
  });

  it('handles ArrayPattern nodes with elements', () => {
    expect(
      getParamName({
        type: 'ArrayPattern',
        elements: [{ name: 'x' }, { name: 'y' }],
      }),
    ).toBe('[x, y]');
  });

  it('returns "arg" for unknown node types', () => {
    expect(getParamName({ type: 'Unknown' })).toBe('arg');
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

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });
});

describe('calcPercentage', () => {
  it('calculates 50% correctly', () => {
    expect(calcPercentage(1, 2)).toBe(50);
  });

  it('rounds to one decimal place', () => {
    expect(calcPercentage(1, 3)).toBe(33.3);
  });

  it('returns 0 when part is 0', () => {
    expect(calcPercentage(0, 5)).toBe(0);
  });

  it('returns 100 when part equals total', () => {
    expect(calcPercentage(5, 5)).toBe(100);
  });

  it('returns 0 when total is 0', () => {
    expect(calcPercentage(0, 0)).toBe(0);
  });
});

describe('getParamTags', () => {
  it('returns only @param tags from mixed tags', () => {
    const tags = [
      { tag: 'param', name: 'x' },
      { tag: 'returns', type: 'number' },
      { tag: 'param', name: 'y' },
    ];
    const result = getParamTags(tags);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('x');
    expect(result[1].name).toBe('y');
  });

  it('returns empty array for empty input', () => {
    expect(getParamTags([])).toEqual([]);
  });

  it('returns empty array for null input', () => {
    expect(getParamTags(null)).toEqual([]);
  });
});

describe('getReturnTags', () => {
  it('handles @returns tag', () => {
    const tags = [{ tag: 'returns', type: 'string' }];
    expect(getReturnTags(tags)).toHaveLength(1);
  });

  it('handles @return tag', () => {
    const tags = [{ tag: 'return', type: 'string' }];
    expect(getReturnTags(tags)).toHaveLength(1);
  });

  it('filters from mixed tags', () => {
    const tags = [
      { tag: 'param', name: 'x' },
      { tag: 'returns', type: 'number' },
      { tag: 'param', name: 'y' },
    ];
    expect(getReturnTags(tags)).toHaveLength(1);
  });

  it('returns empty array for empty input', () => {
    expect(getReturnTags([])).toEqual([]);
  });

  it('returns empty array for null input', () => {
    expect(getReturnTags(null)).toEqual([]);
  });
});

describe('cleanTagDescription', () => {
  it('strips leading dash and space', () => {
    expect(cleanTagDescription('- The description')).toBe('The description');
  });

  it('strips leading whitespace', () => {
    expect(cleanTagDescription('  hello')).toBe('hello');
  });

  it('handles null input', () => {
    expect(cleanTagDescription(null)).toBe('');
  });

  it('passes clean strings through unchanged', () => {
    expect(cleanTagDescription('already clean')).toBe('already clean');
  });
});
