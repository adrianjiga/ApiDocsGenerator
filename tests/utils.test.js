import { describe, expect, it } from 'vitest';
import {
  calcPercentage,
  cleanTagDescription,
  coverageLevel,
  curlCommand,
  describeExtras,
  describeParams,
  describeReturns,
  escapeHtml,
  getParamName,
  getParamTags,
  getReturnTags,
  githubSlug,
  inlineLinks,
  sanitizeHtmlId,
  stripControlChars,
  uniqueFileLabels,
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

describe('uniqueFileLabels', () => {
  it('returns basenames when no collisions occur', () => {
    const apiData = [
      { file: '/src/app.js', fileName: 'app.js' },
      { file: '/src/utils.js', fileName: 'utils.js' },
    ];
    const labels = uniqueFileLabels(apiData);
    expect(labels.get('/src/app.js')).toBe('app.js');
    expect(labels.get('/src/utils.js')).toBe('utils.js');
  });

  it('prefixes directory path to disambiguate basename collisions', () => {
    const apiData = [
      { file: '/src/a/util.js', fileName: 'util.js' },
      { file: '/src/b/util.js', fileName: 'util.js' },
    ];
    const labels = uniqueFileLabels(apiData);
    expect(labels.get('/src/a/util.js')).toBe('a/util.js');
    expect(labels.get('/src/b/util.js')).toBe('b/util.js');
  });

  it('handles relative paths', () => {
    const apiData = [
      { file: './src/a/util.js', fileName: 'util.js' },
      { file: './src/b/util.js', fileName: 'util.js' },
      { file: './src/a/other.js', fileName: 'other.js' },
    ];
    const labels = uniqueFileLabels(apiData);
    expect(labels.get('./src/a/util.js')).toBe('a/util.js');
    expect(labels.get('./src/b/util.js')).toBe('b/util.js');
    expect(labels.get('./src/a/other.js')).toBe('other.js');
  });

  it('returns empty map for empty input', () => {
    expect(uniqueFileLabels([]) instanceof Map).toBe(true);
    expect(uniqueFileLabels([]).size).toBe(0);
  });
});

describe('stripControlChars', () => {
  it('removes ANSI escape and other control characters', () => {
    expect(stripControlChars('/\u001b[31mRED\u001b[0m\u0007')).toBe(
      '/[31mRED[0m',
    );
  });

  it('removes C1 control characters', () => {
    expect(stripControlChars('a\u009bb')).toBe('ab');
  });

  it('keeps tabs, newlines and non-ASCII text', () => {
    expect(stripControlChars('a\tb\nc — é 📄')).toBe('a\tb\nc — é 📄');
  });
});

describe('coverageLevel', () => {
  it('is good at or above the threshold', () => {
    expect(coverageLevel(80, 80)).toBe('good');
    expect(coverageLevel(100, 90)).toBe('good');
  });

  it('is a warning within 30 points below the threshold', () => {
    expect(coverageLevel(50, 80)).toBe('warning');
    expect(coverageLevel(79.9, 80)).toBe('warning');
  });

  it('is an error further below', () => {
    expect(coverageLevel(49.9, 80)).toBe('error');
  });

  it('defaults to a threshold of 80', () => {
    expect(coverageLevel(80)).toBe('good');
    expect(coverageLevel(60)).toBe('warning');
  });
});

describe('describeParams', () => {
  const tag = (name, type, extra = {}) => ({
    tag: 'param',
    name,
    type,
    description: `- the ${name}`,
    ...extra,
  });

  it('lists TypeScript parameters when there is no JSDoc', () => {
    const item = {
      jsdoc: null,
      paramDetails: [{ name: 'a', optional: true, type: 'number' }],
    };
    expect(describeParams(item)).toEqual([
      { name: 'a', optional: true, type: 'number', description: '' },
    ]);
  });

  it('prefers the JSDoc type and falls back to the TypeScript type', () => {
    const item = {
      jsdoc: { tags: [tag('a', 'Foo'), tag('b', '')] },
      paramDetails: [
        { name: 'a', optional: false, type: 'string' },
        { name: 'b', optional: false, type: 'number', defaultValue: '1' },
      ],
    };
    expect(describeParams(item)).toEqual([
      { name: 'a', type: 'Foo', description: 'the a', optional: false },
      {
        name: 'b',
        type: 'number',
        description: 'the b',
        optional: false,
        defaultValue: '1',
      },
    ]);
  });

  it('keeps nested tags and appends parameters no tag covers', () => {
    const item = {
      jsdoc: { tags: [tag('opts', 'Object'), tag('opts.limit', 'number')] },
      paramDetails: [
        { name: '{limit}', optional: false, type: '{ limit: number }' },
        { name: 'cb', optional: true, type: '() => void' },
      ],
    };
    expect(describeParams(item).map((p) => [p.name, p.type])).toEqual([
      ['opts', 'Object'],
      ['opts.limit', 'number'],
      ['cb', '() => void'],
    ]);
  });

  it('matches rest parameters by name without the dots', () => {
    const item = {
      jsdoc: { tags: [tag('args', '')] },
      paramDetails: [{ name: '...args', optional: false, type: 'string[]' }],
    };
    expect(describeParams(item)).toHaveLength(1);
    expect(describeParams(item)[0].type).toBe('string[]');
  });
});

describe('describeParams – destructured parameters', () => {
  it('does not repeat a destructured parameter after an untagged one', () => {
    const tag = (name, type) => ({ tag: 'param', name, type, description: '' });
    const item = {
      jsdoc: {
        tags: [
          tag('name', 'string'),
          tag('opts', 'Object'),
          tag('opts.a', 'number'),
        ],
      },
      paramDetails: [
        { name: 'id', optional: false, type: 'number' },
        { name: 'name', optional: false, type: 'string' },
        { name: '{a}', optional: false, type: 'Opts' },
      ],
    };
    expect(describeParams(item).map((p) => p.name)).toEqual([
      'name',
      'opts',
      'opts.a',
      'id',
    ]);
  });
});

describe('describeParams – malformed tags', () => {
  it('skips @param tags without a usable name', () => {
    const item = {
      jsdoc: {
        tags: [
          { tag: 'param', name: '-', type: 'string', description: 'x' },
          { tag: 'param', name: '', type: 'string', description: '' },
          { tag: 'param', name: 'a', type: 'number', description: 'A' },
        ],
      },
      paramDetails: [{ name: 'a', optional: false }],
    };
    expect(describeParams(item).map((p) => p.name)).toEqual(['a']);
  });
});

describe('describeReturns', () => {
  it('uses the TypeScript return type when there is no @returns', () => {
    expect(describeReturns({ jsdoc: null, returnType: 'number' })).toEqual([
      { type: 'number', description: '' },
    ]);
  });

  it('fills a typeless @returns from the TypeScript return type', () => {
    const item = {
      jsdoc: { tags: [{ tag: 'returns', type: '', description: 'The sum' }] },
      returnType: 'number',
    };
    expect(describeReturns(item)).toEqual([
      { type: 'number', description: 'The sum' },
    ]);
  });

  it('returns nothing without a tag or a type', () => {
    expect(describeReturns({ jsdoc: null })).toEqual([]);
  });
});

describe('curlCommand', () => {
  it('passes the method with -X', () => {
    expect(curlCommand('POST', 'http://h/a')).toBe("curl -X POST 'http://h/a'");
  });

  it('uses -I for HEAD, which has no response body', () => {
    expect(curlCommand('HEAD', 'http://h/a')).toBe("curl -I 'http://h/a'");
  });

  it('sends a plain request for ALL', () => {
    expect(curlCommand('ALL', 'http://h/a')).toBe("curl 'http://h/a'");
  });

  it('quotes the URL so shells leave ? and * alone', () => {
    expect(curlCommand('GET', 'http://h/users/:id?')).toBe(
      "curl -X GET 'http://h/users/:id?'",
    );
  });

  it('escapes single quotes inside the URL', () => {
    expect(curlCommand('GET', "http://h/it's")).toBe(
      "curl -X GET 'http://h/it'\\''s'",
    );
  });
});

describe('describeExtras', () => {
  const withTags = (tags) => ({ jsdoc: { description: 'x', tags } });

  it('returns empty lists and no deprecation without tags', () => {
    expect(describeExtras({ jsdoc: null })).toEqual({
      throws: [],
      see: [],
      examples: [],
    });
  });

  it('reports a deprecation with or without a message', () => {
    const tag = (description) => ({ tag: 'deprecated', description });
    expect(describeExtras(withTags([tag('Use b')])).deprecated).toBe('Use b');
    expect(describeExtras(withTags([tag('')])).deprecated).toBe('');
  });

  it('collects @throws and @exception with optional types', () => {
    const extras = describeExtras(
      withTags([
        { tag: 'throws', type: 'RangeError', description: '- When negative' },
        { tag: 'exception', type: '', description: 'On failure' },
      ]),
    );
    expect(extras.throws).toEqual([
      { type: 'RangeError', description: 'When negative' },
      { description: 'On failure' },
    ]);
  });

  it('collects @see text and skips empty ones', () => {
    const extras = describeExtras(
      withTags([
        { tag: 'see', description: 'sum' },
        { tag: 'see', description: '' },
      ]),
    );
    expect(extras.see).toEqual(['sum']);
  });

  it('splits an example caption from its code', () => {
    const extras = describeExtras(
      withTags([
        { tag: 'example', description: '<caption>Basic</caption>\nrun();' },
        { tag: 'example', description: 'other();' },
        { tag: 'example', description: '<caption>Empty</caption>' },
      ]),
    );
    expect(extras.examples).toEqual([
      { caption: 'Basic', code: 'run();' },
      { code: 'other();' },
    ]);
  });
});

describe('inlineLinks', () => {
  it('splits {@link url|label} into a URL segment', () => {
    expect(inlineLinks('{@link https://a.io|Docs} more')).toEqual([
      { target: 'https://a.io', label: 'Docs', url: true },
      { text: ' more' },
    ]);
  });

  it('reads {@link target label} and bare {@link target}', () => {
    expect(
      inlineLinks('See {@link Foo#bar the bar} or {@linkcode sum}.'),
    ).toEqual([
      { text: 'See ' },
      { target: 'Foo#bar', label: 'the bar', url: false },
      { text: ' or ' },
      { target: 'sum', label: 'sum', url: false },
      { text: '.' },
    ]);
  });

  it('does not treat other schemes as URLs', () => {
    expect(inlineLinks('{@link javascript:alert(1)}')[0].url).toBe(false);
  });

  it('returns plain text as a single segment', () => {
    expect(inlineLinks('plain')).toEqual([{ text: 'plain' }]);
  });
});
