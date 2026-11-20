# Technical Design

How api-docs-generator turns a source tree into documentation and a coverage
report. The pipeline has three stages, each in its own module:

```
parser.js (parseDirectory)  →  analyzer.js (analyzeCoverage)  →  formatters/*
   └─ parser/: scan, ast, jsdoc, exports, routes, items
     scan, parse, detect,          coverage per item,              Markdown, HTML,
     match JSDoc                   per file and overall            JSON, OpenAPI,
                                                                   terminal, dashboard
```

`generate` runs the parser and the document formatters. `audit` runs the
parser, the analyzer and one report formatter. `scan` runs only the parser.

## Scanning

`scanDirectory(dir, excludePattern)` in `src/parser/scan.js` walks the tree with
`fs.readdir(..., { withFileTypes: true })`.

- **Files kept**: names matching `/\.(js|jsx|ts|tsx|mjs|cjs|mts|cts)$/`, minus
  TypeScript declaration files (`/\.d\.(ts|mts|cts)$/`).
- **Symlinks** are not followed. A symlinked directory or file reports neither
  `isDirectory()` nor `isFile()` on its `Dirent`, so it is skipped.
- **Order**: the files in a directory come first, then the files from its
  subdirectories in `readdir` order. Subdirectories are read in parallel.
- **Unreadable directories** log `Warning: Could not read directory ...` and
  contribute no files; the scan continues.

### Exclude pattern

`compileExcludeRegex(pattern)` wraps the pattern so it only matches whole path
segments, with either separator:

```
(^|[\\/])(<pattern>)([\\/]|$)
```

`dist` therefore excludes a `dist` directory but not `dist-tools`. The regex is
tested against each directory's and each source file's path **relative to the
scan root**, so a parent folder of the scan root named `build` or `out` has no
effect. A file is excluded when one of its path segments matches, so
`bundle\.js` skips every file named `bundle.js`.

The default pattern is:

```
node_modules|dist|build|\.cache|coverage|\.turbo|\.nx|\.next|\.nuxt|out|\.git
```

An invalid pattern logs a warning and falls back to the default.

### File size limit and concurrency

`parseFile` skips any file larger than 1 MB (`MAX_FILE_SIZE_BYTES`) with a
warning; these are usually minified bundles. `parseDirectory` parses at most 10
files at once (`MAX_CONCURRENCY`) and returns the results in scan order, not
completion order. A file that throws while being read logs
`Error parsing <file>: ...` and is dropped.

Every parsed file is returned, including files with no functions or routes, so
"files scanned" counts are file counts, not counts of files with API items.
Each result carries `relativePath`: its path relative to the scan root with `/`
separators.

## Parsing

Each file is parsed once with `@typescript-eslint/typescript-estree`
(`parseSource`), with `loc`, `range`, `comment` and `tokens` enabled and
`allowInvalidAST: true`.

The file path is passed as `filePath`, which lets TypeScript pick the language
variant from the extension: `.ts`, `.mts` and `.cts` parse without JSX, so
angle-bracket casts such as `<T>value` work, while `.js`, `.jsx` and `.tsx`
allow JSX. The `jsx: true` option only applies when no file path is given, as
in the string-based library functions `parseJSDoc` and `extractFunctions`.

If parsing throws (a syntax error), `parseFile` logs
`Warning: Failed to parse <file>: ...` and the file yields no items.

### JSDoc extraction

JSDoc blocks come from the parser's comment list, so comment-shaped text inside
strings or template literals is never mistaken for documentation. A comment
qualifies when it is a block comment whose text starts with `*` (that is, it
opens with `/**`). Each block is parsed with `comment-parser`. Line comments
(`//`) are ignored. `comment-parser` reads every tag as `{type} name
description`, so for tags that take no name (`@returns`, `@return`, `@throws`,
`@yields`) `normalizeNamelessTag` moves the word it took as a name back to the
start of the description.

For each block, `nextTokenLine` binary-searches the token list for the first
token after the comment and records its line as `nextLine`. This is what JSDoc
matching keys on.

The exported `parseJSDoc(sourceCode)` falls back to a regex scan when the source
fails to parse, so it still returns comments for fragments. `parseFile` does not
use this fallback: a file that fails to parse has no items to attach comments
to.

## Detection

`collectItems` walks the AST once (`traverse`), skipping `parent`, `loc`,
`range`, `tokens` and `comments`, and turns these nodes into items.

### Functions

