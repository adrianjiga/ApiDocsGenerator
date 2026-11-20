# API & Interface Design

This document describes the data shapes passed between stages, the exported
JavaScript API, the formatter registry, the command-line interface and the
configuration file. [Architecture.md](Architecture.md) explains how the
pieces fit together.

## Core Data Shapes

### File object

Returned by `parser.parseFile()` and, as an array, by `parser.parseDirectory()`.

| Field          | Type             | Notes                                                                               |
| -------------- | ---------------- | ----------------------------------------------------------------------------------- |
| `file`         | `string`         | Path as scanned (absolute when the CLI resolves `--dir`)                            |
| `fileName`     | `string`         | Basename                                                                            |
| `relativePath` | `string`         | Path relative to the scanned directory, `/`-separated. Set by `parseDirectory` only |
| `functions`    | `FunctionItem[]` | In AST traversal order                                                              |
| `routes`       | `RouteItem[]`    | In AST traversal order                                                              |

### FunctionItem

| Field          | Type                 | Notes                                                                                                                                                                                    |
| -------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`         | `string`             | `'anonymous'` for unnamed declarations; `prefix.key` for methods of a named object literal; `'default'` for an unnamed `module.exports = function`                                       |
| `params`       | `string[]`           | Destructured params render as `{a, b}` / `[a, b]`; rest params as `...rest`; defaults use the left-hand name. A TypeScript `this` parameter is left out                                  |
| `paramDetails` | `ParamDetail[]`      | One per entry of `params`: `{ name, optional, type?, defaultValue? }`. `type` is the TypeScript annotation as written, whitespace collapsed; `optional` is true for `?` and for defaults |
| `returnType`   | `string?`            | Declared TypeScript return type; absent when there is none                                                                                                                               |
| `line`         | `number`             | 1-based start line                                                                                                                                                                       |
| `jsdoc`        | `JSDocBlock \| null` | The matched comment, or `null`                                                                                                                                                           |
| `description`  | `string`             | `jsdoc.description`, or `'No description provided'`                                                                                                                                      |
| `async`        | `boolean`            |                                                                                                                                                                                          |
| `generator`    | `boolean`            |                                                                                                                                                                                          |
| `exported`     | `boolean`            | ESM `export`, `export { x }`, `module.exports`/`exports.x`, and exports inside TS namespaces                                                                                             |
| `className`    | `string`             | Class and prototype methods only                                                                                                                                                         |
| `static`       | `boolean`            | Class and prototype methods only                                                                                                                                                         |
| `methodKind`   | `string`             | Class and prototype methods only: `'method'`, `'constructor'`, `'get'` or `'set'`                                                                                                        |

### RouteItem

| Field    | Type                 | Notes                                                                     |
| -------- | -------------------- | ------------------------------------------------------------------------- |
| `method` | `string`             | `GET`, `POST`, `PUT`, `DELETE` or `PATCH`                                 |
| `path`   | `string`             | String literal from the source, starts with `/`                           |
| `params` | `string[]`           | Names of `:param` segments in `path`                                      |
| `line`   | `number`             | 1-based line of the call (for chained routes, the line of `.get`/`.post`) |
| `jsdoc`  | `JSDocBlock \| null` |                                                                           |

### JSDocBlock

The first block returned by [`comment-parser`](https://github.com/syavorsky/comment-parser)
for the comment. The fields the formatters and analyzer read are:

| Field         | Type     | Notes                                                                        |
| ------------- | -------- | ---------------------------------------------------------------------------- |
| `description` | `string` | Text before the first tag                                                    |
| `tags`        | `Tag[]`  | Each `{ tag, name, type, description, optional, ... }`; `tag` is without `@` |

### Coverage report

Returned by `analyzer.analyzeCoverage(apiData)` and printed by
`audit --format json`.

`summary`:

| Field                   | Type     | Notes                                                                              |
| ----------------------- | -------- | ---------------------------------------------------------------------------------- |
| `totalFunctions`        | `number` |                                                                                    |
| `documentedFunctions`   | `number` | Fully documented                                                                   |
| `undocumentedFunctions` | `number` | Functions with no JSDoc                                                            |
| `partiallyDocumented`   | `number` | Functions **and** routes with JSDoc that is incomplete                             |
| `totalRoutes`           | `number` |                                                                                    |
| `documentedRoutes`      | `number` | Fully documented                                                                   |
| `coveragePercentage`    | `number` | Fully documented items / all items × 100, one decimal; `0` when there are no items |
| `functionCoverage`      | `number` | Same, functions only                                                               |
| `routeCoverage`         | `number` | Same, routes only                                                                  |

`files[]` (files with at least one item): `fileName`, `filePath`,
`totalItems`, `documentedItems`, `coveragePercentage`, `gaps`.

`gaps[]` (every item that is not fully documented):

| Field               | Type                    | Notes                                                      |
| ------------------- | ----------------------- | ---------------------------------------------------------- |
| `type`              | `'function' \| 'route'` |                                                            |
| `name`              | `string`                | Function name, or `'GET /users/:id'`                       |
| `fileName`          | `string`                |                                                            |
| `filePath`          | `string`                | Scan-relative when available                               |
| `line`              | `number`                |                                                            |
| `severity`          | `'error' \| 'warning'`  | `error`: no JSDoc; `warning`: JSDoc present but incomplete |
| `missing`           | `string[]`              | Any of `'description'`, `'params'`, `'returns'`            |
| `existing`          | `object`                | `{ description, params, returns, voidReturn? }`            |
| `functionSignature` | `string`                | `'getUser(id)'` or `'GET /users/:id'`                      |

**Coverage rules** (`checkDocumentation`):

- An item without JSDoc is undocumented.
- A function is fully documented when its JSDoc has a non-empty description,
  a `@param` whose name matches each entry of `params`, and a `@returns` or
  `@return` tag. `@returns {void}`, `{undefined}` and `{never}` count.
  With `acceptTypeScriptReturns`, a declared TypeScript return type counts as
  the `@returns`.
- A route is fully documented with a description and a `@param` for each path
  parameter; `@returns` is optional.

### Generation result

Returned by `generator.generate()`.

| Field            | Type                       | Notes                                                            |
| ---------------- | -------------------------- | ---------------------------------------------------------------- |
| `success`        | `boolean`                  | `true` only when at least one format was written and none failed |
| `filesProcessed` | `number`                   |                                                                  |
| `outputDir`      | `string`                   | Absolute                                                         |
| `generated`      | `{ format, file, path }[]` |                                                                  |
| `failed`         | `{ format, error }[]`      | A formatter threw                                                |
| `skipped`        | `{ format, reason }[]`     | `'Unknown format'` or `'Report format; use audit'`               |

When no files are found it returns `{ success: false, message: 'No files processed' }`;
on an unexpected error, `{ success: false, error }`.

## Module Exports

`import { generator, parser, analyzer } from '@adrianjiga/api-docs-generator'`.
Functions marked **stable** are the intended library API; the rest are exported
for tests and may change between minor versions.

### generator

| Export                                                                          | Stability | Description                                                                                                                                                                                           |
| ------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `generate(sourceDir, outputDir, formats?, config?) → Promise<GenerationResult>` | stable    | Parse `sourceDir` and write each `type: 'doc'` format to `outputDir`. `formats` defaults to `['markdown', 'html', 'json']`; names are trimmed and lower-cased. Without `config`, calls `loadConfig()` |
| `loadConfig(configPath?) → Promise<Config>`                                     | stable    | See [Configuration File](#configuration-file)                                                                                                                                                         |
| `getDefaultConfig() → Config`                                                   | stable    | A fresh copy of the defaults                                                                                                                                                                          |
| `defaultConfig`                                                                 | internal  | The shared defaults object; do not mutate                                                                                                                                                             |
| `buildSummaryReport(apiData, formats, results) → string`                        | internal  | Markdown for `GENERATION_REPORT.md`                                                                                                                                                                   |

### parser

| Export                                                       | Stability | Description                                                                                |
| ------------------------------------------------------------ | --------- | ------------------------------------------------------------------------------------------ |
| `parseDirectory(dir, config?) → Promise<FileObject[]>`       | stable    | Scan and parse a directory. Reads `config.excludePattern` and `config.routeServers`        |
| `parseFile(filePath, config?) → Promise<FileObject \| null>` | stable    | Parse one file; `null` when it is over 1 MB. No `relativePath`                             |
| `scanDirectory(dir, excludePattern?) → Promise<string[]>`    | stable    | File paths only. An invalid pattern warns and falls back to the default                    |
| `extractFunctions(sourceCode, routeServers?) → RawItem[]`    | internal  | Raw items before JSDoc matching (includes `type`, `nodeType` and matching hints)           |
| `parseJSDoc(sourceCode) → ParsedComment[]`                   | internal  | `{ raw, parsed, loc, nextLine }` per `/** */` block; regex fallback for unparseable source |
| `matchJSDocToItems(jsdocs, items) → { jsdocMap, itemKey }`   | internal  | The matching step used by `parseFile`                                                      |
| `compileExcludeRegex(pattern) → RegExp`                      | internal  | Anchors the pattern to whole path segments (`/` or `\`)                                    |

### analyzer

| Export                                      | Stability | Description                                                       |
| ------------------------------------------- | --------- | ----------------------------------------------------------------- |
| `analyzeCoverage(apiData) → CoverageReport` | stable    | Non-array input returns an empty, zeroed report                   |
| `checkRouteDocumentation(route) → Status`   | internal  | `{ isFullyDocumented, isPartiallyDocumented, missing, existing }` |

## Formatter Registry

`src/formatters/registry.js` maps format names to
`{ generate, filename, type }`. It is not part of the package exports.

| Name        | Alias of | Type     | Output file               | `generate` signature                |
| ----------- | -------- | -------- | ------------------------- | ----------------------------------- |
| `markdown`  |          | `doc`    | `API.md`                  | `(apiData, config) → string`        |
| `md`        | markdown | `doc`    | `API.md`                  | same                                |
| `html`      |          | `doc`    | `index.html`              | `(apiData, config) → string`        |
| `json`      |          | `doc`    | `api.json`                | `(apiData, config) → string`        |
| `openapi`   |          | `doc`    | `openapi.yaml`            | `(apiData, config) → string`        |
| `swagger`   | openapi  | `doc`    | `openapi.yaml`            | same                                |
| `terminal`  |          | `report` | none (stdout)             | `(report, threshold) → void`        |
| `dashboard` |          | `report` | `coverage-dashboard.html` | `(report, threshold = 80) → string` |

`generate` only accepts `doc` formats and skips the others with a warning.
`audit` handles `json` itself and accepts the two `report` formats. Both
report formats colour coverage with `coverageLevel` from `src/utils.js`: green
at or above the threshold (default `DEFAULT_COVERAGE_THRESHOLD`, 80), amber or
yellow within `COVERAGE_WARNING_BAND` (30) points below it, and red under
that.

## Command-Line Interface

`api-docs-generator [command] [options]`. With no arguments it prints help.
`-V, --version` prints the package version; `-h, --help` works on every
command.

### generate (alias `gen`)

Parse a directory and write documentation files.

| Flag                       | Default              | Description                                                           |
| -------------------------- | -------------------- | --------------------------------------------------------------------- |
| `-d, --dir <directory>`    | `.`                  | Source directory to scan                                              |
| `-o, --output <directory>` | `./docs`             | Output directory (created if missing)                                 |
| `-f, --formats <formats>`  | `markdown,html,json` | Comma-separated: `markdown`/`md`, `html`, `json`, `openapi`/`swagger` |
| `-c, --config <path>`      |                      | Config file to load instead of discovery                              |
| `--server-url <url>`       |                      | Overrides `serverUrl`                                                 |
| `--api-title <title>`      |                      | Overrides `apiTitle`                                                  |
| `--api-version <version>`  |                      | Overrides `apiVersion`                                                |
| `--exclude <pattern>`      |                      | Overrides `excludePattern`                                            |

Always writes `GENERATION_REPORT.md` to the output directory when files were
found.

### audit (alias `a`)

Report documentation coverage.

| Flag                       | Default    | Description                                                                                              |
| -------------------------- | ---------- | -------------------------------------------------------------------------------------------------------- |
| `-d, --dir <directory>`    | `.`        | Source directory to scan                                                                                 |
| `-t, --threshold <number>` | `80`       | Minimum coverage percentage, integer `0`–`100`                                                           |
| `-f, --format <format>`    | `terminal` | `terminal`, `json` or `dashboard` (case-insensitive)                                                     |
| `-o, --output <file>`      |            | File for `json` or `dashboard`; dashboard defaults to `coverage-dashboard.html` in the working directory |
| `-c, --config <path>`      |            | Config file to load instead of discovery                                                                 |
| `--exclude <pattern>`      |            | Overrides `excludePattern`                                                                               |

Progress and "written to" messages go to stderr; stdout carries only the
report itself. With `--format json` and no `--output`, that is the JSON
document alone, so it can be piped (for example into `jq`).

### scan [directory]

Print the files, functions and routes found, without writing anything.
`directory` defaults to `.`.

| Flag                  | Default | Description                              |
| --------------------- | ------- | ---------------------------------------- |
| `-c, --config <path>` |         | Config file to load instead of discovery |
| `--exclude <pattern>` |         | Overrides `excludePattern`               |

### Exit Codes

| Command    | `0`                                | `1`                                                                                                                                 |
| ---------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `generate` | Every requested format was written | No source files; no valid format requested; any format failed; unexpected error                                                     |
| `audit`    | Coverage ≥ `--threshold`           | Coverage below threshold; invalid `--threshold`; no source files; unknown `--format`; unexpected error (e.g. unwritable `--output`) |
| `scan`     | Files were found                   | No source files; unexpected error                                                                                                   |
| (none)     | Help printed                       | Unknown command or option (commander usage error)                                                                                   |

Unexpected errors print `Error: <message>` to stderr rather than a stack trace.

## Configuration File

### Discovery

1. `--config <path>` (or the `configPath` argument to `loadConfig`). A missing
   file prints a warning and uses the defaults.
2. Otherwise the first of `apidocs.config.js`, `apidocs.config.mjs`,
   `apidocs.config.cjs` in the **current working directory** (not the scanned
   directory). None is not an error.

The file is loaded with `import()`, so it is **executed**. Use `export default`
in ESM (`.mjs`, or `.js` in a `"type": "module"` package) and `module.exports`
in CommonJS (`.cjs`, or `.js` without `"type": "module"`). If loading fails,
the CLI warns, suggests the right file name when the module format is wrong,
and continues with the defaults.

### Keys

The file's values are shallow-merged over the defaults.

| Key                       | Type       | Default                                                                                   | Meaning                                                                                                                                                                     | CLI override      |
| ------------------------- | ---------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `excludePattern`          | `string`   | `node_modules\|dist\|build\|\.cache\|coverage\|\.turbo\|\.nx\|\.next\|\.nuxt\|out\|\.git` | Regex of directory and file names to skip, matched against whole segments of the path relative to the scan root                                                             | `--exclude`       |
| `serverUrl`               | `string`   | `http://localhost:3000`                                                                   | Base URL in curl examples (Markdown, HTML) and OpenAPI `servers`                                                                                                            | `--server-url`    |
| `apiTitle`                | `string`   | `API Documentation`                                                                       | Title of the Markdown, HTML and OpenAPI output                                                                                                                              | `--api-title`     |
| `apiVersion`              | `string`   | `1.0.0`                                                                                   | `info.version` in OpenAPI and `meta.apiVersion` in JSON                                                                                                                     | `--api-version`   |
| `routeServers`            | `string[]` | `[]`                                                                                      | When non-empty, only calls on these identifiers (e.g. `app`, `router`) count as routes. When empty, each file's own `express()`/`Router()`/`fastify()` assignments are used | `--route-servers` |
| `acceptTypeScriptReturns` | `boolean`  | `false`                                                                                   | In `audit`, count a declared TypeScript return type as a documented `@returns`                                                                                              | none              |

