import { describe, it, expect } from 'vitest';
import { generateMarkdown } from '../../src/formatters/markdown.js';

const mockApiData = [
  {
    file: '/src/app.js',
    fileName: 'app.js',
    functions: [
      {
        name: 'greet',
        params: ['name'],
        description: 'Greets a user',
        line: 10,
        jsdoc: {
          description: 'Greets a user',
          tags: [
            {
              tag: 'param',
              name: 'name',
              type: 'string',
              description: 'The name',
            },
            { tag: 'returns', type: 'string', description: 'Greeting message' },
          ],
        },
      },
    ],
    routes: [{ method: 'GET', path: '/users/:id', params: ['id'], line: 20 }],
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
    expect(md).toContain('greet(arg_name)');
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
});
