import { describe, expect, it } from 'vitest';
import { generateMarkdown } from '../../src/formatters/markdown.js';
import { makeRoute, mockApiData } from '../fixtures.js';

const typedApiData = [
  {
    file: '/src/a.ts',
    fileName: 'a.ts',
    functions: [
      {
        name: 'typed',
        params: ['a', 'b'],
        paramDetails: [
          { name: 'a', optional: false, type: 'string' },
          { name: 'b', optional: true, type: 'number', defaultValue: '1' },
        ],
        returnType: 'Promise<void>',
        description: 'No description provided',
        line: 1,
        jsdoc: null,
      },
    ],
    routes: [],
  },
];

const taggedFn = (tags) => [
  {
    file: '/src/a.js',
    fileName: 'a.js',
    functions: [
      {
        name: 'divide',
        params: ['a', 'b'],
        description: 'Divide',
        line: 1,
        jsdoc: { description: 'Divide', tags },
      },
    ],
    routes: [],
  },
];

const taggedRoute = (tags) => [
  {
    file: '/src/a.js',
    fileName: 'a.js',
    functions: [],
    routes: [
      {
        method: 'GET',
        path: '/health',
        params: [],
        line: 1,
        jsdoc: { description: 'Health', tags },
      },
    ],
  },
];

