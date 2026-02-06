import { describe, it, expect, vi } from 'vitest';
import { analyzeCoverage, checkRouteDocumentation } from '../src/analyzer.js';
import { makeFunction, makeRoute, fullyDocumentedJsdoc } from './fixtures.js';

describe('analyzeCoverage', () => {
  it('returns 100% coverage for fully documented functions', () => {
    const apiData = [
      {
        file: '/src/a.js',
        fileName: 'a.js',
        functions: [
          makeFunction('greet', ['name'], fullyDocumentedJsdoc(['name'])),
        ],
        routes: [],
      },
    ];
    const result = analyzeCoverage(apiData);
    expect(result.summary.coveragePercentage).toBe(100);
    expect(result.gaps).toHaveLength(0);
    expect(result.summary.totalFunctions).toBe(1);
    expect(result.summary.documentedFunctions).toBe(1);
    expect(result.summary.partiallyDocumented).toBe(0);
    expect(result.summary.totalRoutes).toBe(0);
    expect(result.summary.documentedRoutes).toBe(0);
  });

  it('returns 0% coverage for undocumented functions', () => {
    const apiData = [
      {
        file: '/src/a.js',
        fileName: 'a.js',
        functions: [makeFunction('greet', ['name'], null)],
        routes: [],
      },
    ];
    const result = analyzeCoverage(apiData);
    expect(result.summary.coveragePercentage).toBe(0);
    expect(result.gaps).toHaveLength(1);
    expect(result.gaps[0].severity).toBe('error');
    expect(result.gaps[0].type).toBe('function');
    expect(result.gaps[0].functionSignature).toBe('greet(name)');
  });

  it('detects partially documented functions as gaps with warning severity', () => {
    const partialJsdoc = {
      description: 'Some description',
      tags: [],
    };
    const apiData = [
      {
        file: '/src/a.js',
        fileName: 'a.js',
        functions: [makeFunction('greet', ['name'], partialJsdoc)],
        routes: [],
      },
    ];
    const result = analyzeCoverage(apiData);
    expect(result.summary.coveragePercentage).toBe(0);
    expect(result.summary.partiallyDocumented).toBe(1);
    expect(result.gaps[0].severity).toBe('warning');
    expect(result.gaps[0].type).toBe('function');
    expect(result.gaps[0].functionSignature).toBe('greet(name)');
  });

  it('counts routes without jsdoc as undocumented', () => {
    const apiData = [
      {
        file: '/src/a.js',
        fileName: 'a.js',
        functions: [],
        routes: [makeRoute('GET', '/users', [])],
      },
    ];
    const result = analyzeCoverage(apiData);
    expect(result.summary.totalRoutes).toBe(1);
    expect(result.summary.documentedRoutes).toBe(0);
    expect(result.gaps).toHaveLength(1);
    expect(result.gaps[0].type).toBe('route');
    expect(result.gaps[0].severity).toBe('error');
  });

  it('computes per-file breakdown correctly', () => {
    const apiData = [
      {
        file: '/src/a.js',
        fileName: 'a.js',
        functions: [
          makeFunction('fn1', [], fullyDocumentedJsdoc([])),
          makeFunction('fn2', [], null),
        ],
        routes: [],
      },
    ];
    const result = analyzeCoverage(apiData);
    expect(result.files).toHaveLength(1);
    expect(result.files[0].totalItems).toBe(2);
    expect(result.files[0].documentedItems).toBe(1);
    expect(result.files[0].coveragePercentage).toBe(50);
  });

  it('handles empty apiData', () => {
    const result = analyzeCoverage([]);
    expect(result.summary.coveragePercentage).toBe(0);
    expect(result.summary.totalFunctions).toBe(0);
    expect(result.summary.totalRoutes).toBe(0);
    expect(result.gaps).toHaveLength(0);
    expect(result.files).toHaveLength(0);
  });

  it('handles multiple files', () => {
    const apiData = [
      {
        file: '/src/a.js',
        fileName: 'a.js',
        functions: [makeFunction('fn1', ['x'], fullyDocumentedJsdoc(['x']))],
        routes: [],
      },
      {
        file: '/src/b.js',
        fileName: 'b.js',
        functions: [makeFunction('fn2', ['y'], null)],
        routes: [makeRoute('POST', '/items', [])],
      },
    ];
    const result = analyzeCoverage(apiData);
    expect(result.summary.totalFunctions).toBe(2);
    expect(result.summary.documentedFunctions).toBe(1);
    expect(result.summary.totalRoutes).toBe(1);
    expect(result.summary.documentedRoutes).toBe(0);
    expect(result.files).toHaveLength(2);
  });

  it('identifies missing params in gap details', () => {
    const jsdocMissingParam = {
      description: 'A function',
      tags: [{ tag: 'returns', type: 'void', description: '' }],
    };
    const apiData = [
      {
        file: '/src/a.js',
        fileName: 'a.js',
        functions: [makeFunction('fn', ['a', 'b'], jsdocMissingParam)],
        routes: [],
      },
    ];
    const result = analyzeCoverage(apiData);
    expect(result.gaps[0].type).toBe('function');
    expect(result.gaps[0].functionSignature).toBe('fn(a, b)');
  });

  it('identifies missing returns in gap details', () => {
    const jsdocNoReturns = {
      description: 'A function',
      tags: [{ tag: 'param', name: 'x', type: 'number', description: '' }],
    };
    const apiData = [
      {
        file: '/src/a.js',
        fileName: 'a.js',
        functions: [makeFunction('fn', ['x'], jsdocNoReturns)],
        routes: [],
      },
    ];
    const result = analyzeCoverage(apiData);
    expect(result.gaps[0].missing).toContain('returns');
    expect(result.gaps[0].functionSignature).toBe('fn(x)');
  });

  it('includes function signature in gap', () => {
    const apiData = [
      {
        file: '/src/a.js',
        fileName: 'a.js',
        functions: [makeFunction('myFunc', ['a', 'b'], null)],
        routes: [],
      },
    ];
    const result = analyzeCoverage(apiData);
    expect(result.gaps[0].functionSignature).toBe('myFunc(a, b)');
  });

  it('skips files with no functions or routes in per-file breakdown', () => {
    const apiData = [
      {
        file: '/src/empty.js',
        fileName: 'empty.js',
        functions: [],
        routes: [],
      },
    ];
    const result = analyzeCoverage(apiData);
    expect(result.files).toHaveLength(0);
  });

  it('treats @return the same as @returns', () => {
    const jsdocWithReturn = {
      description: 'A function',
      tags: [
        { tag: 'param', name: 'x', type: 'number', description: '' },
        { tag: 'return', type: 'number', description: 'result' },
      ],
    };
    const apiData = [
      {
        file: '/src/a.js',
        fileName: 'a.js',
        functions: [makeFunction('fn', ['x'], jsdocWithReturn)],
        routes: [],
      },
    ];
    const result = analyzeCoverage(apiData);
    expect(result.summary.documentedFunctions).toBe(1);
    expect(result.gaps).toHaveLength(0);
  });

  it('counts documented routes toward coverage', () => {
    const apiData = [
      {
        file: '/src/a.js',
        fileName: 'a.js',
        functions: [],
        routes: [
          makeRoute('GET', '/users', [], {
            description: 'Get users',
            tags: [{ tag: 'returns', type: 'Object', description: 'users' }],
          }),
        ],
      },
    ];
    const result = analyzeCoverage(apiData);
    expect(result.summary.totalRoutes).toBe(1);
    expect(result.summary.documentedRoutes).toBe(1);
    expect(result.summary.routeCoverage).toBe(100);
    expect(result.gaps).toHaveLength(0);
  });

  it('flags whitespace-only description as missing', () => {
    const jsdoc = {
      description: '   ',
      tags: [
        { tag: 'param', name: 'x', type: 'number', description: '' },
        { tag: 'returns', type: 'void', description: '' },
      ],
    };
    const apiData = [
      {
        file: '/src/a.js',
        fileName: 'a.js',
        functions: [makeFunction('fn', ['x'], jsdoc)],
        routes: [],
      },
    ];
    const result = analyzeCoverage(apiData);
    expect(result.gaps[0].missing).toContain('description');
    expect(result.gaps[0].severity).toBe('warning');
  });

  it('fully documents zero-param function with only @returns', () => {
    const jsdoc = {
      description: 'Does something',
      tags: [{ tag: 'returns', type: 'void', description: '' }],
    };
    const apiData = [
      {
        file: '/src/a.js',
        fileName: 'a.js',
        functions: [makeFunction('fn', [], jsdoc)],
        routes: [],
      },
    ];
    const result = analyzeCoverage(apiData);
    expect(result.summary.documentedFunctions).toBe(1);
    expect(result.gaps).toHaveLength(0);
  });

  it('reports partially documented route as warning severity gap', () => {
    const apiData = [
      {
        file: '/src/a.js',
        fileName: 'a.js',
        functions: [],
        routes: [
          makeRoute('GET', '/users', [], {
            description: 'Get users',
            tags: [],
          }),
        ],
      },
    ];
    const result = analyzeCoverage(apiData);
    expect(result.gaps).toHaveLength(1);
    expect(result.gaps[0].severity).toBe('warning');
    expect(result.summary.partiallyDocumented).toBe(1);
  });
});

