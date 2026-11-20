import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  extractFunctions,
  parseDirectory,
  parseFile,
  parseJSDoc,
  scanDirectory,
} from '../src/parser.js';

let tmpDir;

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parser-regressions-'));
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeFile(relativePath, content) {
  const fullPath = path.join(tmpDir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
  return fullPath;
}

describe('scanDirectory exclusion is relative to the scan root', () => {
  it('scans nested directories when an ancestor matches the exclude pattern', async () => {
    const root = path.join(tmpDir, 'build', 'project');
    writeFile('build/project/top.js', 'function top() {}');
    writeFile('build/project/src/lib/nested.js', 'function nested() {}');

    const files = await scanDirectory(root);
    expect(files.map((f) => path.basename(f)).sort()).toEqual([
      'nested.js',
      'top.js',
    ]);
  });

  it('still excludes matching directories inside the scan root', async () => {
    writeFile('src/app.js', 'function app() {}');
    writeFile('dist/bundle.js', 'function bundle() {}');

    const files = await scanDirectory(tmpDir);
    expect(files.map((f) => path.basename(f))).toEqual(['app.js']);
  });
});

describe('scanDirectory file exclusion', () => {
  it('skips files whose name matches the exclude pattern', async () => {
    writeFile('src/app.js', 'function app() {}');
    writeFile('src/vendor.bundle.js', 'function big() {}');
    writeFile('src/vendor.bundle-extra.js', 'function keep() {}');

    const files = await scanDirectory(tmpDir, 'vendor\\.bundle\\.js');
    expect(files.map((f) => path.basename(f)).sort()).toEqual([
      'app.js',
      'vendor.bundle-extra.js',
    ]);
  });
});

describe('large file warning', () => {
  it('suggests an escaped pattern that skips the file', async () => {
    const file = writeFile(
      'vendor.bundle.js',
      `// ${'x'.repeat(1024 * 1024)}\n`,
    );
    const result = await parseFile(file);
    expect(result).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('add vendor\\.bundle\\.js to excludePattern'),
    );
  });
});

describe('scanDirectory file types', () => {
  it('includes module-specific extensions and skips declaration files', async () => {
    for (const name of [
      'a.mjs',
      'b.cjs',
      'c.mts',
      'd.cts',
      'e.d.ts',
      'f.d.mts',
    ]) {
      writeFile(name, 'export {};');
    }

    const files = await scanDirectory(tmpDir);
    expect(files.map((f) => path.basename(f)).sort()).toEqual([
      'a.mjs',
      'b.cjs',
      'c.mts',
      'd.cts',
    ]);
  });
});

describe('JSDoc matching', () => {
  it('does not credit one comment to the function after the documented one', async () => {
    const file = writeFile(
      'adjacent.js',
      `/**
 * Documented
 * @returns {number} one
 */
function first() { return 1; }
function second() {}
`,
    );
    const result = await parseFile(file);
    const byName = Object.fromEntries(result.functions.map((f) => [f.name, f]));
    expect(byName.first.jsdoc.description).toBe('Documented');
    expect(byName.second.jsdoc).toBeNull();
  });

  it('does not credit a class comment to its first method', async () => {
    const file = writeFile(
      'class-doc.js',
      `/** Service class */
class Service {
  run() {}
}
`,
    );
    const result = await parseFile(file);
    expect(result.functions[0].jsdoc).toBeNull();
  });

  it('matches a comment above an export keyword on its own line', async () => {
    const file = writeFile(
      'split-export.js',
      `/** Split export */
export
async function f() {}
`,
    );
    const result = await parseFile(file);
    expect(result.functions[0].jsdoc.description).toBe('Split export');
  });

  it('prefers the closest of two stacked comments', async () => {
    const file = writeFile(
      'stacked.js',
      `/** License header */
/** Real doc */
function documented() {}
`,
    );
    const result = await parseFile(file);
    expect(result.functions[0].jsdoc.description).toBe('Real doc');
  });
});

