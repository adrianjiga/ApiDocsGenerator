import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  extractFunctions,
  matchJSDocToItems,
  parseFile,
} from '../src/parser.js';

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TypeScript parsing', () => {
  it('parses a function with type annotations', () => {
    const source =
      'function add(a: number, b: number): number { return a + b; }';
    const result = extractFunctions(source);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'function',
      name: 'add',
      params: ['a', 'b'],
    });
  });

  it('parses an arrow function with typed parameters', () => {
    const source = 'const greet = (name: string): string => name;';
    const result = extractFunctions(source);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'function',
      name: 'greet',
      params: ['name'],
    });
  });

  it('extracts zero functions from an interface', () => {
    const source = 'interface User { name: string; age: number; }';
    const result = extractFunctions(source);
    expect(result).toHaveLength(0);
  });

  it('extracts zero functions from an enum', () => {
    const source = 'enum Color { Red, Green, Blue }';
    const result = extractFunctions(source);
    expect(result).toHaveLength(0);
  });

  it('handles default parameter values', () => {
    const source = 'function greet(name = "world") { return name; }';
    const result = extractFunctions(source);
    expect(result).toHaveLength(1);
    expect(result[0].params).toEqual(['name']);
  });

  it('handles typed default parameter values', () => {
    const source =
      'function greet(name: string = "world"): string { return name; }';
    const result = extractFunctions(source);
    expect(result).toHaveLength(1);
    expect(result[0].params).toEqual(['name']);
  });
});

describe('async / generator flags', () => {
  it('detects async function', () => {
    const source = 'async function fetchData() {}';
    const result = extractFunctions(source);
    expect(result).toHaveLength(1);
    expect(result[0].async).toBe(true);
    expect(result[0].generator).toBe(false);
  });

  it('detects generator function', () => {
    const source = 'function* generate() {}';
    const result = extractFunctions(source);
    expect(result).toHaveLength(1);
    expect(result[0].async).toBe(false);
    expect(result[0].generator).toBe(true);
  });

  it('detects async generator function', () => {
    const source = 'async function* stream() {}';
    const result = extractFunctions(source);
    expect(result).toHaveLength(1);
    expect(result[0].async).toBe(true);
    expect(result[0].generator).toBe(true);
  });

  it('detects async arrow function', () => {
    const source = 'const fetchData = async () => {};';
    const result = extractFunctions(source);
    expect(result).toHaveLength(1);
    expect(result[0].async).toBe(true);
    expect(result[0].generator).toBe(false);
  });

  it('sets both false for plain function', () => {
    const source = 'function plain() {}';
    const result = extractFunctions(source);
    expect(result).toHaveLength(1);
    expect(result[0].async).toBe(false);
    expect(result[0].generator).toBe(false);
  });
});

describe('export tracking', () => {
  it('detects export function declaration', () => {
    const source = 'export function hello() {}';
    const result = extractFunctions(source);
    expect(result).toHaveLength(1);
    expect(result[0].exported).toBe(true);
  });

  it('detects export default function declaration', () => {
    const source = 'export default function main() {}';
    const result = extractFunctions(source);
    expect(result).toHaveLength(1);
    expect(result[0].exported).toBe(true);
  });

  it('detects export const arrow function', () => {
    const source = 'export const greet = (name) => name;';
    const result = extractFunctions(source);
    expect(result).toHaveLength(1);
    expect(result[0].exported).toBe(true);
  });

  it('marks non-exported function as not exported', () => {
    const source = 'function internal() {}';
    const result = extractFunctions(source);
    expect(result).toHaveLength(1);
    expect(result[0].exported).toBe(false);
  });

  it('handles mix of exported and non-exported functions', () => {
    const source = `
export function pub() {}
function priv() {}
export const arrow = () => {};
    `;
    const result = extractFunctions(source);
    expect(result).toHaveLength(3);
    const pub = result.find((f) => f.name === 'pub');
    const priv = result.find((f) => f.name === 'priv');
    const arrow = result.find((f) => f.name === 'arrow');
    expect(pub.exported).toBe(true);
    expect(priv.exported).toBe(false);
    expect(arrow.exported).toBe(true);
  });
});

describe('class method extraction', () => {
  it('extracts methods from a class', () => {
    const source = `
class Calculator {
  add(a, b) { return a + b; }
  subtract(a, b) { return a - b; }
}`;
    const result = extractFunctions(source);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      name: 'add',
      params: ['a', 'b'],
      className: 'Calculator',
      static: false,
      methodKind: 'method',
    });
    expect(result[1]).toMatchObject({
      name: 'subtract',
      params: ['a', 'b'],
      className: 'Calculator',
    });
  });

  it('extracts constructor with params', () => {
    const source = `
class User {
  constructor(name, age) {}
}`;
    const result = extractFunctions(source);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      name: 'constructor',
      params: ['name', 'age'],
      className: 'User',
      methodKind: 'constructor',
    });
  });

  it('detects static methods', () => {
    const source = `
class Utils {
  static create() {}
  instance() {}
}`;
    const result = extractFunctions(source);
    const staticMethod = result.find((f) => f.name === 'create');
    const instanceMethod = result.find((f) => f.name === 'instance');
    expect(staticMethod.static).toBe(true);
    expect(instanceMethod.static).toBe(false);
  });

  it('detects getter and setter', () => {
    const source = `
class Person {
  get name() { return this._name; }
  set name(value) { this._name = value; }
}`;
    const result = extractFunctions(source);
    const getter = result.find((f) => f.methodKind === 'get');
    const setter = result.find((f) => f.methodKind === 'set');
    expect(getter).toBeDefined();
    expect(getter.name).toBe('name');
    expect(setter).toBeDefined();
    expect(setter.params).toEqual(['value']);
  });

  it('detects async class method', () => {
    const source = `
class Api {
  async fetch() {}
}`;
    const result = extractFunctions(source);
    expect(result).toHaveLength(1);
    expect(result[0].async).toBe(true);
    expect(result[0].className).toBe('Api');
  });

  it('extracts class expression assigned to variable', () => {
    const source = 'const MyClass = class { run() {} };';
    const result = extractFunctions(source);
    expect(result).toHaveLength(1);
    expect(result[0].className).toBe('MyClass');
    expect(result[0].name).toBe('run');
  });

  it('detects exported class', () => {
    const source = `
export class Service {
  start() {}
}`;
    const result = extractFunctions(source);
    expect(result).toHaveLength(1);
    expect(result[0].exported).toBe(true);
    expect(result[0].className).toBe('Service');
  });
});