| Source form                                         | Item name             | Notes                                                                                              |
| --------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------- |
| `function f() {}`                                   | `f`                   | Module level only                                                                                  |
| `export default function () {}`                     | `anonymous`           |                                                                                                    |
| `const f = () => {}` / `const f = function () {}`   | `f`                   | Module level only                                                                                  |
| `class A { m() {} }` / `const A = class { m() {} }` | `m`, class `A`        | Module-level classes; every method, including `constructor`, getters, setters and abstract methods |
| `class A { m = () => {} }`                          | `m`, class `A`        | Fields (including `accessor` fields) holding an arrow function or function expression              |
| `A.prototype.m = function () {}`                    | `m`, class `A`        | Module level only                                                                                  |
| `const api = { list() {}, get: () => {} }`          | `api.list`, `api.get` | Module level only; getters and setters skipped                                                     |
| `export default { list() {} }`                      | `list`                | Exported                                                                                           |
| `module.exports = function main() {}`               | `main` (or `default`) | Module level only; exported                                                                        |
| `exports.f = () => {}` / `module.exports.f = ...`   | `f`                   | Module level only; exported                                                                        |
| `module.exports = { a() {}, b: () => {} }`          | `a`, `b`              | Module level only; exported                                                                        |

Parameter names come from `getParamName`: rest parameters become `...name`,
default values are dropped, and destructured parameters become `{a, b}` or
`[a, b]`.

**Module level** means code that runs when the module loads, outside any named
function or method:

- the program body;
- the body of a TypeScript `namespace` / `declare module` block;
- the bodies of top-level `if`/`else`, `try`/`catch`/`finally`, bare blocks
  and labelled statements;
- the body of an immediately-invoked function (`(function () {})()`,
  `(() => {})()`, `!function () {}()`, `(function () {}).call(this)`) and of
  any function expression passed to it as an argument, which covers the UMD
  factory pattern.

`collectExports` builds this set (`moduleLevel`) in one pass over those
statement lists; `immediatelyInvokedBodies` finds the function bodies.

### The `exported` flag

An item is marked exported when either:

- its declaration is the `declaration` of an `export` / `export default`
  statement (`exports.declarations`), including inside TypeScript namespaces;
  or
- it is a module-level declaration whose name appears in `export { name }`,
  `export default name`, `module.exports = name`, `exports.x = name` or
  `module.exports = { name }` (`exports.names`).

Functions and classes nested inside function bodies are not detected at all,
so they can never be marked exported by sharing a name with an exported
binding. CommonJS export assignments and `export default { ... }`
methods are always exported.

### Routes

Calls are inspected only when the callee is a member expression
(`x.method(...)`).

| Source form                                              | Routes                      | Item line                  |
| -------------------------------------------------------- | --------------------------- | -------------------------- |
| `app.get('/users/:id', handler)`                         | `GET /users/:id`            | The call                   |
| `app.route('/books').get(h).post(h)`                     | `GET /books`, `POST /books` | Each `.get` / `.post` name |
| `fastify.route({ method: 'GET', url: '/a' })`            | `GET /a`                    | The call                   |
| `fastify.route({ method: ['GET', 'POST'], path: '/b' })` | `GET /b`, `POST /b`         | The call                   |

- Methods are `get`, `post`, `put`, `delete`, `patch`, `head`, `options` and
  `all` (case-insensitive in Fastify objects). OpenAPI has no `all`
  operation, so `all` routes are expanded into `get`, `post`, `put`, `patch`,
  `delete`, `head` and `options`; an explicit route for the same path and
  method replaces the expanded operation.
- The path must be a string literal, or a template literal without `${}`
  expressions, starting with `/`. Variables, interpolated templates and
  absolute URLs (`http.get('https://...')`) are ignored.
- Path parameters are taken from `:name` segments (`/:(\w+)/g`).
- The object the method is called on (for a chain, the object `.route()` is
  called on) must pass `routeServerFilter`:
  - When `routeServers` is set, it must be an identifier in that list.
  - Otherwise, any object counts except a name the file binds only to values
    that cannot be a server (`nonServerNames`): literals, object and array
    literals, functions and classes, and `new` of a JavaScript built-in
    (`Map`, `Set`, `URLSearchParams`, `Headers`…). So `const cache = new Map();
    cache.get('/key')` is not a route.
  - A name with any other binding in the file counts as a possible server:
    calls (`express()`, `createApp()`, `require('./app')`), `new` of any other
    class (`new Hono()`), function parameters and imports. Scopes are not
    tracked, so one such binding anywhere in the file is enough. Member
    expressions such as `this.app` count.
  - HTTP clients never count: names imported or required from `axios`,
    `got`, `ky`, `superagent`, `supertest`, `undici`, `node-fetch`, `needle`,
    `request`, `http` or `https`, names created from them (`axios.create()`,
    `request.agent(app)`), and call chains that start with one
    (`request(app).get('/users')`).

