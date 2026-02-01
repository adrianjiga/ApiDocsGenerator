import { describe, it, expect } from 'vitest';
import { generateJSON } from '../../src/formatters/json.js';

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

describe('generateJSON', () => {
  it('returns valid JSON', () => {
    const result = generateJSON(mockApiData);
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it('includes meta section with tool name and version', () => {
    const parsed = JSON.parse(generateJSON(mockApiData));
    expect(parsed.meta).toBeDefined();
    expect(parsed.meta.tool).toBe('api-docs-generator');
    expect(parsed.meta.version).toBe('1.0.0');
    expect(parsed.meta.generated).toBeDefined();
  });

  it('includes files array with correct structure', () => {
    const parsed = JSON.parse(generateJSON(mockApiData));
    expect(parsed.files).toHaveLength(1);
    expect(parsed.files[0].fileName).toBe('app.js');
  });

  it('maps functions correctly', () => {
    const parsed = JSON.parse(generateJSON(mockApiData));
    const fn = parsed.files[0].functions[0];
    expect(fn.name).toBe('greet');
    expect(fn.params).toEqual(['name']);
    expect(fn.description).toBe('Greets a user');
    expect(fn.line).toBe(10);
    expect(fn.jsdoc.description).toBe('Greets a user');
    expect(fn.jsdoc.tags).toHaveLength(2);
  });

  it('maps routes correctly', () => {
    const parsed = JSON.parse(generateJSON(mockApiData));
    const route = parsed.files[0].routes[0];
    expect(route.method).toBe('GET');
    expect(route.path).toBe('/users/:id');
    expect(route.params).toEqual(['id']);
    expect(route.line).toBe(20);
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
            description: 'No docs',
            line: 1,
            jsdoc: null,
          },
        ],
        routes: [],
      },
    ];
    const parsed = JSON.parse(generateJSON(data));
    expect(parsed.files[0].functions[0].jsdoc).toBeNull();
  });

  it('handles empty apiData', () => {
    const parsed = JSON.parse(generateJSON([]));
    expect(parsed.files).toHaveLength(0);
    expect(parsed.meta).toBeDefined();
  });
});
