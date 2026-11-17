# Architecture Overview

api-docs-generator is a plain-JavaScript, pure-ESM Node.js package with no
build step. It reads JavaScript and TypeScript sources, extracts functions,
routes and their JSDoc, and turns the result into documentation files or a
coverage report.

## Entry Point

There are two ways in:

| Entry                    | File                     | Purpose                                                                   |
| ------------------------ | ------------------------ | ------------------------------------------------------------------------- |
| `api-docs-generator` CLI | `bin/api-docs-generator` | Imports `run()` from `src/cli.js` and calls it                            |
| Library (`main`/exports) | `src/index.js`           | Re-exports the `generator`, `parser` and `analyzer` modules as namespaces |

`run()` calls `program.parseAsync(process.argv)` (commander). Any error thrown
by a command action is caught there, printed as `Error: <message>`, and turns
into exit code `1` via `process.exitCode`. `src/cli.js` also parses argv itself
when it is executed directly (`node src/cli.js ...`); when it is loaded through
the bin file, that guard is false so parsing happens exactly once.

## Pipeline

Every command runs the same front half and differs at the end:

```text
CLI options ──► resolveConfig ──► parser.parseDirectory ──► apiData[]
                                                              │
              ┌───────────────────────────────────────────────┼──────────────────┐
              ▼                                               ▼                  ▼
   generate: generator.generate                 audit: analyzer.analyzeCoverage   scan: print
   └─► formatters[type 'doc'].generate(apiData, config)   └─► report               names only
       └─► <outputDir>/<filename> + GENERATION_REPORT.md      └─► json | formatters[type 'report']
```