describe('tags without a name', () => {
  it('keeps the whole description of @returns, @throws and @yields', () => {
    const [jsdoc] = parseJSDoc(`/**
 * Sum
 * @returns {number} The total sum
 * @throws {RangeError} When the input is empty
 * @yields {number} Each partial sum
 */
function f() {}`);
    const tags = Object.fromEntries(
      jsdoc.parsed.tags.map((t) => [t.tag, t.description]),
    );
    expect(tags).toEqual({
      returns: 'The total sum',
      throws: 'When the input is empty',
      yields: 'Each partial sum',
    });
  });

  it('keeps brackets and defaults the parser read as an optional name', () => {
    const [jsdoc] = parseJSDoc(`/**
 * @returns {string} [deprecated] the id
 * @throws {Error} [when=closed] Closed connection
 */`);
    expect(
      jsdoc.parsed.tags.map(({ description, optional, default: d }) => ({
        description,
        optional,
        d,
      })),
    ).toEqual([
      { description: '[deprecated] the id', optional: false, d: undefined },
      {
        description: '[when=closed] Closed connection',
        optional: false,
        d: undefined,
      },
    ]);
  });

  it('leaves @param names alone', () => {
    const [jsdoc] = parseJSDoc('/**\n * @param {number} a - First\n */');
    expect(jsdoc.parsed.tags[0]).toMatchObject({
      name: 'a',
      description: '- First',
    });
  });
});

describe('TypeScript parsing by file extension', () => {
  it('parses angle-bracket type assertions in .ts files', async () => {
    const file = writeFile(
      'cast.ts',
      'const y = <number>x;\nexport function f(): number { return 1; }\n',
    );
    const result = await parseFile(file);
    expect(result.functions.map((f) => f.name)).toEqual(['f']);
  });
});

describe('additional function forms', () => {
  it('extracts methods of object literals bound to a variable', () => {
    const result = extractFunctions(`
const api = {
  list() {},
  get: function (id) {},
  remove: (id) => {},
};
`);
    expect(result.map((f) => f.name)).toEqual([
      'api.list',
      'api.get',
      'api.remove',
    ]);
  });

  it('extracts CommonJS exports', () => {
    const result = extractFunctions(`
module.exports = function main(a) {};
exports.helper = (x) => x;
module.exports.other = function () {};
`);
    expect(result.map((f) => ({ name: f.name, exported: f.exported }))).toEqual(
      [
        { name: 'main', exported: true },
        { name: 'helper', exported: true },
        { name: 'other', exported: true },
      ],
    );
  });

  it('extracts methods of an exported object', () => {
    const result = extractFunctions(`
module.exports = { start() {}, stop: () => {} };
`);
    expect(result.map((f) => f.name)).toEqual(['start', 'stop']);
    expect(result.every((f) => f.exported)).toBe(true);
  });

  it('extracts prototype methods as class methods', () => {
    const result = extractFunctions('Foo.prototype.bar = function (x) {};');
    expect(result[0]).toMatchObject({
      name: 'bar',
      className: 'Foo',
      params: ['x'],
    });
  });

  it('marks functions exported through export specifiers and module.exports', () => {
    const result = extractFunctions(`
function a() {}
function b() {}
function c() {}
export { a };
module.exports = { b };
`);
    const exported = Object.fromEntries(
      result.map((f) => [f.name, f.exported]),
    );
    expect(exported).toEqual({ a: true, b: true, c: false });
  });
});

