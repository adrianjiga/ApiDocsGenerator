import { describe, it, expect } from 'vitest';
import yaml from 'js-yaml';
import { generateOpenAPI } from '../../src/formatters/openapi.js';
import { mockApiData, makeRoute } from '../fixtures.js';

/** Helper: parse the YAML output into a JS object. */
function parse(apiData) {
  return yaml.load(generateOpenAPI(apiData));
}

// ---------------------------------------------------------------------------
// Basic output
// ---------------------------------------------------------------------------
describe('generateOpenAPI – basic output', () => {
  it('returns a string', () => {
    expect(typeof generateOpenAPI(mockApiData)).toBe('string');
  });

  it('returns valid YAML', () => {
    expect(() => yaml.load(generateOpenAPI(mockApiData))).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------
describe('generateOpenAPI – metadata', () => {
  it('sets openapi version to 3.0.3', () => {
    const spec = parse(mockApiData);
    expect(spec.openapi).toBe('3.0.3');
  });

  it('includes info object with title and version', () => {
    const spec = parse(mockApiData);
    expect(spec.info.title).toBe('API Documentation');
    expect(spec.info.version).toBe('1.0.0');
  });

  it('includes x-generator extension', () => {
    const spec = parse(mockApiData);
    expect(spec.info['x-generator']).toBe('api-docs-generator');
  });

  it('includes x-generated-at timestamp', () => {
    const spec = parse(mockApiData);
    expect(spec.info['x-generated-at']).toBeDefined();
    expect(() => new Date(spec.info['x-generated-at'])).not.toThrow();
  });

  it('includes default server', () => {
    const spec = parse(mockApiData);
    expect(spec.servers).toHaveLength(1);
    expect(spec.servers[0].url).toBe('http://localhost:3000');
    expect(spec.servers[0].description).toBe('Default development server');
  });
});

// ---------------------------------------------------------------------------
// Path conversion
// ---------------------------------------------------------------------------
describe('generateOpenAPI – path conversion', () => {
  it('converts :param to {param}', () => {
    const spec = parse(mockApiData);
    expect(spec.paths['/users/{id}']).toBeDefined();
    expect(spec.paths['/users/:id']).toBeUndefined();
  });

  it('converts multiple params', () => {
    const data = [
      {
        file: '/src/app.js',
        fileName: 'app.js',
        functions: [],
        routes: [
          makeRoute('GET', '/users/:userId/posts/:postId', [
            'userId',
            'postId',
          ]),
        ],
      },
    ];
    const spec = parse(data);
    expect(spec.paths['/users/{userId}/posts/{postId}']).toBeDefined();
  });

  it('leaves paths without params unchanged', () => {
    const data = [
      {
        file: '/src/app.js',
        fileName: 'app.js',
        functions: [],
        routes: [makeRoute('GET', '/health', [])],
      },
    ];
    const spec = parse(data);
    expect(spec.paths['/health']).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Path grouping
// ---------------------------------------------------------------------------
describe('generateOpenAPI – path grouping', () => {
  it('groups different methods under the same path', () => {
    const data = [
      {
        file: '/src/app.js',
        fileName: 'app.js',
        functions: [],
        routes: [
          makeRoute('GET', '/items', []),
          makeRoute('POST', '/items', []),
        ],
      },
    ];
    const spec = parse(data);
    expect(spec.paths['/items'].get).toBeDefined();
    expect(spec.paths['/items'].post).toBeDefined();
  });

  it('groups routes from different files under the same path', () => {
    const data = [
      {
        file: '/src/a.js',
        fileName: 'a.js',
        functions: [],
        routes: [makeRoute('GET', '/shared', [])],
      },
      {
        file: '/src/b.js',
        fileName: 'b.js',
        functions: [],
        routes: [makeRoute('POST', '/shared', [])],
      },
    ];
    const spec = parse(data);
    expect(spec.paths['/shared'].get).toBeDefined();
    expect(spec.paths['/shared'].post).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------
describe('generateOpenAPI – operations', () => {
  it('uses lowercase method as the key', () => {
    const spec = parse(mockApiData);
    expect(spec.paths['/users/{id}'].get).toBeDefined();
    expect(spec.paths['/users/{id}'].GET).toBeUndefined();
  });

  it('sets summary to METHOD /path by default', () => {
    const spec = parse(mockApiData);
    expect(spec.paths['/users/{id}'].get.summary).toBe('GET /users/{id}');
  });

  it('derives operationId from method and path', () => {
    const spec = parse(mockApiData);
    expect(spec.paths['/users/{id}'].get.operationId).toBe('get-users-id');
  });

  it('includes tags with source file name', () => {
    const spec = parse(mockApiData);
    expect(spec.paths['/users/{id}'].get.tags).toEqual(['app.js']);
  });

  it('includes 200 response', () => {
    const spec = parse(mockApiData);
    expect(spec.paths['/users/{id}'].get.responses[200].description).toBe(
      'Successful response',
    );
  });
});

// ---------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------
describe('generateOpenAPI – parameters', () => {
  it('includes parameters when route has path params', () => {
    const spec = parse(mockApiData);
    const params = spec.paths['/users/{id}'].get.parameters;
    expect(params).toHaveLength(1);
    expect(params[0].name).toBe('id');
    expect(params[0].in).toBe('path');
    expect(params[0].required).toBe(true);
  });

  it('sets parameter schema type to string', () => {
    const spec = parse(mockApiData);
    expect(spec.paths['/users/{id}'].get.parameters[0].schema.type).toBe(
      'string',
    );
  });

  it('omits parameters key when route has no params', () => {
    const data = [
      {
        file: '/src/app.js',
        fileName: 'app.js',
        functions: [],
        routes: [makeRoute('GET', '/health', [])],
      },
    ];
    const spec = parse(data);
    expect(spec.paths['/health'].get.parameters).toBeUndefined();
  });

  it('lists multiple parameters', () => {
    const data = [
      {
        file: '/src/app.js',
        fileName: 'app.js',
        functions: [],
        routes: [
          makeRoute('GET', '/users/:userId/posts/:postId', [
            'userId',
            'postId',
          ]),
        ],
      },
    ];
    const spec = parse(data);
    const params = spec.paths['/users/{userId}/posts/{postId}'].get.parameters;
    expect(params).toHaveLength(2);
    expect(params[0].name).toBe('userId');
    expect(params[1].name).toBe('postId');
  });
});

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------
describe('generateOpenAPI – tags', () => {
  it('includes tags when routes exist', () => {
    const spec = parse(mockApiData);
    expect(spec.tags).toBeDefined();
    expect(spec.tags.length).toBeGreaterThan(0);
  });

  it('sets tag name and description from source file', () => {
    const spec = parse(mockApiData);
    const tag = spec.tags.find((t) => t.name === 'app.js');
    expect(tag).toBeDefined();
    expect(tag.description).toBe('Routes from app.js');
  });

  it('omits tags when no routes exist', () => {
    const data = [
      {
        file: '/src/a.js',
        fileName: 'a.js',
        functions: [],
        routes: [],
      },
    ];
    const spec = parse(data);
    expect(spec.tags).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
describe('generateOpenAPI – edge cases', () => {
  it('produces valid spec with empty apiData', () => {
    const spec = parse([]);
    expect(spec.openapi).toBe('3.0.3');
    expect(spec.paths).toEqual({});
  });

  it('handles files with no routes', () => {
    const data = [
      {
        file: '/src/utils.js',
        fileName: 'utils.js',
        functions: [
          {
            name: 'helper',
            params: [],
            description: 'h',
            line: 1,
            jsdoc: null,
          },
        ],
        routes: [],
      },
    ];
    const spec = parse(data);
    expect(spec.paths).toEqual({});
    expect(spec.tags).toBeUndefined();
  });

  it('handles multiple files with routes', () => {
    const data = [
      {
        file: '/src/users.js',
        fileName: 'users.js',
        functions: [],
        routes: [makeRoute('GET', '/users', [])],
      },
      {
        file: '/src/posts.js',
        fileName: 'posts.js',
        functions: [],
        routes: [makeRoute('GET', '/posts', [])],
      },
    ];
    const spec = parse(data);
    expect(Object.keys(spec.paths)).toHaveLength(2);
    expect(spec.tags).toHaveLength(2);
  });

  it('uses jsdoc description as summary when available', () => {
    const data = [
      {
        file: '/src/app.js',
        fileName: 'app.js',
        functions: [],
        routes: [
          makeRoute('GET', '/items', [], {
            description: 'List all items',
            tags: [],
          }),
        ],
      },
    ];
    const spec = parse(data);
    expect(spec.paths['/items'].get.summary).toBe('List all items');
  });

  it('keeps the first route when the same path and method repeat', () => {
    const data = [
      {
        file: '/src/a.js',
        fileName: 'a.js',
        functions: [],
        routes: [
          makeRoute('GET', '/users', [], {
            description: 'from a',
            tags: [],
          }),
        ],
      },
      {
        file: '/src/b.js',
        fileName: 'b.js',
        functions: [],
        routes: [
          makeRoute('GET', '/users', [], {
            description: 'from b',
            tags: [],
          }),
        ],
      },
    ];
    const spec = parse(data);
    expect(spec.paths['/users'].get.summary).toBe('from a');
    expect(spec.paths['/users'].get.operationId).toBe('get-users');
    expect(spec.paths['/users'].get.tags).toEqual(['a.js']);
  });
});

// ---------------------------------------------------------------------------
// Config overrides
// ---------------------------------------------------------------------------
describe('generateOpenAPI – config overrides', () => {
  it('uses custom apiTitle, apiVersion, and serverUrl from config', () => {
    const config = {
      apiTitle: 'Custom API',
      apiVersion: '2.0.0',
      serverUrl: 'https://api.example.com',
    };
    const spec = yaml.load(generateOpenAPI(mockApiData, config));
    expect(spec.info.title).toBe('Custom API');
    expect(spec.info.version).toBe('2.0.0');
    expect(spec.servers[0].url).toBe('https://api.example.com');
  });
});

// ---------------------------------------------------------------------------
// All HTTP methods
// ---------------------------------------------------------------------------
describe('generateOpenAPI – HTTP methods', () => {
  const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

  for (const method of methods) {
    it(`supports ${method}`, () => {
      const data = [
        {
          file: '/src/app.js',
          fileName: 'app.js',
          functions: [],
          routes: [makeRoute(method, '/test', [])],
        },
      ];
      const spec = parse(data);
      expect(spec.paths['/test'][method.toLowerCase()]).toBeDefined();
    });
  }
});
