# Troubleshooting

Each section starts from what you see, explains the cause, and gives the fix.
Run `api-docs-generator scan <dir>` first: it shows which files, functions and
routes were found without writing anything, which narrows most problems down.

## "No JavaScript/TypeScript files found"

`scan` prints `⚠️  No JavaScript/TypeScript files found` and exits 0. `audit`
prints `Error: No JavaScript/TypeScript files found to audit` and `generate`
prints `⚠️  No JavaScript/TypeScript files found or no API documentation
detected.`; both exit 1.

Causes, in the order worth checking:

- **Wrong directory.** `--dir` defaults to the current directory (`scan` takes
  the directory as an argument instead). Paths are resolved from where you run
  the command.
- **Unsupported extension.** Only `.js`, `.mjs`, `.cjs`, `.jsx`, `.ts`, `.mts`,
  `.cts` and `.tsx` are read. TypeScript declaration files (`.d.ts`, `.d.mts`,
  `.d.cts`) are skipped on purpose.
- **Excluded directory.** The default `excludePattern` skips `node_modules`,
  `dist`, `build`, `.cache`, `coverage`, `.turbo`, `.nx`, `.next`, `.nuxt`,
  `out` and `.git`. It is matched against whole directory names relative to the
  scanned directory, so a parent folder called `build` does not matter, but a
  source folder called `out` inside the project does. Override it with
  `--exclude` or `excludePattern` in the config.
- **File too large.** Files over 1 MB are skipped with
  `Warning: Skipping <file> (<size> KB) — exceeds 1 MB limit.` These are almost
  always bundles or generated code. `excludePattern` only matches directories,
  so to silence the warning move the file into a directory you exclude.

## An item shows as undocumented although it has a comment

A comment documents an item only when all of these hold:

- It is a `/** */` block. `/* */` and `//` comments are ignored.
- It ends at most 2 lines above the item, and the next line of code after it is
  the item itself (or the `export` keyword in front of it). Any other statement
  in between breaks the link.
- It sits directly above the item it describes. A comment above a class
  documents nothing; each method needs its own.
- Each comment documents one item. Two functions under one comment leave the
  second undocumented. The exception is routes: a comment above
  `app.route('/x').get(a).post(b)`, or above one Fastify `route({...})` call,
  documents every route that call declares.

If the comment is matched but the item still shows as a gap, look at
`missing:` in the `audit` output:

- `description`: the comment has tags but no text before them.
- `params`: a `@param` is missing, or its name does not match the parameter.
  A destructured parameter needs a top-level `@param` in its position (e.g.
  `@param {Object} options`); a rest parameter `...args` needs `@param args`.
- `returns`: functions need `@returns` (or `@return`); `@returns {void}` is
  enough. Routes do not need it.

## A route is not detected

Routes are recognised in three forms:

```js
app.get('/users/:id', handler); // also post, put, delete, patch
app.route('/books/:id').get(getBook).put(updateBook);
fastify.route({ method: ['GET', 'POST'], url: '/items', handler });
```

The path must be a string literal starting with `/`. Template literals,
variables and full URLs are not treated as routes, which is also what keeps
HTTP-client calls such as `axios.get('https://...')` out. `head`, `options` and
`all` are not recognised.

If `routeServers` is set in the config, only calls on those identifiers count:
`routeServers: ['app']` ignores `router.get(...)`.

## A function is not detected

- **Object literal methods** are only read from objects declared at module
  level (`const api = { list() {} }` or `module.exports = { ... }`). Option or
  callback objects inside function bodies are ignored on purpose.
- **Getters and setters** in object literals are skipped. Class getters and
  setters are listed.
- **Assignments** (`exports.x = () => {}`, `module.exports = function () {}`,
  `Foo.prototype.bar = function () {}`) count only as top-level statements, not
  inside a function.
- **Computed names** (`[Symbol.iterator]()`): class methods are listed as
  `anonymous`; object literal methods are skipped.

## "Failed to load config"

The config file is imported as a JavaScript module. When that fails, the tool
prints a warning and carries on with the defaults:

```text
Warning: Failed to load config from <path>: Unexpected token 'export'. Using defaults. If your project is CommonJS, rename it to apidocs.config.mjs or use module.exports.
```

The file uses `export default`, but the nearest `package.json` has no
`"type": "module"`, so Node loads `.js` as CommonJS. Rename it to
`apidocs.config.mjs`, or switch to `module.exports = { ... }`.

```text
Warning: Failed to load config from <path>: module is not defined in ES module scope ... Using defaults. If your project is an ES module ("type": "module"), use export default or rename it to apidocs.config.cjs.
```

The opposite case: `module.exports` in a project with `"type": "module"`.
Use `export default { ... }`, or rename the file to `apidocs.config.cjs`.

Any other error (a typo, a throw in the file) produces the same
`Failed to load config ... Using defaults.` line with Node's message.

## The config file is not picked up

- It must be in the directory you run the command from, not the scanned
  directory. Without `--config`, the first of `apidocs.config.js`,
  `apidocs.config.mjs` and `apidocs.config.cjs` found there is used.
- With `--config <path>`, a missing file prints
  `Warning: Config file not found: <path>. Using defaults.`
- Command-line flags (`--server-url`, `--api-title`, `--api-version`,
  `--exclude`) override the file.

## `audit` exits 1 in CI

- **Coverage below the threshold.** This is the intended gate. The default
  threshold is 80; set it with `--threshold <0-100>`. The report lists every
  gap and what it is missing.
- **No files found.** See the first section. A wrong `--dir` in CI is the usual
  cause.
- **Invalid options.** `Error: --threshold must be a number between 0 and 100`
  or `Error: Unknown audit format "<name>". Use one of: terminal, json,
  dashboard.`

## `generate` exits 1

- **No valid format.** `⚠️  Unknown format: <name>` followed by
  `❌ No documentation was generated. Valid formats: markdown, md, html, json,
  openapi, swagger`. Check the spelling in `--formats`.
- **A report format.** `dashboard` and `terminal` are coverage reports:
  `⚠️  "dashboard" is a coverage report format; use the audit command`. Use
  `api-docs-generator audit --format dashboard`.
- **A format failed.** `⚠️  Failed to generate <format>: <error>`. The other
  formats are still written; the run ends with
  `❌ Documentation generated with errors: <format> failed`. Please open an
  issue with the error.

## Table of contents links in `API.md` go to the wrong section

The TOC links use GitHub's anchor rules: headings are lowercased, punctuation is
removed, and a repeated heading gets `-1`, `-2` and so on in document order,
counting every heading (the title, `### Functions`, each function heading). The
links are correct on GitHub. Other Markdown renderers that build anchors
differently, or that do not number duplicates, may not match.

## `npm install` reports vulnerabilities in `picomatch`

The warning comes from `picomatch`, which reaches this package through
`@typescript-eslint/typescript-estree` and `tinyglobby`. The advisory is a
regular-expression denial of service in glob matching, and no fixed release
exists yet.

It cannot be triggered through this tool: the parser is never given a
TypeScript project or glob patterns, so `tinyglobby` is not used. The warning
will go away once a fixed `picomatch` is published and the dependency is
updated.