describe('module-level scope', () => {
  it('reports only the module-level function when a nested one shares its name', () => {
    const result = extractFunctions(`
function outer() {
  function handler(a) {}
}
function handler() {}
module.exports = { handler };
`);
    const handlers = result.filter((f) => f.name === 'handler');
    expect(handlers.map((f) => [f.params, f.exported])).toEqual([[[], true]]);
  });

  it('ignores functions, arrow functions and classes nested in function bodies', () => {
    const result = extractFunctions(`
export function outer() {
  function helper() {}
  const format = (x) => x;
  class Local { run() {} }
}
`);
    expect(result.map((f) => f.name)).toEqual(['outer']);
  });

  it('detects functions inside immediately-invoked functions', () => {
    const result = extractFunctions(`
(function () {
  function add(a, b) {}
  const sub = (a, b) => a - b;
})();
(() => { function arrowWrapped() {} })();
!function () { function bang() {} }();
(function () { function called() {} }).call(this);
`);
    expect(result.map((f) => f.name)).toEqual([
      'add',
      'sub',
      'arrowWrapped',
      'bang',
      'called',
    ]);
  });

  it('detects the factory API of a UMD wrapper', () => {
    const result = extractFunctions(`
(function (root, factory) {
  if (typeof module === 'object') module.exports = factory();
  else root.lib = factory();
})(this, function () {
  function parse(text) {}
  class Parser { run() {} }
  return { parse, Parser };
});
`);
    expect(result.map((f) => f.name)).toEqual(['parse', 'run']);
  });

  it('detects declarations in top-level if, try and bare blocks', () => {
    const result = extractFunctions(`
if (typeof window !== 'undefined') { function inIf() {} } else { function inElse() {} }
try { function inTry() {} } catch (e) { function inCatch() {} } finally { function inFinally() {} }
{ function inBlock() {} }
`);
    expect(result.map((f) => f.name).sort()).toEqual([
      'inBlock',
      'inCatch',
      'inElse',
      'inFinally',
      'inIf',
      'inTry',
    ]);
  });

  it('still ignores functions inside a named function that is called later', () => {
    const result = extractFunctions(`
function setup() { function helper() {} }
setup();
`);
    expect(result.map((f) => f.name)).toEqual(['setup']);
  });

  it('detects auto-accessor class fields holding a function', () => {
    const result = extractFunctions(`
export class Widget {
  accessor onChange = (value) => {};
  accessor count = 0;
}
`);
    expect(result.map((f) => [f.name, f.params, f.className])).toEqual([
      ['onChange', ['value'], 'Widget'],
    ]);
  });

  it('detects arrow functions and function expressions assigned as class fields', () => {
    const result = extractFunctions(`
export class Handlers {
  onClick = (event) => {};
  static create = function (opts) {};
  label = 'x';
  run() {}
}
`);
    expect(
      result.map((f) => ({
        name: f.name,
        params: f.params,
        className: f.className,
        static: f.static,
        exported: f.exported,
      })),
    ).toEqual([
      {
        name: 'onClick',
        params: ['event'],
        className: 'Handlers',
        static: false,
        exported: true,
      },
      {
        name: 'create',
        params: ['opts'],
        className: 'Handlers',
        static: true,
        exported: true,
      },
      {
        name: 'run',
        params: [],
        className: 'Handlers',
        static: false,
        exported: true,
      },
    ]);
  });

  it('ignores object literals declared inside function bodies', () => {
    const result = extractFunctions(`
function outer() {
  const opts = { onError: () => {}, onDone() {} };
}
`);
    expect(result.map((f) => f.name)).toEqual(['outer']);
  });

  it('ignores assignments to exports and prototypes inside function bodies', () => {
    const result = extractFunctions(`
function setup() {
  exports.handler = () => {};
  module.exports = { a() {} };
  Foo.prototype.bar = function () {};
}
`);
    expect(result.map((f) => f.name)).toEqual(['setup']);
  });

  it('skips getters and setters in object literals', () => {
    const result = extractFunctions(`
const api = {
  get value() { return 1; },
  set value(v) {},
  load() {},
};
`);
    expect(result.map((f) => f.name)).toEqual(['api.load']);
  });

  it('treats exports inside TypeScript namespaces as exported', () => {
    const result = extractFunctions(`
export namespace Api {
  export function ping(): void {}
  function hidden(): void {}
}
`);
    const exported = Object.fromEntries(
      result.map((f) => [f.name, f.exported]),
    );
    expect(exported).toEqual({ ping: true, hidden: false });
  });
});

