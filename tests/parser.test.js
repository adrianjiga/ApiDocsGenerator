import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  parseJSDoc,
  extractFunctions,
  parseFile,
  scanDirectory,
  parseDirectory,
} from '../src/parser.js';

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

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
    expect(result[0].parsed.tags).toHaveLength(3);
    expect(result[0].parsed.tags[0]).toMatchObject({
      description: '- First',
      name: 'a',
      type: 'number',
    });
    expect(result[0].parsed.tags[1]).toMatchObject({
      description: '- Second',
      name: 'b',
      type: 'number',
    });
    expect(result[0].parsed.tags[2]).toMatchObject({
      description: '',
      type: 'number',
    });
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
    expect(result[0].parsed.description).toContain('First function');
    expect(result[1].parsed.description).toContain('Second function');
    expect(result[0].loc.start.line).toBe(2);
    expect(result[1].loc.start.line).toBe(7);
    expect(result[0].loc.end.line).toBe(4);
    expect(result[1].loc.end.line).toBe(9);
    expect(result[0].parsed.tags).toHaveLength(0);
    expect(result[1].parsed.tags).toHaveLength(0);
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

  it('returns empty array for malformed JavaScript', () => {
    const source = 'function %%% invalid {{{';
    expect(extractFunctions(source)).toHaveLength(0);
  });

  it('extracts property names from destructured parameters', () => {
    const source = 'function test({a, b}) {}';
    const result = extractFunctions(source);
    expect(result).toHaveLength(1);
    expect(result[0].params).toEqual(['{a, b}']);
  });

  it('extracts array destructured parameters', () => {
    const source = 'function test([x, y]) {}';
    const result = extractFunctions(source);
    expect(result).toHaveLength(1);
    expect(result[0].params).toEqual(['[x, y]']);
  });

  it('extracts rest inside object destructuring', () => {
    const source = 'function test({a, ...rest}) {}';
    const result = extractFunctions(source);
    expect(result).toHaveLength(1);
    expect(result[0].params).toEqual(['{a, ...rest}']);
  });

  it('extracts destructured params in arrow functions', () => {
    const source = 'const fn = ({name, id}) => {};';
    const result = extractFunctions(source);
    expect(result).toHaveLength(1);
    expect(result[0].params).toEqual(['{name, id}']);
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
    expect(result[0].line).toBe(4);
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

  it('matches JSDoc exactly 1 line away from function', () => {
    const tmpFile = path.join(os.tmpdir(), 'jsdoc-close.js');
    fs.writeFileSync(
      tmpFile,
      '/**\n * My func\n * @param {string} x\n */\nfunction close(x) {}\n',
    );
    try {
      const result = parseFile(tmpFile);
      const fn = result.functions.find((f) => f.name === 'close');
      expect(fn.jsdoc).not.toBeNull();
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  it('does not match JSDoc 3+ lines away from function', () => {
    const tmpFile = path.join(os.tmpdir(), 'jsdoc-far.js');
    fs.writeFileSync(
      tmpFile,
      '/** @param {string} x */\n\n\n\nfunction far(x) {}\n',
    );
    try {
      const result = parseFile(tmpFile);
      const fn = result.functions.find((f) => f.name === 'far');
      expect(fn.jsdoc).toBeNull();
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  it('attaches JSDoc to routes when present', () => {
    const tmpFile = path.join(os.tmpdir(), 'route-jsdoc.js');
    fs.writeFileSync(
      tmpFile,
      '/**\n * Get all users\n */\napp.get("/users", (req, res) => {});\n',
    );
    try {
      const result = parseFile(tmpFile);
      expect(result.routes).toHaveLength(1);
      expect(result.routes[0].jsdoc).not.toBeNull();
      expect(result.routes[0].jsdoc.description).toContain('Get all users');
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  it('sets jsdoc to null on routes without JSDoc', () => {
    const tmpFile = path.join(os.tmpdir(), 'route-no-jsdoc.js');
    fs.writeFileSync(tmpFile, 'app.get("/users", (req, res) => {});\n');
    try {
      const result = parseFile(tmpFile);
      expect(result.routes).toHaveLength(1);
      expect(result.routes[0].jsdoc).toBeNull();
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  it('does not match JSDoc 3+ lines away from route', () => {
    const tmpFile = path.join(os.tmpdir(), 'route-far-jsdoc.js');
    fs.writeFileSync(
      tmpFile,
      '/**\n * Get users\n */\n\n\n\napp.get("/users", (req, res) => {});\n',
    );
    try {
      const result = parseFile(tmpFile);
      expect(result.routes).toHaveLength(1);
      expect(result.routes[0].jsdoc).toBeNull();
    } finally {
      fs.unlinkSync(tmpFile);
    }
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

  it('excludes directories matching custom excludePattern', () => {
    const files = scanDirectory(path.resolve('.'), 'node_modules|examples');
    files.forEach((f) => {
      expect(f).not.toContain('examples');
    });
  });

  it('returns empty array and warns for unreadable directory', () => {
    const files = scanDirectory('/nonexistent/path/xyz');
    expect(files).toHaveLength(0);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Could not read directory'),
    );
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
