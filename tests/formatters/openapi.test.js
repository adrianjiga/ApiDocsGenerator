import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { generateOpenAPI } from '../../src/formatters/openapi.js';
import { parseFile } from '../../src/parser.js';
import { makeRoute, mockApiData } from '../fixtures.js';

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

// ---------------------------------------------------------------------------
// Optional and constrained path parameters
// ---------------------------------------------------------------------------
describe('generateOpenAPI – optional path segments', () => {
  const routeAt = (routePath) => [
    {
      file: '/src/app.js',
      fileName: 'app.js',
      functions: [],
      routes: [makeRoute('GET', routePath, ['id'])],
    },
  ];

  it('splits an Express 4 optional parameter into two paths', () => {
    const spec = parse(routeAt('/opt/:id?'));
    expect(Object.keys(spec.paths)).toEqual(['/opt', '/opt/{id}']);
    expect(spec.paths['/opt'].get.operationId).toBe('get-opt');
    expect(spec.paths['/opt'].get.parameters).toBeUndefined();
    expect(spec.paths['/opt/{id}'].get.operationId).toBe('get-opt-id');
    expect(spec.paths['/opt/{id}'].get.parameters[0].required).toBe(true);
  });

  it('splits an Express 5 optional brace group into two paths', () => {
    const spec = parse(routeAt('/files{/:id}'));
    expect(Object.keys(spec.paths)).toEqual(['/files', '/files/{id}']);
  });

  it('expands every combination of several optional parameters', () => {
    const spec = parse(routeAt('/a/:x?/:y?'));
    expect(Object.keys(spec.paths)).toEqual([
      '/a',
      '/a/{y}',
      '/a/{x}',
      '/a/{x}/{y}',
    ]);
  });

  it('uses / when everything in the path is optional', () => {
    const spec = parse(routeAt('/:lang?'));
    expect(Object.keys(spec.paths)).toEqual(['/', '/{lang}']);
    expect(spec.paths['/'].get.operationId).toBe('get');
  });

  it('drops regex constraints from parameters', () => {
    const spec = parse(routeAt('/users/:id(\\d+)'));
    expect(Object.keys(spec.paths)).toEqual(['/users/{id}']);
    expect(spec.paths['/users/{id}'].get.operationId).toBe('get-users-id');
  });
});