describe('additional route forms', () => {
  it('extracts chained app.route() definitions', () => {
    const result = extractFunctions(`
app.route('/books/:id')
  .get(h)
  .put(h);
`);
    const routes = result.filter((f) => f.type === 'route');
    expect(routes.map((r) => `${r.method} ${r.path}`).sort()).toEqual([
      'GET /books/:id',
      'PUT /books/:id',
    ]);
    expect(routes.every((r) => r.params[0] === 'id')).toBe(true);
  });

  it('attaches a JSDoc to the chained method it precedes', async () => {
    const file = writeFile(
      'chain.js',
      `app.route('/books')
  /** List books */
  .get(h)
  .post(h);
`,
    );
    const result = await parseFile(file);
    const get = result.routes.find((r) => r.method === 'GET');
    const post = result.routes.find((r) => r.method === 'POST');
    expect(get.jsdoc.description).toBe('List books');
    expect(post.jsdoc).toBeNull();
  });

  it('shares a JSDoc across routes chained on the same line', async () => {
    const file = writeFile(
      'one-line-chain.js',
      `/** Users collection */
app.route('/users').get(list).post(create);
`,
    );
    const result = await parseFile(file);
    expect(result.routes).toHaveLength(2);
    for (const route of result.routes) {
      expect(route.jsdoc.description).toBe('Users collection');
    }
  });

  it('shares a JSDoc across the methods of one Fastify route object', async () => {
    const file = writeFile(
      'fastify-methods.js',
      `/** Items */
fastify.route({ method: ['GET', 'POST'], url: '/items', handler });
`,
    );
    const result = await parseFile(file);
    expect(result.routes.map((r) => r.jsdoc?.description)).toEqual([
      'Items',
      'Items',
    ]);
  });

  it('does not share a JSDoc with routes from a different call on the same line', async () => {
    const file = writeFile(
      'two-calls.js',
      `/** Only a */
app.get('/a', h); app.get('/b', h);
`,
    );
    const result = await parseFile(file);
    const byPath = Object.fromEntries(result.routes.map((r) => [r.path, r]));
    expect(byPath['/a'].jsdoc.description).toBe('Only a');
    expect(byPath['/b'].jsdoc).toBeNull();
  });

  it('documents every route of a multi-line chain from a comment above it', async () => {
    const file = writeFile(
      'multi-line-chain.js',
      `/** Book routes */
app.route('/books/:id')
  .get(getBook)
  .put(updateBook);
`,
    );
    const result = await parseFile(file);
    expect(result.routes.map((r) => r.jsdoc?.description)).toEqual([
      'Book routes',
      'Book routes',
    ]);
  });

  it('prefers a method comment over the chain comment for that method', async () => {
    const file = writeFile(
      'chain-with-method-doc.js',
      `/** Book routes */
app.route('/books')
  /** List books */
  .get(list)
  .post(create);
`,
    );
    const result = await parseFile(file);
    const byMethod = Object.fromEntries(
      result.routes.map((r) => [r.method, r.jsdoc?.description]),
    );
    expect(byMethod).toEqual({ GET: 'List books', POST: 'Book routes' });
  });

  it('extracts Fastify route objects with one or many methods', () => {
    const result = extractFunctions(`
fastify.route({ method: 'GET', url: '/a', handler });
fastify.route({ method: ['POST', 'PUT'], url: '/b', handler });
`);
    const routes = result.filter((f) => f.type === 'route');
    expect(routes.map((r) => `${r.method} ${r.path}`)).toEqual([
      'GET /a',
      'POST /b',
      'PUT /b',
    ]);
  });

  it('applies routeServers to chained and object-style routes', () => {
    const result = extractFunctions(
      `
other.route('/x').get(h);
other.route({ method: 'GET', url: '/y', handler });
app.route('/z').get(h);
`,
      ['app'],
    );
    expect(result.map((r) => r.path)).toEqual(['/z']);
  });

  describe('HEAD, OPTIONS, ALL and template literal paths', () => {
    const routePaths = (source) =>
      extractFunctions(source)
        .filter((f) => f.type === 'route')
        .map((r) => `${r.method} ${r.path}`);

    it('detects all, head and options routes', () => {
      const source = `
  app.all('/any', h);
  app.head('/ping', h);
  app.options('/cors', h);
  app.route('/chain').head(h).options(h);
  fastify.route({ method: ['HEAD', 'OPTIONS'], url: '/f', handler: h });
  `;
      expect(routePaths(source)).toEqual([
        'ALL /any',
        'HEAD /ping',
        'OPTIONS /cors',
        'OPTIONS /chain',
        'HEAD /chain',
        'HEAD /f',
        'OPTIONS /f',
      ]);
    });

    it('accepts template literals without expressions as paths', () => {
      const source = `
  app.get(\`/users\`, h);
  app.route(\`/items\`).post(h);
  fastify.route({ method: \`PUT\`, url: \`/f\`, handler: h });
  app.get(\`/users/\${id}\`, h);
  `;
      expect(routePaths(source)).toEqual([
        'GET /users',
        'POST /items',
        'PUT /f',
      ]);
    });

    it('still ignores Promise.all and other non-path calls', () => {
      expect(routePaths('Promise.all([a, b]);')).toEqual([]);
    });
  });
});

