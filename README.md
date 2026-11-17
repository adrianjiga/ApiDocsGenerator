# api-docs-generator

[![CI](https://github.com/adrianjiga/ApiDocsGenerator/actions/workflows/ci.yml/badge.svg)](https://github.com/adrianjiga/ApiDocsGenerator/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@adrianjiga/api-docs-generator)](https://www.npmjs.com/package/@adrianjiga/api-docs-generator)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

API docs and a documentation coverage check for JavaScript and TypeScript,
built from the JSDoc you already write.

```bash
npx @adrianjiga/api-docs-generator generate --dir ./src
```

## The problem

Documentation for a JavaScript API usually lives somewhere other than the code:

- a hand-written `API.md` or OpenAPI file that falls behind as soon as a route
  or parameter changes;
- JSDoc comments that exist in some files and not others, with no way to tell
  which functions are missing them;
- nothing in CI that notices when new code ships undocumented.

api-docs-generator reads your source, writes the docs from it, and tells you
what is still undocumented.

## What it does

1. **Scans your project** for JavaScript and TypeScript files, skipping
   `node_modules`, `dist`, `build` and other generated folders.
2. **Reads the code**: functions, class and object methods, CommonJS exports,
   Express and Fastify routes, and the JSDoc comment directly above each one.
3. **Writes the docs** as Markdown, HTML, JSON and OpenAPI 3.0.3.
4. **Audits coverage**: lists every item that is undocumented or partly
   documented, as a terminal report, JSON or an HTML dashboard.

## Coverage in CI

`audit` exits with code `1` when coverage is below the threshold, so it can
fail a build:

```bash
api-docs-generator audit --dir ./src --threshold 80
```

An item counts as documented when its JSDoc has a description and a `@param`
for each parameter. Functions also need `@returns` (`@returns {void}` is fine).
For routes, the parameters are the path parameters, and `@returns` is optional.

```js
/**
 * Get a user by id
 * @param {string} id - User id
 * @returns {Promise<User>} The user
 */
export async function getUser(id) {}

/**
 * Delete a user
 * @param {string} id - User id
 */
app.delete('/users/:id', removeUser);
```

## Commands

| Command                         | What it does                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| `api-docs-generator generate`   | Write docs to `./docs` (`--formats markdown,html,json,openapi`, `--output <dir>`)     |
| `api-docs-generator audit`      | Report coverage (`--format terminal\|json\|dashboard`); exits `1` below `--threshold` |
| `api-docs-generator scan [dir]` | List the functions and routes found, without writing anything                         |

Run `api-docs-generator <command> --help` for every flag.

### Settings that stick

Put the options you always pass in an `apidocs.config.js` next to where you run
the command:

```js
export default {
  serverUrl: 'https://api.example.com',
  apiTitle: 'My API',
  apiVersion: '2.0.0',
};
```

In a CommonJS project, name it `apidocs.config.mjs` (or use `module.exports`
in `apidocs.config.cjs`). Command-line flags override it. See the
[CLI and API reference](docs/API-Interface-Design.md) for every key.

## Install

Needs Node.js 22.12 or newer.

```bash
npx @adrianjiga/api-docs-generator                       # run without installing
npm install -g @adrianjiga/api-docs-generator            # or install it globally
npm install --save-dev @adrianjiga/api-docs-generator    # or per project
```

The command is `api-docs-generator` in every case.

## Supported

- **Files**: `.js`, `.mjs`, `.cjs`, `.jsx`, `.ts`, `.mts`, `.cts` and `.tsx`.
  TypeScript declaration files and files over 1 MB are skipped.
- **Functions**: declarations, arrow functions and function expressions, class
  and prototype methods, methods of module-level object literals, and CommonJS
  exports.
- **Routes**: Express `app.get('/path')` (also `post`, `put`, `delete` and
  `patch`), chained `app.route('/path').get()`, and Fastify
  `fastify.route({ method, url })`.
- **Output**: Markdown, HTML, JSON and OpenAPI 3.0.3 docs; terminal, JSON and
  HTML dashboard coverage reports.

## Learn more

- [Troubleshooting](docs/troubleshooting.md): files not found, JSDoc or routes
  not detected, config errors, CI exit codes.
- [CLI and API reference](docs/API-Interface-Design.md): every flag, exit
  codes, the config file, data shapes and the library API.
- [Generated output reference](docs/output-reference.md): what each output file
  contains.
- [Architecture](docs/Architecture.md), [technical design](docs/Technical-Design.md)
  and [design decisions](docs/decisions/).
- [Changelog](CHANGELOG.md) and [releases](https://github.com/adrianjiga/ApiDocsGenerator/releases).

## Contributing

Bugs and ideas go on the [issue tracker](https://github.com/adrianjiga/ApiDocsGenerator/issues).
For the development setup and how changes get merged, see
[CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