// ---------------------------------------------------------------------------
// JSDoc-driven details
// ---------------------------------------------------------------------------
describe('generateOpenAPI – JSDoc details', () => {
  const tag = (name, type, description, extra = {}) => ({
    tag: 'param',
    name,
    type,
    description,
    ...extra,
  });
  const withJsdoc = (method, routePath, params, jsdoc) => [
    {
      file: '/src/app.js',
      fileName: 'app.js',
      functions: [],
      routes: [makeRoute(method, routePath, params, jsdoc)],
    },
  ];

  it('describes path parameters from their @param tags', () => {
    const spec = parse(
      withJsdoc('GET', '/users/:id', ['id'], {
        description: 'Get a user',
        tags: [tag('id', 'integer', '- The user id')],
      }),
    );
    expect(spec.paths['/users/{id}'].get.parameters).toEqual([
      {
        name: 'id',
        in: 'path',
        required: true,
        description: 'The user id',
        schema: { type: 'integer' },
      },
    ]);
  });

  it('accepts params.<name> tags for path parameters', () => {
    const spec = parse(
      withJsdoc('GET', '/users/:id', ['id'], {
        description: 'Get a user',
        tags: [tag('params.id', 'string', 'The id')],
      }),
    );
    expect(spec.paths['/users/{id}'].get.parameters[0].description).toBe(
      'The id',
    );
  });

  it('uses the @returns description for the success response', () => {
    const spec = parse(
      withJsdoc('GET', '/users', [], {
        description: 'List users',
        tags: [{ tag: 'returns', type: 'User[]', description: 'All users' }],
      }),
    );
    expect(spec.paths['/users'].get.responses[200].description).toBe(
      'All users',
    );
  });

  it('marks @deprecated routes', () => {
    const spec = parse(
      withJsdoc('GET', '/old', [], {
        description: 'Old',
        tags: [{ tag: 'deprecated', name: '', description: '' }],
      }),
    );
    expect(spec.paths['/old'].get.deprecated).toBe(true);
  });

  it('omits deprecated for routes without the tag', () => {
    const spec = parse(withJsdoc('GET', '/new', [], { description: 'New' }));
    expect(spec.paths['/new'].get.deprecated).toBeUndefined();
  });

  it('turns query.<name> tags into query parameters', () => {
    const spec = parse(
      withJsdoc('GET', '/users', [], {
        description: 'List users',
        tags: [
          tag('query.limit', 'number', 'Max results', {
            optional: true,
            default: '10',
          }),
          tag('query.q', 'string', 'Search text'),
        ],
      }),
    );
    expect(spec.paths['/users'].get.parameters).toEqual([
      {
        name: 'limit',
        in: 'query',
        required: false,
        description: 'Max results',
        schema: { type: 'number', default: 10 },
      },
      {
        name: 'q',
        in: 'query',
        required: true,
        description: 'Search text',
        schema: { type: 'string' },
      },
    ]);
  });

  it('builds a request body from body.<field> tags', () => {
    const spec = parse(
      withJsdoc('POST', '/users', [], {
        description: 'Create a user',
        tags: [
          tag('body', 'Object', 'The new user'),
          tag('body.name', 'string', 'Full name'),
          tag('body.tags', 'string[]', '', { optional: true }),
        ],
      }),
    );
    expect(spec.paths['/users'].post.requestBody).toEqual({
      description: 'The new user',
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Full name' },
              tags: { type: 'array', items: { type: 'string' } },
            },
            required: ['name'],
          },
        },
      },
    });
  });

  it('uses the body type alone when no fields are documented', () => {
    const spec = parse(
      withJsdoc('PUT', '/flags', [], {
        description: 'Set flags',
        tags: [tag('body', 'boolean[]', '', { optional: true })],
      }),
    );
    expect(spec.paths['/flags'].put.requestBody).toEqual({
      required: false,
      content: {
        'application/json': {
          schema: { type: 'array', items: { type: 'boolean' } },
        },
      },
    });
  });

  it('omits requestBody when no body is documented', () => {
    const spec = parse(withJsdoc('POST', '/x', [], { description: 'X' }));
    expect(spec.paths['/x'].post.requestBody).toBeUndefined();
  });

  it('reads real JSDoc through the parser', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apidocs-openapi-'));
    const file = path.join(dir, 'app.js');
    fs.writeFileSync(
      file,
      `/**
 * Search items
 * @deprecated Use /v2/items
 * @param {number} [query.limit=10] - Max results
 * @param {boolean} [query.all=false] - Include archived
 * @param {string} [query.sort='asc'] - Sort order
 * @returns {Object[]} Matching items
 */
app.get('/items/:id?', handler);
`,
    );
    try {
      const api = await parseFile(file);
      const op = parse([api]).paths['/items'].get;
      expect(op.deprecated).toBe(true);
      expect(op.responses[200].description).toBe('Matching items');
      expect(op.parameters.map((p) => [p.name, p.schema.default])).toEqual([
        ['limit', 10],
        ['all', false],
        ['sort', 'asc'],
      ]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('answers 200 for a DELETE route that documents a returned body', () => {
    const spec = parse(
      withJsdoc('DELETE', '/users/:id', ['id'], {
        description: 'Delete',
        tags: [{ tag: 'returns', type: 'Object', description: 'Receipt' }],
      }),
    );
    expect(spec.paths['/users/{id}'].delete.responses).toEqual({
      200: { description: 'Receipt' },
    });
  });

  it('keeps 204 for a DELETE route that returns void', () => {
    const spec = parse(
      withJsdoc('DELETE', '/users/:id', ['id'], {
        description: 'Delete',
        tags: [{ tag: 'returns', type: 'void', description: '' }],
      }),
    );
    expect(spec.paths['/users/{id}'].delete.responses).toEqual({
      204: { description: 'No content' },
    });
  });

  it('leaves out ALL routes, which have no OpenAPI operation', () => {
    const spec = parse([
      {
        file: '/src/app.js',
        fileName: 'app.js',
        functions: [],
        routes: [
          makeRoute('ALL', '/any', []),
          makeRoute('HEAD', '/ping', []),
          makeRoute('OPTIONS', '/ping', []),
        ],
      },
    ]);
    expect(spec.paths).toEqual({
      '/ping': {
        head: expect.objectContaining({ operationId: 'head-ping' }),
        options: expect.objectContaining({ operationId: 'options-ping' }),
      },
    });
  });
});
