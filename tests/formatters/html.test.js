import { describe, it, expect } from 'vitest';
import { generateHTML } from '../../src/formatters/html.js';
import { mockApiData } from '../fixtures.js';

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
    const html = generateHTML(data);
    expect(html).toContain('app.js</a>');
    expect(html).toContain('utils.js</a>');
  });

  it('omits params and returns sections when JSDoc has no @param or @returns tags', () => {
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
              tags: [{ tag: 'deprecated', description: 'Use other fn' }],
            },
          },
        ],
        routes: [],
      },
    ];
    const html = generateHTML(data);
    expect(html).toContain('A function');
    expect(html).not.toContain('Parameters');
    expect(html).not.toContain('Returns');
  });

  it('uses custom serverUrl from config in curl example', () => {
    const html = generateHTML(mockApiData, {
      serverUrl: 'https://api.example.com',
    });
    expect(html).toContain('curl -X GET https://api.example.com/users/:id');
    expect(html).not.toContain('http://localhost:3000');
  });

  it('escapes HTML in param and return tag values', () => {
    const data = [
      {
        file: '/src/a.js',
        fileName: 'a.js',
        functions: [
          {
            name: 'fn',
            params: ['x'],
            description: 'test',
            line: 1,
            jsdoc: {
              description: 'A function',
              tags: [
                {
                  tag: 'param',
                  name: '<b>x</b>',
                  type: 'Array<string>',
                  description: 'the <em>value</em>',
                },
                {
                  tag: 'returns',
                  type: 'Map<K,V>',
                  description: 'a <b>map</b>',
                },
              ],
            },
          },
        ],
        routes: [],
      },
    ];
    const html = generateHTML(data);
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(html).toContain('Array&lt;string&gt;');
    expect(html).toContain('the &lt;em&gt;value&lt;/em&gt;');
    expect(html).toContain('Map&lt;K,V&gt;');
    expect(html).toContain('a &lt;b&gt;map&lt;/b&gt;');
  });

  it('disambiguates files sharing a basename with unique section ids', () => {
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
    const html = generateHTML(data);
    expect(html).toContain('id="a-util-js"');
    expect(html).toContain('id="b-util-js"');
    expect(html).toContain('href="#a-util-js"');
    expect(html).toContain('href="#b-util-js"');
    expect(html).toContain('<h2>a/util.js</h2>');
    expect(html).toContain('<h2>b/util.js</h2>');
  });
});