Routes from one call (a chain, or a Fastify object with several methods) share
a `group` id, the source offset of the call. This is internal and never written
to the output.

## JSDoc matching

`matchJSDocToItems(jsdocs, items)` decides which comment documents which item.

Every item has one or more **doc lines**: lines where the first token after a
comment may sit for that comment to document the item.

- Every item's own line.
- An exported declaration also has the line of its `export` keyword, so
  `export` on its own line above `async function f()` still matches.
- A chained route also has the line of the chain's first token, so a comment
  above `app.route('/x')` reaches every method of the chain.

Items are indexed by doc line in a `Map`. For each comment:

1. **Candidate line**: `nextLine` when the comment came from the parser,
   otherwise each of the 2 lines below it, nearest first.
2. **Window**: the candidate line must be 0 to 2 lines after the comment's last
   line.
3. **Target**: the first item on that line in traversal order. If it belongs
   to a route group, every item of that group on the line is targeted too, so
   `/** doc */ app.route('/x').get(a).post(b)` documents both routes. Routes
   from different calls on the same line do not share a comment.
4. **Conflicts**: if an item is already claimed, the new comment replaces the
   old one when its distance is equal or smaller. Comments are processed in
   source order, so on a tie the later (closer in the text) comment wins. A
   comment directly above `.get(...)` in a chain therefore overrides the
   chain-level comment for that method only.

Because matching keys on `nextLine`, a comment never documents code past an
intervening statement: a class comment does not document the class's first
method, and a licence header followed by a real JSDoc block resolves to the
real block.

## Coverage rules

`analyzeCoverage(apiData, options)` in `src/analyzer.js` checks every function
and route with `checkDocumentation(item, { requireReturns })`. With
`exportedOnly`, functions whose `exported` flag is false are skipped; routes
always count.

| Check       | Passes when                                                    | Functions | Routes                                                  |
| ----------- | -------------------------------------------------------------- | --------- | ------------------------------------------------------- |
| description | the JSDoc description is non-empty after trimming              | required  | required                                                |
| params      | every parameter name has a `@param` tag with exactly that name | required  | required (path parameters; `params.<name>` also counts) |
| returns     | there is a `@returns` or `@return` tag, of any type            | required  | optional                                                |

`@returns {void}`, `{undefined}` and `{never}` count as present and are recorded
as `existing.voidReturn`.

An item is **fully documented** when nothing is missing, **partially
documented** (gap severity `warning`) when it has a JSDoc block but something
is missing, and **undocumented** (severity `error`) when it has no JSDoc block.
An undocumented item lists every check as missing, including `params` when it
has no parameters.

Parameters are matched by name (`isParamDocumented`). A rest parameter
`...args` matches `@param args`. A destructured parameter (`{a, b}` or
`[a, b]`) has no name of its own, so it matches the top-level `@param` in its
position, such as `@param {Object} options`, as long as that tag is not named
after one of the function's other parameters (`destructuredParamTags`).
Positions count tags, not parameters: in `f(id, name, {a})` documented only by
`@param name` and `@param options`, `{a}` matches `options` even though `id`
has no tag. Tags for its properties (`options.a`) are allowed but not
required.

Percentages use `calcPercentage`: `part / total * 100` rounded to one decimal,
and `0` when the total is `0`.

- `coveragePercentage` = fully documented items / all items.
- `functionCoverage` and `routeCoverage` are the same ratio per kind.
- Each file in `files` has its own `coveragePercentage`. Files with no items are
  left out of `files`.

`audit` exits `1` when `coveragePercentage < threshold`. The threshold is parsed
with `parseInt`, so `--threshold 80.5` means `80`.

## Output generation

Formatters are registered in `src/formatters/registry.js` as `type: 'doc'`
(written by `generate` to a fixed file name) or `type: 'report'` (used by
`audit`). `md` and `swagger` are aliases for `markdown` and `openapi`.

### File labels

`uniqueFileLabels` gives each file a heading label. Normally that is the file
name; when two scanned files share a name, both are labelled with their path
relative to the common directory of the colliding files (`a/util.js`,
`b/util.js`).

### Markdown

The body is built first while every heading is recorded in order. The table of
contents is then computed from the full heading list with GitHub's algorithm
(`githubSlug` plus `githubAnchors`): lowercase, strip everything but word
characters, spaces and `-`, turn spaces into `-`, and append `-1`, `-2`, ... to
repeated slugs across all headings, including the title, `Table of Contents`,
`### Functions` and every function heading. TOC links therefore resolve on
GitHub even when a file label repeats another heading.