`audit` and `scan` accept `--exclude` and `--route-servers` but not the three
metadata flags, which only affect `generate` output.

## Extensibility Guide

### Adding an output format

1. Create `src/formatters/<name>.js` exporting `generate<Name>(apiData, config)`
   that returns a string. Escape any source text for the target format (see
   `escapeHtml` in `src/utils.js`), and use `file.relativePath ?? file.file`
   when writing paths.
2. Register it in `src/formatters/registry.js` with
   `{ generate, filename, type: 'doc' }`. A coverage report instead takes
   `(report, threshold?)` and `type: 'report'`; `audit` then accepts it.
3. Add `tests/formatters/<name>.test.js` using `mockApiData` and the
   `makeFunction`/`makeRoute` factories from `tests/fixtures.js`, and extend
   `tests/formatters/registry.test.js` and `tests/generator.test.js`.
4. List the format in the README, `docs/` and the `--formats` help text in
   `src/cli.js`.

### Adding a route form

1. In `src/parser.js`, route calls reach `handleRouteExpression(node, functions, routeServers)`
   from the `CallExpression` case of `collectItems`. Add the new shape there
   (or a helper next to `handleRouteObject` and `findRouteChainRoot`).
2. Emit routes only through `pushRoute(functions, method, path, line, group?, docLines?)`:
   pass a `group` when one call declares several routes, and `docLines` when a
   comment above the call should document them.
3. Respect `isAllowedServer(serverNode, routeServers)`; `routeServers` here is
   already the configured list or the file's inferred servers. New HTTP verbs go in
   `HTTP_METHODS`; check `METHOD_SUCCESS_CODE` in `src/formatters/openapi.js`.
4. Add cases to the `additional route forms` block of
   `tests/parser-regressions.test.js`, including one `parseFile` test for JSDoc
   attachment and one for `routeServers`.

### Adding a detected function form

1. Add a `case` to the switch in `collectItems` (`src/parser.js`), or extend
   `handleAssignment`, `handleObjectMethods` or `handleClassDeclaration`.
2. Emit items through `pushFunction(functions, fnNode, { name, line, exported, docLines?, className?, static?, methodKind? })`.
3. Decide scope: module-level-only forms should check
   `exports.moduleLevel.has(node)` (built by `collectExports`), and exported
   detection should go through `isExported(node, name)`.
4. Add tests to the `additional function forms` and `module-level scope`
   blocks of `tests/parser-regressions.test.js`, including a negative case
   inside a function body and a JSDoc-matching case through `parseFile`.