describe('parseFile with new fields', () => {
  it('includes async, generator, exported in function output', async () => {
    const tmpFile = path.join(os.tmpdir(), 'new-fields.js');
    fs.writeFileSync(tmpFile, 'export async function load() {}');
    try {
      const result = await parseFile(tmpFile);
      const fn = result.functions.find((f) => f.name === 'load');
      expect(fn.async).toBe(true);
      expect(fn.generator).toBe(false);
      expect(fn.exported).toBe(true);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  it('includes class fields in parseFile output', async () => {
    const tmpFile = path.join(os.tmpdir(), 'class-fields.js');
    fs.writeFileSync(tmpFile, 'class Foo { bar() {} }');
    try {
      const result = await parseFile(tmpFile);
      const fn = result.functions.find((f) => f.name === 'bar');
      expect(fn.className).toBe('Foo');
      expect(fn.static).toBe(false);
      expect(fn.methodKind).toBe('method');
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  it('does not include className for non-class functions', async () => {
    const tmpFile = path.join(os.tmpdir(), 'no-class.js');
    fs.writeFileSync(tmpFile, 'function standalone() {}');
    try {
      const result = await parseFile(tmpFile);
      const fn = result.functions.find((f) => f.name === 'standalone');
      expect(fn.className).toBeUndefined();
      expect(fn.static).toBeUndefined();
      expect(fn.methodKind).toBeUndefined();
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });
});

describe('matchJSDocToItems with class methods', () => {
  it('uses className in key to avoid collisions', () => {
    const items = [
      { type: 'function', name: 'run', line: 3, className: 'A' },
      { type: 'function', name: 'run', line: 8, className: 'B' },
    ];
    const jsdocs = [
      {
        loc: { start: { line: 1 }, end: { line: 2 } },
        parsed: { description: 'A.run' },
      },
      {
        loc: { start: { line: 6 }, end: { line: 7 } },
        parsed: { description: 'B.run' },
      },
    ];
    const { jsdocMap, itemKey } = matchJSDocToItems(jsdocs, items);
    expect(jsdocMap.get(itemKey(items[0])).parsed.description).toBe('A.run');
    expect(jsdocMap.get(itemKey(items[1])).parsed.description).toBe('B.run');
  });
});

describe('Express router routes', () => {
  it('extracts routes on router variable', () => {
    const source = `
const router = express.Router();
router.get("/users", (req, res) => {});
router.post("/users", (req, res) => {});
    `;
    const result = extractFunctions(source);
    const routes = result.filter((f) => f.type === 'route');
    expect(routes).toHaveLength(2);
    expect(routes[0]).toMatchObject({ method: 'GET', path: '/users' });
    expect(routes[1]).toMatchObject({ method: 'POST', path: '/users' });
  });

  it('extracts router routes with path params', () => {
    const source = `
const router = express.Router();
router.get("/users/:id", (req, res) => {});
    `;
    const result = extractFunctions(source);
    const routes = result.filter((f) => f.type === 'route');
    expect(routes).toHaveLength(1);
    expect(routes[0].params).toEqual(['id']);
  });

  it('handles multiple router instances', () => {
    const source = `
const userRouter = express.Router();
const postRouter = express.Router();
userRouter.get("/users", (req, res) => {});
postRouter.get("/posts", (req, res) => {});
    `;
    const result = extractFunctions(source);
    const routes = result.filter((f) => f.type === 'route');
    expect(routes).toHaveLength(2);
    const paths = routes.map((r) => r.path);
    expect(paths).toContain('/users');
    expect(paths).toContain('/posts');
  });

  it('handles mixed app and router routes', () => {
    const source = `
const router = express.Router();
app.get("/health", (req, res) => {});
router.get("/api/data", (req, res) => {});
    `;
    const result = extractFunctions(source);
    const routes = result.filter((f) => f.type === 'route');
    expect(routes).toHaveLength(2);
    const paths = routes.map((r) => r.path);
    expect(paths).toContain('/health');
    expect(paths).toContain('/api/data');
  });
});

describe('route detection false positives', () => {
  it('does not treat HTTP-client calls with absolute URLs as routes', () => {
    const source = `
http.get("http://example.com", cb);
https.get("https://api.example.com/users", cb);
    `;
    const result = extractFunctions(source);
    expect(result.filter((f) => f.type === 'route')).toHaveLength(0);
  });

  it('does not treat calls whose path is not server-relative as routes', () => {
    const source = `
client.fetch("users");
client.get("/users");
    `;
    const result = extractFunctions(source);
    const routes = result.filter((f) => f.type === 'route');
    expect(routes).toHaveLength(1);
    expect(routes[0].path).toBe('/users');
  });
});