describe('route server inference', () => {
  const routePaths = (source, routeServers) =>
    extractFunctions(source, routeServers)
      .filter((f) => f.type === 'route')
      .map((r) => `${r.method} ${r.path}`);

  it('ignores Map lookups in a file that creates an Express app', () => {
    const source = `
import express from 'express';
const app = express();
const cache = new Map();
cache.get('/key');
app.get('/users', h);
`;
    expect(routePaths(source)).toEqual(['GET /users']);
  });

  it('ignores values that cannot be servers in a file that creates none', () => {
    const source = `
const params = new URLSearchParams(query);
const lookup = { get: (k) => k };
const paths = ['/a'];
params.get('/q');
lookup.get('/x');
paths.all('/y');
api.get('/users', h);
`;
    expect(routePaths(source)).toEqual(['GET /users']);
  });

  it('keeps routes on parameters next to a created server', () => {
    const source = `
import express from 'express';
export function mount(router) {
  router.get('/a', h);
}
const app = express();
app.get('/b', h);
const register = (server = defaultServer) => server.post('/c', h);
`;
    expect(routePaths(source)).toEqual(['GET /a', 'GET /b', 'POST /c']);
  });

  it('keeps routes on imported routers and servers from unknown calls', () => {
    const source = `
import { router as users } from './users.js';
const app = require('express')();
const api = createApp();
const local = require('./app');
const hono = new Hono();
users.get('/u', h);
app.get('/a', h);
api.get('/b', h);
local.get('/c', h);
hono.get('/d', h);
`;
    expect(routePaths(source)).toEqual([
      'GET /u',
      'GET /a',
      'GET /b',
      'GET /c',
      'GET /d',
    ]);
  });

  it('keeps a name bound to both a server and a non-server value', () => {
    const source = `
let server = new Map();
server = fastify();
server.get('/a', h);
`;
    expect(routePaths(source)).toEqual(['GET /a']);
  });

  it('keeps routes on member expressions such as this.app', () => {
    const source = `
class Api {
  start() {
    this.app.get('/a', h);
  }
}
`;
    expect(routePaths(source)).toEqual(['GET /a']);
  });

  it('applies to chained and Fastify object routes', () => {
    const source = `
const cache = new Map();
cache.route('/x').get(h);
cache.route({ method: 'GET', url: '/y', handler: h });
router.route('/items').get(h).post(h);
`;
    expect(routePaths(source)).toEqual(['POST /items', 'GET /items']);
  });

  it('ignores calls through imported or required HTTP clients', () => {
    const source = `
import axios from 'axios';
const got = require('got');
const { default: ky } = require('ky');
axios.get('/users');
got.post('/orders');
ky.get('/items');
app.get('/real', h);
`;
    expect(routePaths(source)).toEqual(['GET /real']);
  });

  it('ignores clients created from a client library', () => {
    const source = `
import axios from 'axios';
const api = axios.create({ baseURL: '/api' });
const v2 = api.extend();
api.get('/users');
v2.delete('/users/1');
router.get('/real', h);
`;
    expect(routePaths(source)).toEqual(['GET /real']);
  });

  it('ignores supertest requests in tests', () => {
    const source = `
const request = require('supertest');
const app = require('../app');
const agent = request.agent(app);
it('lists users', async () => {
  await request(app).get('/users').expect(200);
  await agent.post('/login').send({});
});
`;
    expect(routePaths(source)).toEqual([]);
  });

  it('keeps an app that is also passed to supertest', () => {
    const source = `
import request from 'supertest';
import express from 'express';
const app = express();
app.get('/health', h);
request(app).get('/health');
`;
    expect(routePaths(source)).toEqual(['GET /health']);
  });

  it('matches whole names when routeServers is given as a string', () => {
    const source = `
a.get('/x', h);
r.get('/y', h);
app.get('/z', h);
`;
    expect(routePaths(source, 'app,router')).toEqual(['GET /z']);
  });

  it('lets explicit routeServers override inference', () => {
    const source = `
const app = express();
app.get('/a', h);
api.get('/b', h);
`;
    expect(routePaths(source, ['api'])).toEqual(['GET /b']);
  });
});