describe('checkRouteDocumentation', () => {
  it('returns all missing when jsdoc is null', () => {
    const route = makeRoute('GET', '/users', []);
    const result = checkRouteDocumentation(route);
    expect(result.isFullyDocumented).toBe(false);
    expect(result.isPartiallyDocumented).toBe(false);
    expect(result.missing).toEqual(['description', 'params', 'returns']);
  });

  it('detects missing @param for path param as partially documented', () => {
    const route = makeRoute('GET', '/users/:id', ['id'], {
      description: 'Get user',
      tags: [{ tag: 'returns', type: 'Object', description: 'user' }],
    });
    const result = checkRouteDocumentation(route);
    expect(result.isFullyDocumented).toBe(false);
    expect(result.isPartiallyDocumented).toBe(true);
    expect(result.missing).toContain('params');
  });

  it('detects description only as partially documented', () => {
    const route = makeRoute('POST', '/items', [], {
      description: 'Create item',
      tags: [],
    });
    const result = checkRouteDocumentation(route);
    expect(result.isFullyDocumented).toBe(false);
    expect(result.isPartiallyDocumented).toBe(true);
    expect(result.missing).toContain('returns');
  });

  it('returns fully documented when description + all params + returns present', () => {
    const route = makeRoute('PUT', '/users/:id', ['id'], {
      description: 'Update user',
      tags: [
        { tag: 'param', name: 'id', type: 'string', description: 'User ID' },
        { tag: 'returns', type: 'Object', description: 'updated user' },
      ],
    });
    const result = checkRouteDocumentation(route);
    expect(result.isFullyDocumented).toBe(true);
    expect(result.isPartiallyDocumented).toBe(false);
    expect(result.missing).toHaveLength(0);
  });

  it('fully documents route with no path params when description and @returns present', () => {
    const route = makeRoute('GET', '/health', [], {
      description: 'Health check',
      tags: [{ tag: 'returns', type: 'Object', description: 'status' }],
    });
    const result = checkRouteDocumentation(route);
    expect(result.isFullyDocumented).toBe(true);
  });

  it('existing field contains description and documented param names', () => {
    const route = makeRoute('GET', '/users/:id', ['id'], {
      description: 'Get user',
      tags: [
        { tag: 'param', name: 'id', type: 'string', description: 'User ID' },
      ],
    });
    const result = checkRouteDocumentation(route);
    expect(result.existing.description).toBe('Get user');
    expect(result.existing.params).toEqual(['id']);
  });
});