Markdown text from JSDoc is written as-is, not escaped.

### HTML

Every value that comes from source code (names, parameters, types, descriptions,
paths, labels, the title and `serverUrl`) goes through `escapeHtml`, which
escapes `& < > " '`. Numbers and internal enums (line numbers, percentages,
severity and item type) are written directly.

Section ids come from `sanitizeHtmlId` (non-word runs become `-`, lowercased,
leading and trailing `-` trimmed). `sectionIds` falls back to `file` for an
empty id and appends `-2`, `-3`, ... to repeats. The page uses inline CSS only
and loads nothing external.

### OpenAPI

`generateOpenAPI` writes an OpenAPI 3.0.3 document with `js-yaml`.

- Express `:param` segments become `{param}`.
- `summary` is the route's JSDoc description, or `METHOD /path` without one.
- The success response is `201 Resource created` for `post`, `204 No content`
  for `delete`, and `200 Successful response` otherwise.
- Each path parameter is listed as `in: path`, `required: true`, type `string`.
  `@param` descriptions are not copied.
- `operationId` is `<method>-<path segments joined by ->`, with braces removed;
  a collision gets a numeric suffix (`get-a-b-1`).
- If the same path and method appear twice, the first one wins and later ones
  are skipped.
- One tag per source file name.
- Functions are not included; only routes.

### JSON

`api.json` mirrors the parser output: a `meta` block and one entry per file
with its functions and routes. The `jsdoc.tags` arrays are `comment-parser`'s
tag objects, including their `source` and `problems` fields, with nameless
tags normalized as described under Parsing.

### Paths in output

JSON, the audit report and `GENERATION_REPORT.md` use paths relative to the scan
root (or, for the report's output location, relative to the working directory).
Absolute machine paths are never written to generated files. They do appear in
console messages.

## Error handling strategy

The general rule: problems with one input are warnings and the run continues;
problems that make the requested output wrong or empty end with exit code `1`.

| Situation                                       | Behaviour                                                             |
| ----------------------------------------------- | --------------------------------------------------------------------- |
| Directory can't be read                         | Warning, directory skipped                                            |
| File over 1 MB                                  | Warning, file skipped                                                 |
| File fails to parse                             | Warning, file kept with no items                                      |
| A JSDoc block fails to parse                    | Warning, block ignored                                                |
| Invalid exclude pattern                         | Warning, default pattern used                                         |
| Config file missing (explicit `--config`)       | Warning, defaults used                                                |
| Config file throws or has a syntax error        | Warning with a hint, defaults used                                    |
| No JS/TS files found                            | `generate` and `audit` exit `1`; `scan` prints a notice and exits `0` |
| Unknown `generate` format, or a report format   | Warning, format skipped                                               |
| A formatter throws                              | Warning, other formats still written; exit `1`                        |
| Nothing generated                               | Exit `1`                                                              |
| Unknown `audit` format or invalid `--threshold` | Error, exit `1`                                                       |
| Coverage below threshold                        | Exit `1` after the report is printed or written                       |
| Any other error in a command (e.g. `EACCES`)    | `Error: <message>`, exit `1`                                          |

### Config loading

`loadConfig` imports the config with a dynamic `import()` of its file URL and
merges it over the defaults. Without `--config`, it looks for
`apidocs.config.js`, `.mjs` and `.cjs` in the working directory, in that order,
and stays silent if none exists. On failure it warns with the error message
and, for a `.js` file, a hint:

- a `SyntaxError` (ESM syntax in a CommonJS package) suggests renaming to
  `apidocs.config.mjs` or using `module.exports`;
- a `ReferenceError` for `module`, `exports` or `require` (CommonJS syntax in an
  ES module package) suggests `export default` or renaming to
  `apidocs.config.cjs`.

A config that throws a non-Error value is reported the same way.

### Command errors

`run()` in `src/cli.js` calls `program.parseAsync` and catches anything an async
command throws, printing `Error: <message>` and setting `process.exitCode = 1`
instead of crashing with a stack trace. Commander's own errors (unknown command,
unknown option) print Commander's message and exit `1`.

### Terminal output

Names, file names and route paths read from source are passed through
`stripControlChars` before they are printed by `scan` and the terminal report.
It removes C0 control characters (except tab and newline) and C1 control
characters, so a route path containing an ANSI escape sequence cannot change
the terminal's state.

The terminal report disables colour and switches to ASCII symbols when stdout
is not a TTY or `NO_COLOR` is set.