describe('generateMarkdown', () => {
  it('includes a title header', () => {
    const md = generateMarkdown(mockApiData);
    expect(md).toContain('# API Documentation');
  });

  it('includes table of contents with file links', () => {
    const md = generateMarkdown(mockApiData);
    expect(md).toContain('## Table of Contents');
    expect(md).toContain('[app.js]');
  });

  it('includes function signature', () => {
    const md = generateMarkdown(mockApiData);
    expect(md).toContain('`greet(name)`');
  });

  it('includes JSDoc description', () => {
    const md = generateMarkdown(mockApiData);
    expect(md).toContain('Greets a user');
  });

  it('includes parameter documentation', () => {
    const md = generateMarkdown(mockApiData);
    expect(md).toContain('**Parameters:**');
    expect(md).toContain('`name`');
    expect(md).toContain('`string`');
  });

  it('includes returns documentation', () => {
    const md = generateMarkdown(mockApiData);
    expect(md).toContain('**Returns:**');
    expect(md).toContain('Greeting message');
  });

  it('includes usage example', () => {
    const md = generateMarkdown(mockApiData);
    expect(md).toContain('**Usage Example:**');
    expect(md).toContain('greet(name)');
  });

  it('includes route documentation', () => {
    const md = generateMarkdown(mockApiData);
    expect(md).toContain('`GET /users/:id`');
    expect(md).toContain('**Route Parameters:** id');
  });

  it('includes curl example for routes', () => {
    const md = generateMarkdown(mockApiData);
    expect(md).toContain('curl -X GET http://localhost:3000/users/:id');
  });

  it('handles functions without jsdoc', () => {
    const data = [
      {
        file: '/src/a.js',
        fileName: 'a.js',
        functions: [
          {
            name: 'fn',
            params: ['x'],
            description: 'No docs',
            line: 1,
            jsdoc: null,
          },
        ],
        routes: [],
      },
    ];
    const md = generateMarkdown(data);
    expect(md).toContain('**Description:** No docs');
  });

  it('skips files with no functions or routes', () => {
    const data = [
      {
        file: '/src/empty.js',
        fileName: 'empty.js',
        functions: [],
        routes: [],
      },
      ...mockApiData,
    ];
    const md = generateMarkdown(data);
    expect(md).not.toContain('empty.js');
  });

  it('handles empty apiData', () => {
    const md = generateMarkdown([]);
    expect(md).toContain('# API Documentation');
  });

  it('omits route parameters section when route has no params', () => {
    const data = [
      {
        file: '/src/a.js',
        fileName: 'a.js',
        functions: [],
        routes: [{ method: 'POST', path: '/items', params: [], line: 5 }],
      },
    ];
    const md = generateMarkdown(data);
    expect(md).toContain('POST /items');
    expect(md).not.toContain('**Route Parameters:**');
  });

  it('renders multiple files in table of contents', () => {
    const data = [
      ...mockApiData,
      {
        file: '/src/utils.js',
        fileName: 'utils.js',
        functions: [
          {
            name: 'helper',
            params: [],
            description: 'Helper',
            line: 1,
            jsdoc: null,
          },
        ],
        routes: [],
      },
    ];
    const md = generateMarkdown(data);
    expect(md).toContain('[app.js]');
    expect(md).toContain('[utils.js]');
  });

  it('links table-of-contents entries to GitHub-compatible anchors', () => {
    const md = generateMarkdown(mockApiData);
    // GitHub slugs strip the dot from "app.js" -> "appjs".
    expect(md).toContain('[app.js](#appjs)');
  });

  it('omits params and returns when JSDoc has empty tags array', () => {
    const data = [
      {
        file: '/src/a.js',
        fileName: 'a.js',
        functions: [
          {
            name: 'fn',
            params: [],
            description: 'test',
            line: 1,
            jsdoc: { description: 'A function', tags: [] },
          },
        ],
        routes: [],
      },
    ];
    const md = generateMarkdown(data);
    expect(md).toContain('A function');
    expect(md).not.toContain('**Parameters:**');
    expect(md).not.toContain('**Returns:**');
  });

  it('uses custom serverUrl from config in curl example', () => {
    const md = generateMarkdown(mockApiData, {
      serverUrl: 'https://api.example.com',
    });
    expect(md).toContain('curl -X GET https://api.example.com/users/:id');
    expect(md).not.toContain('http://localhost:3000');
  });

  it('renders @return alias the same as @returns', () => {
    const data = [
      {
        file: '/src/a.js',
        fileName: 'a.js',
        functions: [
          {
            name: 'fn',
            params: [],
            description: 'test',
            line: 1,
            jsdoc: {
              description: 'A function',
              tags: [{ tag: 'return', type: 'string', description: 'result' }],
            },
          },
        ],
        routes: [],
      },
    ];
    const md = generateMarkdown(data);
    expect(md).toContain('**Returns:**');
    expect(md).toContain('result');
  });

  it('disambiguates files sharing a basename with directory prefixes', () => {
    const data = [
      {
        file: '/src/a/util.js',
        fileName: 'util.js',
        functions: [
          { name: 'aFn', params: [], description: 'x', line: 1, jsdoc: null },
        ],
        routes: [],
      },
      {
        file: '/src/b/util.js',
        fileName: 'util.js',
        functions: [
          { name: 'bFn', params: [], description: 'y', line: 1, jsdoc: null },
        ],
        routes: [],
      },
    ];
    const md = generateMarkdown(data);
    expect(md).toContain('[a/util.js](#autiljs)');
    expect(md).toContain('[b/util.js](#butiljs)');
    expect(md).toContain('## a/util.js');
    expect(md).toContain('## b/util.js');
    const utilHeadings = (md.match(/^## .*util\.js$/gm) || []).length;
    expect(utilHeadings).toBe(2);
  });

  it('accounts for earlier non-file headings when numbering anchors', () => {
    const fn = (name) => ({
      name,
      params: [],
      description: 'x',
      line: 1,
      jsdoc: null,
    });
    const data = [
      {
        file: '/src/first.js',
        fileName: 'first.js',
        functions: [fn('functions')],
        routes: [],
      },
      {
        file: '/src/functions',
        fileName: 'functions',
        functions: [fn('g')],
        routes: [],
      },
    ];
    const md = generateMarkdown(data);
    expect(md).toContain('[functions](#functions-2)');
  });

  it('prints the full @returns description', async () => {
    const { parseJSDoc } = await import('../../src/parser.js');
    const [jsdoc] = parseJSDoc(
      '/**\n * Add\n * @returns {number} The total sum\n */',
    );
    const data = [
      {
        file: '/src/a.js',
        fileName: 'a.js',
        functions: [
          {
            name: 'add',
            params: [],
            description: 'Add',
            line: 1,
            jsdoc: jsdoc.parsed,
          },
        ],
        routes: [],
      },
    ];
    expect(generateMarkdown(data)).toContain('`number`: The total sum');
  });

  it('suffixes repeated anchors the way GitHub does', () => {
    const fn = {
      name: 'f',
      params: [],
      description: 'x',
      line: 1,
      jsdoc: null,
    };
    const data = [
      { file: '/src/ab.js', fileName: 'ab.js', functions: [fn], routes: [] },
      { file: '/src/a.b.js', fileName: 'a.b.js', functions: [fn], routes: [] },
    ];
    const md = generateMarkdown(data);
    expect(md).toContain('[ab.js](#abjs)');
    expect(md).toContain('[a.b.js](#abjs-1)');
  });

  it('shows TypeScript types when there is no JSDoc', () => {
    const out = generateMarkdown(typedApiData);
    expect(out).toContain('- `a` (`string`)\n');
    expect(out).toContain('- `b` (`number`, optional, default `1`)\n');
    expect(out).toContain('- `Promise<void>`\n');
  });

  it('writes a curl -I example for HEAD routes', () => {
    const md = generateMarkdown([
      {
        file: '/src/app.js',
        fileName: 'app.js',
        functions: [],
        routes: [makeRoute('HEAD', '/ping', [])],
      },
    ]);
    expect(md).toContain('curl -I http://localhost:3000/ping');
  });

  it('shows a deprecation notice with the message', () => {
    const md = generateMarkdown(
      taggedFn([{ tag: 'deprecated', description: 'Use {@link safeDivide}' }]),
    );
    expect(md).toContain('> **Deprecated:** Use `safeDivide`\n');
  });

  it('shows a bare deprecation notice without a message', () => {
    const md = generateMarkdown(
      taggedFn([{ tag: 'deprecated', description: '' }]),
    );
    expect(md).toContain('> **Deprecated**\n');
  });

  it('lists @throws and @see, linking URLs', () => {
    const md = generateMarkdown(
      taggedFn([
        { tag: 'throws', type: 'RangeError', description: 'When b is 0' },
        { tag: 'throws', type: '', description: 'On overflow' },
        { tag: 'see', description: '{@link https://mdn.io|MDN} for numbers' },
      ]),
    );
    expect(md).toContain(
      '**Throws:**\n\n- `RangeError`: When b is 0\n- On overflow\n',
    );
    expect(md).toContain('**See:**\n\n- [MDN](https://mdn.io) for numbers\n');
  });

  it('uses @example in place of the generated usage example', () => {
    const md = generateMarkdown(
      taggedFn([
        {
          tag: 'example',
          description: '<caption>Basic</caption>\ndivide(6, 3);\n// => 2',
        },
      ]),
    );
    expect(md).toContain(
      '**Example:**\n\n_Basic_\n\n```javascript\ndivide(6, 3);\n// => 2\n```\n',
    );
    expect(md).not.toContain('**Usage Example:**');
  });

  it('labels several examples as Examples', () => {
    const md = generateMarkdown(
      taggedFn([
        { tag: 'example', description: 'a();' },
        { tag: 'example', description: 'b();' },
      ]),
    );
    expect(md).toContain('**Examples:**');
  });

  it('lengthens the fence when the example contains backticks', () => {
    const md = generateMarkdown(
      taggedFn([{ tag: 'example', description: 'const s = ```x```;' }]),
    );
    expect(md).toContain('````javascript\nconst s = ```x```;\n````\n');
  });

  it('uses a route @example in place of the generated curl request', () => {
    const md = generateMarkdown(
      taggedRoute([{ tag: 'example', description: 'curl /health' }]),
    );
    expect(md).toContain('**Example:**\n\n```\ncurl /health\n```\n');
    expect(md).not.toContain('**Example Request:**');
  });
});