describe('parseDirectory relative paths', () => {
  it('records each file path relative to the scan root with / separators', async () => {
    writeFile('src/lib/util.js', 'function util() {}');
    const result = await parseDirectory(tmpDir);
    expect(result[0].relativePath).toBe('src/lib/util.js');
    expect(path.isAbsolute(result[0].file)).toBe(true);
  });
});

describe('prototype methods of exported constructors', () => {
  const protoExported = (source) =>
    extractFunctions(source)
      .filter((f) => f.className === 'Foo')
      .map((f) => [f.name, f.exported]);

  it('marks them exported when the constructor is in module.exports', () => {
    expect(
      protoExported(`
function Foo() {}
Foo.prototype.bar = function (x) {};
module.exports = { Foo };
`),
    ).toEqual([['bar', true]]);
  });

  it('marks them exported for an ESM-exported constructor', () => {
    expect(
      protoExported(`
export function Foo() {}
Foo.prototype.bar = function () {};
`),
    ).toEqual([['bar', true]]);
  });

  it('keeps them unexported for a private constructor', () => {
    expect(
      protoExported(`
function Foo() {}
Foo.prototype.bar = function () {};
`),
    ).toEqual([['bar', false]]);
  });
});

describe('TypeScript overloads', () => {
  const parseTs = async (source) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apidocs-overload-'));
    const file = path.join(dir, 'a.ts');
    fs.writeFileSync(file, source);
    try {
      return await parseFile(file);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  };

  it('reports one method per overloaded class method', async () => {
    const api = await parseTs(`
export class A {
  /** Format a value */
  format(a: string): string;
  format(a: number): string;
  format(a: any): string { return String(a); }
}
`);
    expect(api.functions.map((f) => [f.name, f.line])).toEqual([['format', 6]]);
    expect(api.functions[0].description).toBe('Format a value');
  });

  it('keeps static and instance overloads apart', async () => {
    const api = await parseTs(`
class A {
  static of(a: string): A;
  static of(a: any): A { return new A(); }
  of(a: string): void;
  of(a: any): void {}
}
`);
    expect(api.functions.map((f) => [f.name, f.static])).toEqual([
      ['of', true],
      ['of', false],
    ]);
  });

  it('keeps abstract methods and declare-only signatures', async () => {
    const api = await parseTs(`
abstract class Base {
  abstract run(): void;
}
declare class Lib {
  load(a: string): void;
  load(a: number): void;
}
`);
    expect(api.functions.map((f) => [f.className, f.name, f.line])).toEqual([
      ['Base', 'run', 3],
      ['Lib', 'load', 7],
    ]);
  });

  it('documents a function from a JSDoc above its first overload', async () => {
    const api = await parseTs(`
/** Parse input */
export function parse(a: string): number;
export function parse(a: number): number;
export function parse(a: any): number { return Number(a); }
`);
    expect(api.functions.map((f) => [f.name, f.line, f.description])).toEqual([
      ['parse', 5, 'Parse input'],
    ]);
  });
});