1. **Config** — `resolveConfig(options)` (in `cli.js`) calls
   `generator.loadConfig()` and overlays CLI flags. See [Config Loading](#config-loading).
2. **Scan** — `parser.scanDirectory(dir, excludePattern)` walks the directory
   tree and returns the paths of `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`,
   `.mts` and `.cts` files, skipping `.d.ts`/`.d.mts`/`.d.cts` declaration
   files. Directories whose path _relative to the scan root_ matches the
   exclude pattern are not entered. Symlinked directories are not followed.
3. **Parse** — `parser.parseDirectory(dir, config)` runs `parseFile` on each
   path with at most 10 files in flight, keeps the original file order, drops
   skipped files (over 1 MB, unreadable) and adds `relativePath` to each result.
4. **Per file** — `parseFile(filePath, config)` parses the source once with
   `@typescript-eslint/typescript-estree` (comments and tokens included, JSX/TS
   mode chosen from the file extension), then:
   - `collectJSDoc(ast)` turns every `/** */` block into a parsed comment
     (via `comment-parser`) and records `nextLine`, the line of the first code
     token after it;
   - `collectItems(ast, routeServers)` walks the AST once and collects function
     and route items;
   - `matchJSDocToItems(jsdocs, items)` attaches each comment to the item it
     documents (see [JSDoc Matching](#jsdoc-matching)).
5. **Output** —
   - `generate` passes `apiData` to each requested `type: 'doc'` formatter from
     `formatters/registry.js`, writes each result to its fixed filename, then
     writes `GENERATION_REPORT.md`.
   - `audit` passes `apiData` to `analyzer.analyzeCoverage()` and renders the
     report as JSON, with the terminal formatter, or with the dashboard
     formatter.
   - `scan` prints file, function and route names and writes nothing.

## Data Flow

### File object (`parseFile` / `parseDirectory` output)

```js
{
  file: '/abs/path/src/users.js',  // absolute path, as scanned
  fileName: 'users.js',            // basename
  relativePath: 'src/users.js',    // set by parseDirectory only; '/'-separated
  functions: [ /* function items */ ],
  routes: [ /* route items */ ],
}
```

### Function item

```js
{
  name: 'getUser',                 // 'api.load' for object methods, 'default' for anonymous module.exports
  params: ['id', '{a, b}', '...rest'],
  line: 12,                        // 1-based start line of the declaration
  jsdoc: { description, tags, ... } | null, // comment-parser block, or null
  description: 'Get a user',       // jsdoc description, or 'No description provided'
  async: false,
  generator: false,
  exported: true,
  // only for class and prototype methods:
  className: 'UserService',
  static: false,
  methodKind: 'method',            // 'method' | 'constructor' | 'get' | 'set'
}
```

### Route item

```js
{
  method: 'GET',                   // upper case
  path: '/users/:id',              // string literal from the source
  params: ['id'],                  // names of :params in the path
  line: 30,
  jsdoc: { description, tags, ... } | null,
}
```

### Coverage report (`analyzeCoverage` output)

```js
{
  summary: {
    totalFunctions, documentedFunctions, undocumentedFunctions,
    partiallyDocumented,           // functions and routes combined
    totalRoutes, documentedRoutes,
    coveragePercentage,            // fully documented items / all items, 1 decimal
    functionCoverage, routeCoverage,
  },
  files: [
    { fileName, filePath, totalItems, documentedItems, coveragePercentage, gaps },
  ],
  gaps: [
    {
      type: 'function' | 'route', name, fileName, filePath, line,
      severity: 'error' | 'warning', // error: no JSDoc; warning: JSDoc but incomplete
      missing: ['description' | 'params' | 'returns'],
      existing: { description, params, returns, voidReturn? },
      functionSignature,             // 'getUser(id)' or 'GET /users/:id'
    },
  ],
}
```

`filePath` is the scan-relative path when available. Files with no functions
or routes do not appear in `files`.

### Flow Pattern

Data only moves forward: the parser never reads the config file, formatters
never touch the file system, and the only writers are `generator.generate`
(doc files and `GENERATION_REPORT.md`) and the `audit` action in `cli.js`
(JSON and dashboard files). Formatters are pure functions of their input plus
`new Date()` for timestamps.

## JSDoc Matching

`matchJSDocToItems` decides which comment documents which item:

- Each item can be documented from its own line, plus extra `docLines`: the
  line of its `export` keyword, or the first line of a route chain
  (`app.route('/x')`).
- A comment documents the nearest item whose doc line is 0–2 lines after the
  comment ends. When the comment has a `nextLine`, only items documented from
  exactly that line qualify, so a comment never skips past other code.
- Routes declared by the same call (a chain, or a Fastify `route()` with a
  method array) share the comment when they match at the same line.
- If several comments reach the same item, the closest wins; on a tie, the
  later one.

The regex fallback (`scanJSDocText`) is only used by the exported
`parseJSDoc()` when source fails to parse; `parseFile` returns no items for
unparseable files.

## Config Loading

`generator.loadConfig(configPath?)`:

1. If `configPath` is given, use it; a missing file warns and returns defaults.
2. Otherwise look in `process.cwd()` for, in order, `apidocs.config.js`,
   `apidocs.config.mjs`, `apidocs.config.cjs`. None found → defaults, silently.
3. `import()` the file (it is executed), take `default` or the module
   namespace, and shallow-merge it over `getDefaultConfig()`.
4. If the import throws, warn (with a hint when a `.js` file is in the wrong
   module format for its package) and return defaults.

`cli.js:resolveConfig(options)` then overrides: `--server-url` → `serverUrl`,
`--api-title` → `apiTitle`, `--api-version` → `apiVersion`, `--exclude` →
`excludePattern`. `routeServers` has no flag.

## File Map

| File                              | Responsibility                                                                                            |
| --------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `bin/api-docs-generator`          | Executable shim; imports and calls `run()`                                                                |
| `src/cli.js`                      | commander program, `generate`/`audit`/`scan` actions, `resolveConfig`, `run`                              |
| `src/index.js`                    | Library entry; re-exports `analyzer`, `generator`, `parser`                                               |
| `src/generator.js`                | Default config, config discovery/loading, `generate()` orchestration, `GENERATION_REPORT.md`              |
| `src/parser.js`                   | Directory scan, single-pass AST parse, item collection, export tracking, JSDoc matching, `parseDirectory` |
| `src/analyzer.js`                 | Coverage rules (`checkDocumentation`) and `analyzeCoverage` report                                        |
| `src/utils.js`                    | Default exclude pattern, HTML escaping, slugs/ids, param names, tag helpers, file labels, percentages     |
| `src/formatters/registry.js`      | Format name → `{ generate, filename, type }` map, including aliases                                       |
| `src/formatters/markdown.js`      | `API.md`; TOC anchors follow GitHub's heading slugs                                                       |
| `src/formatters/html.js`          | Self-contained `index.html`; all source text escaped                                                      |
| `src/formatters/json.js`          | `api.json` with a `meta` block and scan-relative file paths                                               |
| `src/formatters/openapi.js`       | `openapi.yaml` (OpenAPI 3.0.3) from routes only                                                           |
| `src/formatters/terminal.js`      | Coverage report printed to stdout; colour only on a TTY without `NO_COLOR`                                |
| `src/formatters/dashboard.js`     | Self-contained `coverage-dashboard.html` coverage report                                                  |
| `src/formatters/shared-styles.js` | `BASE_CSS` shared by the HTML formatters                                                                  |
