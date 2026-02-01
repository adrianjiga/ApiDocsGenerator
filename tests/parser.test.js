import { describe, it, expect } from 'vitest';
import path from 'path';
import {
  parseJSDoc,
  extractFunctions,
  parseFile,
  scanDirectory,
  parseDirectory,
} from '../src/parser.js';

describe('parseJSDoc', () => {
  it('extracts a single JSDoc block', () => {
    const source = `
      /**
       * Adds two numbers
       * @param {number} a - First
       * @param {number} b - Second
       * @returns {number} Sum
       */
      function add(a, b) { return a + b; }
      `;
    const result = parseJSDoc(source);
    expect(result).toHaveLength(1);
    expect(result[0].parsed.description).toContain('Adds two numbers');
  });

  it('extracts multiple JSDoc blocks', () => {
    const source = `
      /**
       * First function
       */
      function a() {}

      /**
       * Second function
       */
      function b() {}
      `;
    const result = parseJSDoc(source);
    expect(result).toHaveLength(2);
  });

  it('returns empty array for code without JSDoc', () => {
    const source = 'function add(a, b) { return a + b; }';
    expect(parseJSDoc(source)).toHaveLength(0);
  });

  it('ignores regular block comments', () => {
    const source = '/* not jsdoc */ function a() {}';
    expect(parseJSDoc(source)).toHaveLength(0);
  });

  it('records correct line numbers', () => {
    const source = `const x = 1;
      const y = 2;
      /**
       * My func
       */
      function myFunc() {}`;
    const result = parseJSDoc(source);
    expect(result[0].loc.start.line).toBe(3);
  });
});

describe('extractFunctions', () => {
  it('extracts function declarations', () => {
    const source = 'function hello(name) { return name; }';
    const result = extractFunctions(source);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'function',
      name: 'hello',
      params: ['name'],
    });
  });

  it('extracts arrow functions assigned to const', () => {
    const source = 'const greet = (name) => `Hi ${name}`;';
    const result = extractFunctions(source);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'function',
      name: 'greet',
      params: ['name'],
    });
  });

  it('extracts function expressions assigned to const', () => {
    const source = 'const greet = function(name) { return name; };';
    const result = extractFunctions(source);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('greet');
  });

  it('extracts Express GET routes', () => {
    const source = 'app.get("/users/:id", (req, res) => {});';
    const result = extractFunctions(source);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'route',
      method: 'GET',
      path: '/users/:id',
      params: ['id'],
    });
  });

  it('extracts Express POST routes', () => {
    const source = 'app.post("/users", (req, res) => {});';
    const result = extractFunctions(source);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'route',
      method: 'POST',
      path: '/users',
      params: [],
    });
  });

  it('extracts multiple route methods', () => {
    const source = `
      app.get("/items", (req, res) => {});
      app.put("/items/:id", (req, res) => {});
      app.delete("/items/:id", (req, res) => {});
      app.patch("/items/:id", (req, res) => {});
      `;
    const result = extractFunctions(source);
    const methods = result.map((r) => r.method);
    expect(methods).toEqual(['GET', 'PUT', 'DELETE', 'PATCH']);
  });

  it('extracts rest parameters', () => {
    const source = 'function test(...args) {}';
    const result = extractFunctions(source);
    expect(result[0].params).toEqual(['...args']);
  });

  it('returns empty array for code with no functions or routes', () => {
    const source = 'const x = 42;';
    expect(extractFunctions(source)).toHaveLength(0);
  });

  it('extracts routes with multiple params', () => {
    const source = 'app.get("/orgs/:orgId/users/:userId", (req, res) => {});';
    const result = extractFunctions(source);
    expect(result[0].params).toEqual(['orgId', 'userId']);
  });

  it('includes line numbers', () => {
    const source = `
      const x = 1;
      const y = 2;
      function myFunc() {}`;
    const result = extractFunctions(source);
    expect(result[0].line).toBe(3);
  });
});

describe('parseFile', () => {
  const examplesDir = path.resolve('examples');

  it('parses sample-app.js and extracts functions and routes', () => {
    const result = parseFile(path.join(examplesDir, 'sample-app.js'));
    expect(result.fileName).toBe('sample-app.js');
    expect(result.functions.length).toBeGreaterThan(0);
    expect(result.routes.length).toBeGreaterThan(0);
  });

  it('matches JSDoc to the correct function', () => {
    const result = parseFile(path.join(examplesDir, 'sample-app.js'));
    const sumFn = result.functions.find((f) => f.name === 'sum');
    expect(sumFn).toBeDefined();
    expect(sumFn.jsdoc).not.toBeNull();
    expect(sumFn.description).toContain('sum');
  });

  it('parses advanced-sample.js with fully documented functions', () => {
    const result = parseFile(path.join(examplesDir, 'advanced-sample.js'));
    expect(result.functions.length).toBe(3);
    result.functions.forEach((fn) => {
      expect(fn.jsdoc).not.toBeNull();
    });
  });

  it('separates functions and routes correctly', () => {
    const result = parseFile(path.join(examplesDir, 'sample-app.js'));
    result.functions.forEach((fn) => {
      expect(fn).toHaveProperty('name');
      expect(fn).toHaveProperty('params');
    });
    result.routes.forEach((route) => {
      expect(route).toHaveProperty('method');
      expect(route).toHaveProperty('path');
    });
  });
});

describe('scanDirectory', () => {
  it('finds JS files in the examples directory', () => {
    const files = scanDirectory(path.resolve('examples'));
    expect(files.length).toBeGreaterThan(0);
    files.forEach((f) => {
      expect(f).toMatch(/\.(js|ts|jsx|tsx)$/);
    });
  });

  it('excludes node_modules by default', () => {
    const files = scanDirectory(path.resolve('.'));
    files.forEach((f) => {
      expect(f).not.toContain('node_modules');
    });
  });
});

describe('parseDirectory', () => {
  it('returns parsed metadata for all files in a directory', () => {
    const results = parseDirectory(path.resolve('examples'));
    expect(results.length).toBeGreaterThan(0);
    results.forEach((result) => {
      expect(result).toHaveProperty('file');
      expect(result).toHaveProperty('fileName');
      expect(result).toHaveProperty('functions');
      expect(result).toHaveProperty('routes');
    });
  });
});
