import { describe, it, expect } from 'vitest';
import { generateJSON } from '../../src/formatters/json.js';
import { mockApiData } from '../fixtures.js';

describe('generateJSON', () => {
  it('returns valid JSON', () => {
    const result = generateJSON(mockApiData);
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it('includes meta section with tool name and version', () => {
    const parsed = JSON.parse(generateJSON(mockApiData));
    expect(parsed.meta).toBeDefined();
    expect(parsed.meta.tool).toBe('api-docs-generator');
    expect(parsed.meta.toolVersion).toBeDefined();
    expect(parsed.meta.apiVersion).toBe('1.0.0');
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
    expect(route.jsdoc).toBeNull();
  });

  it('includes route jsdoc in JSON output when present', () => {
    const data = [
      {
        file: '/src/a.js',
        fileName: 'a.js',
        functions: [],
        routes: [
          {
            method: 'GET',
            path: '/items',
            params: [],
            line: 5,
            jsdoc: {
              description: 'List items',
              tags: [{ tag: 'returns', type: 'Array', description: 'items' }],
            },
          },
        ],
      },
    ];
    const parsed = JSON.parse(generateJSON(data));
    const route = parsed.files[0].routes[0];
    expect(route.jsdoc).not.toBeNull();
    expect(route.jsdoc.description).toBe('List items');
    expect(route.jsdoc.tags).toHaveLength(1);
  });

  it('sets route jsdoc to null in JSON output when absent', () => {
    const data = [
      {
        file: '/src/a.js',
        fileName: 'a.js',
        functions: [],
        routes: [
          { method: 'POST', path: '/items', params: [], line: 10, jsdoc: null },
        ],
      },
    ];
    const parsed = JSON.parse(generateJSON(data));
    expect(parsed.files[0].routes[0].jsdoc).toBeNull();
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

  it('uses custom apiVersion from config', () => {
    const parsed = JSON.parse(
      generateJSON(mockApiData, { apiVersion: '3.0.0' }),
    );
    expect(parsed.meta.apiVersion).toBe('3.0.0');
  });

  it('handles multiple files', () => {
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
    const parsed = JSON.parse(generateJSON(data));
    expect(parsed.files).toHaveLength(2);
    expect(parsed.files[0].fileName).toBe('app.js');
    expect(parsed.files[1].fileName).toBe('utils.js');
  });
});
