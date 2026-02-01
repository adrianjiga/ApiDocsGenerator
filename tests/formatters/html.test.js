import { describe, it, expect } from 'vitest';
import { generateHTML } from '../../src/formatters/html.js';

/**
 * Mock API data for testing.
 * @type {Array}
 */
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
            { tag: 'returns', type: 'string', description: 'Greeting' },
          ],
        },
      },
    ],
    routes: [{ method: 'GET', path: '/users/:id', params: ['id'], line: 20 }],
  },
];

describe('generateHTML', () => {
  it('returns valid HTML document', () => {
    const html = generateHTML(mockApiData);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
  });

  it('includes page title', () => {
    const html = generateHTML(mockApiData);
    expect(html).toContain('<title>API Documentation</title>');
  });

  it('includes table of contents with file links', () => {
    const html = generateHTML(mockApiData);
    expect(html).toContain('Table of Contents');
    expect(html).toContain('app.js');
  });

  it('includes function name and signature', () => {
    const html = generateHTML(mockApiData);
    expect(html).toContain('greet(name)');
  });

  it('includes JSDoc description', () => {
    const html = generateHTML(mockApiData);
    expect(html).toContain('Greets a user');
  });

  it('includes parameter documentation', () => {
    const html = generateHTML(mockApiData);
    expect(html).toContain('Parameters');
    expect(html).toContain('name');
    expect(html).toContain('string');
  });

  it('includes returns documentation', () => {
    const html = generateHTML(mockApiData);
    expect(html).toContain('Returns');
    expect(html).toContain('Greeting');
  });

  it('includes route with method badge', () => {
    const html = generateHTML(mockApiData);
    expect(html).toContain('method-badge');
    expect(html).toContain('GET');
    expect(html).toContain('/users/:id');
  });

  it('includes route parameters', () => {
    const html = generateHTML(mockApiData);
    expect(html).toContain('Route Parameters');
    expect(html).toContain('id');
  });

  it('includes curl example for routes', () => {
    const html = generateHTML(mockApiData);
    expect(html).toContain('curl -X GET http://localhost:3000/users/:id');
  });

  it('includes footer with generator name', () => {
    const html = generateHTML(mockApiData);
    expect(html).toContain('api-docs-generator');
  });

  it('handles functions without jsdoc', () => {
    const data = [
      {
        file: '/src/a.js',
        fileName: 'a.js',
        functions: [
          {
            name: 'fn',
            params: [],
            description: 'Undocumented',
            line: 1,
            jsdoc: null,
          },
        ],
        routes: [],
      },
    ];
    const html = generateHTML(data);
    expect(html).toContain('Undocumented');
  });

  it('handles empty apiData', () => {
    const html = generateHTML([]);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).not.toContain('Table of Contents');
  });

  it('includes embedded CSS styles', () => {
    const html = generateHTML(mockApiData);
    expect(html).toContain('<style>');
  });

  it('sanitizes file names for HTML ids', () => {
    const data = [
      {
        file: '/src/my file.js',
        fileName: 'my file.js',
        functions: [
          { name: 'fn', params: [], description: 'test', line: 1, jsdoc: null },
        ],
        routes: [],
      },
    ];
    const html = generateHTML(data);
    expect(html).toContain('id="my-file-js"');
  });

  it('escapes HTML in function descriptions', () => {
    const data = [
      {
        file: '/src/a.js',
        fileName: 'a.js',
        functions: [
          {
            name: 'fn',
            params: [],
            description: '<img onerror=alert(1)>',
            line: 1,
            jsdoc: null,
          },
        ],
        routes: [],
      },
    ];
    const html = generateHTML(data);
    expect(html).not.toContain('<img onerror');
    expect(html).toContain('&lt;img onerror');
  });

  it('escapes HTML in function names', () => {
    const data = [
      {
        file: '/src/a.js',
        fileName: 'a.js',
        functions: [
          {
            name: '<script>',
            params: [],
            description: 'test',
            line: 1,
            jsdoc: null,
          },
        ],
        routes: [],
      },
    ];
    const html = generateHTML(data);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes HTML in route paths', () => {
    const data = [
      {
        file: '/src/a.js',
        fileName: 'a.js',
        functions: [],
        routes: [
          {
            method: 'GET',
            path: '/x"><script>alert(1)</script>',
            params: [],
            line: 1,
          },
        ],
      },
    ];
    const html = generateHTML(data);
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
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
    const html = generateHTML(data);
    expect(html).toContain('POST');
    expect(html).toContain('/items');
    expect(html).not.toContain('Route Parameters');
  });
});
