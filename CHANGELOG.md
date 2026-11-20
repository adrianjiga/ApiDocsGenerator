# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-11-20

### Added

- TypeScript parameter types, optionality, default values and return types are read from the source. Markdown and HTML show them where JSDoc gives no type, and JSON output carries them as `paramDetails` and `returnType`
- `acceptTypeScriptReturns` config key: `audit` counts a declared TypeScript return type as a documented `@returns`
- OpenAPI output uses `@param` descriptions and types for path parameters, `@returns` for the success response description, and `@deprecated` for `deprecated: true`
- Calls on names a file binds only to values that cannot be a server (`new Map()`, `new URLSearchParams()`, literals, object literals, functions) are no longer reported as routes, so `cache.get('/key')` on a `Map` is ignored. Servers from calls, imports, parameters and other classes are still detected
- `--exported-only` flag and `exportedOnly` config key for `audit`: only exported functions (and all routes) count towards coverage
- `--route-servers app,router` flag for `generate`, `audit` and `scan`
- `head`, `options` and `all` routes; OpenAPI has no `all` operation, so an `all` route becomes `get`, `post`, `put`, `patch`, `delete`, `head` and `options` operations, which explicit routes for the same path replace. HEAD examples use `curl -I`
- Route paths written as template literals without expressions, e.g. ``app.get(`/users`)``
- Markdown and HTML show `@deprecated`, `@throws` and `@see`, and an item's own `@example` blocks in place of the generated usage example or `curl` request. Inline `{@link}` references to `http(s)` URLs become links
- Coverage summary reports `partiallyDocumentedFunctions`, `partiallyDocumentedRoutes` and `undocumentedRoutes`; `partiallyDocumented` stays as the total of both kinds
- HTML docs follow `prefers-color-scheme`, with a light theme alongside the dark one
- OpenAPI query parameters from `@param query.<name>` tags and a JSON request body from `@param body` and `@param body.<field>` tags

### Fixed

- `@example` text kept its line breaks and indentation only in `source`; `@deprecated` and `@see` lost their first word to the tag name, and `@see {@link …}` was read as a type. Their full text is now the tag's `description`
- An undocumented function or route with no parameters is no longer reported as missing `params`
- The file line in Markdown and HTML output shows the path relative to the scanned directory, not just the file name
- A destructured parameter is matched to its `@param` correctly when an earlier parameter has no tag; before, the audit could miss it and Markdown and HTML listed it twice
- `@exception` descriptions keep their first word, as `@throws` ones do
- Prototype methods of an exported constructor are marked exported, so `--exported-only` counts them
- `curl` examples single-quote the URL, so paths with `?` or `*` (such as `/users/:id?`) work when pasted into zsh
- `audit` with nothing in scope (for example `--exported-only` on code with no exports) prints `Nothing to audit` and exits `0` instead of failing at 0%
- OpenAPI request bodies are emitted only for `post`, `put` and `patch`, including operations expanded from an `all` route
- A `@param` tag with no name no longer renders as an empty code span in Markdown
- Default values and types keep the whitespace inside string and template literals, so `fill = '    '` is no longer shown as `' '`
- OpenAPI operationIds are always unique, even when a suffixed id such as `get-users-id-1` matches another route's base id
- Calls through HTTP clients (`axios.get('/users')`, `axios.create()` instances, supertest's `request(app).get('/users')`) are no longer reported as routes
- `routeServers: 'app,router'` written as a string in the config is split on commas; it used to switch route detection to substring matching
- TypeScript overloads are one item, not one per signature, and a JSDoc above the first overload documents the implementation
- `export default (req, res) => {}` and other default-exported function expressions are detected, as `default`
- OpenAPI tags no longer merge routes from files that share a name, such as `users/index.js` and `orders/index.js`
- The audit accepts `@param params.id` for a route's `:id`, as the OpenAPI output already did
- A TypeScript `this` parameter is no longer listed as a parameter that needs a `@param`
- Optional route parameters (`/users/:id?`, Express 5 `/users{/:id}`) produced invalid OpenAPI paths and operationIds; each now becomes one path without the parameter and one with it
- Regex-constrained route parameters (`/users/:id(\d+)`) are converted to `{id}` in OpenAPI paths
- An OpenAPI `delete` operation whose `@returns` documents a body answers `200` instead of `204 No content`

## [0.1.0] - 2026-11-17

Initial public release as `@adrianjiga/api-docs-generator`. Requires Node.js 22.12 or newer.

### Added

- CLI commands: `generate` (alias `gen`), `audit` (alias `a`) and `scan`
- Documentation output as Markdown (`API.md`), HTML (`index.html`), JSON (`api.json`) and OpenAPI 3.0.3 YAML (`openapi.yaml`, alias `swagger`), plus a `GENERATION_REPORT.md` summary
- Coverage audit with terminal, JSON and self-contained HTML dashboard reports
- `--threshold` for `audit`: exits with code `1` when coverage is below it, for use in CI
- `generate` exits with code `1` when nothing was generated or a format failed; `scan` exits with code `1` when no files are found
- `audit` writes progress and status messages to stderr and only the report to stdout, so `--format json` output can be piped
- The terminal report and the coverage dashboard are coloured against `--threshold`
- Parsing of `.js`, `.mjs`, `.cjs`, `.jsx`, `.ts`, `.mts`, `.cts` and `.tsx` files via `@typescript-eslint/typescript-estree`; TypeScript declaration files and files over 1 MB are skipped
- Detection of module-level function declarations, arrow and function expressions, class methods and function-valued class fields, prototype methods, object-literal methods and CommonJS exports; immediately-invoked wrappers (IIFE, UMD) and top-level blocks count as module level
- Route detection for Express (`app.get('/path')`, `app.route('/path').get()`) and Fastify (`fastify.route({ method, url })`), optionally restricted with `routeServers`
- JSDoc comments are attached to the item that directly follows them; each comment documents at most one item
- Destructured parameters are documented by the `@param` in their position, and rest parameters by their name without the dots
- Configuration via `apidocs.config.js`, `.mjs` or `.cjs`, with command-line overrides for `--server-url`, `--api-title`, `--api-version` and `--exclude`
- `excludePattern` matched against directory and file names relative to the scanned directory
- Generated output uses paths relative to the scanned directory, not absolute machine paths
- Programmatic API exporting the `generator`, `parser` and `analyzer` modules

[0.2.0]: https://github.com/adrianjiga/ApiDocsGenerator/releases/tag/v0.2.0
[0.1.0]: https://github.com/adrianjiga/ApiDocsGenerator/releases/tag/v0.1.0