describe('analyzeCoverage – error scenarios', () => {
  it('returns empty result for null input', () => {
    const result = analyzeCoverage(null);
    expect(result.summary.totalFunctions).toBe(0);
    expect(result.files).toEqual([]);
    expect(result.gaps).toEqual([]);
  });

  it('returns empty result for undefined input', () => {
    const result = analyzeCoverage(undefined);
    expect(result.summary.coveragePercentage).toBe(0);
  });

  it('returns empty result for string input', () => {
    const result = analyzeCoverage('not an array');
    expect(result.summary.totalFunctions).toBe(0);
  });

  it('handles file entry with missing functions field', () => {
    const apiData = [{ file: '/a.js', fileName: 'a.js', routes: [] }];
    const result = analyzeCoverage(apiData);
    expect(result.summary.totalFunctions).toBe(0);
  });

  it('handles file entry with missing routes field', () => {
    const apiData = [{ file: '/a.js', fileName: 'a.js', functions: [] }];
    const result = analyzeCoverage(apiData);
    expect(result.summary.totalRoutes).toBe(0);
  });

  it('handles function with missing params array gracefully', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const apiData = [
      {
        file: '/a.js',
        fileName: 'a.js',
        functions: [{ name: 'broken', jsdoc: null }],
        routes: [],
      },
    ];
    const result = analyzeCoverage(apiData);
    // Should warn but not crash
    expect(result.summary.totalFunctions).toBe(1);
    vi.restoreAllMocks();
  });

  it('handles empty array input', () => {
    const result = analyzeCoverage([]);
    expect(result.summary.totalFunctions).toBe(0);
    expect(result.summary.coveragePercentage).toBe(0);
    expect(result.files).toEqual([]);
    expect(result.gaps).toEqual([]);
  });
});
