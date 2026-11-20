# Generated Output Reference

What each file api-docs-generator writes looks like. The excerpts below were
produced from this repository's `examples/` directory (and, for the coverage
reports, a small file with deliberate gaps), then trimmed. Timestamps are shown
as `<timestamp>`.

`generate` writes into the output directory (default `./docs`):

| File                   | Format flag                 | Contents                            |
| ---------------------- | --------------------------- | ----------------------------------- |
| `API.md`               | `markdown` (alias `md`)     | Readable docs for GitHub or a wiki  |
| `index.html`           | `html`                      | Self-contained page with inline CSS |
| `api.json`             | `json`                      | Everything the parser found         |
| `openapi.yaml`         | `openapi` (alias `swagger`) | OpenAPI 3.0.3 spec of the routes    |
| `GENERATION_REPORT.md` | always                      | What was scanned and written        |

`audit` prints or writes one coverage report:

| Output                    | `--format`           | Where                                                                       |
| ------------------------- | -------------------- | --------------------------------------------------------------------------- |
| Terminal report           | `terminal` (default) | stdout                                                                      |
| Coverage JSON             | `json`               | stdout, or the `--output` file                                              |
| `coverage-dashboard.html` | `dashboard`          | `--output` file, default `coverage-dashboard.html` in the working directory |

## API.md

A title from `apiTitle`, a table of contents with one entry per file that has
functions or routes, then one section per file. Files without functions or
routes are left out.

````markdown
# API Documentation

Generated: <timestamp>

## Table of Contents

1. [advanced-sample.js](#advanced-samplejs)
2. [sample-app.js](#sample-appjs)

---

## sample-app.js

**File:** `sample-app.js`

### Functions

#### `sum(a, b)`

**Line:** 11

Calculate the sum of two numbers

**Parameters:**

- `a` (`number`): First number
- `b` (`number`): Second number

**Returns:**

- `number`: Sum of a and b

**Usage Example:**

```javascript
sum(a, b);
```

### API Routes

#### `GET /users/:id`

**Line:** 41

Get a single user by their ID

**Route Parameters:** id

**Example Request:**

```bash
curl -X GET 'http://localhost:3000/users/:id'
```
````

- The `**File:**` line (and the 📁 line in `index.html`) is the path relative
  to the scanned directory, e.g. `routes/users.js`.
- A function without a JSDoc block gets `**Description:** No description
  provided`. Its parameters and TypeScript return type are still listed, or
  `**Parameters:** none` when it has no parameters.
- A parameter's type comes from its `@param` tag, falling back to the
  TypeScript annotation and then `any`. Parameters no `@param` covers are
  listed after the tagged ones. Optional parameters and defaults are marked,
  e.g. ``- `b` (`number`, optional, default `1`)``.
- `@deprecated` adds a `> **Deprecated:** <message>` line under the line
  number. `@throws` (or `@exception`) and `@see` get **Throws:** and **See:**
  lists after **Returns:**.
- An inline `{@link https://…|label}` becomes a Markdown link. A link to
  anything other than an `http(s)` URL, such as `{@link sum}`, is shown as
  code.
- A function's or route's own `@example` blocks replace the generated
  **Usage Example** or **Example Request**, under **Example:** (or
  **Examples:**). Line breaks and indentation are kept, and a leading
  `<caption>…</caption>` is shown in italics above the code. Function examples
  are fenced as `javascript`; route examples have no language.
- The `curl` example uses `serverUrl` from the config (default
  `http://localhost:3000`) and the route path as written, with `:param`
  placeholders left in, in single quotes so shells such as zsh do not treat
  `?` or `*` in the path as a glob. `HEAD` routes use `curl -I`.
- TOC anchors follow GitHub's heading rules, including the `-1`, `-2` suffixes
  GitHub adds to repeated headings.

## index.html

The same content as `API.md` as a single page with inline CSS and no external
requests: a header with the title and timestamp, a table of contents, and one
section per file.

```html
<header>
  <h1>📚 API Documentation</h1>
  <p>Auto-generated documentation • <timestamp></p>
</header>
<nav aria-label="Table of Contents">
  <h2>📖 Table of Contents</h2>
  <ul><li><a href="#sample-app-js">sample-app.js</a></li></ul>
</nav>
<div class="file-section" id="sample-app-js">
  <h2>sample-app.js</h2>
  <div class="file-path">📁 sample-app.js</div>
  <div class="subsection">
    <h3>Functions</h3>
    <div class="item">
      <h4>sum(a, b)</h4>
      <div class="meta">📍 Line 11</div>
      <div class="description">Calculate the sum of two numbers</div>
      <div class="params">
        <h5>📥 Parameters</h5>
        <div class="param-item"><span class="param-name">a</span> <code>number</code> — First number</div>
      </div>
      <div class="returns">
        <h5>📤 Returns</h5>
        <div class="param-item"><code>number</code> — Sum of a and b</div>
      </div>
      <h5 style="margin-top: 15px;">💡 Usage Example</h5>
      <div class="code-block">sum(a, b);</div>
    </div>
  </div>
</div>
```

Section ids are the file label with non-word characters turned into `-`
(`sample-app.js` becomes `sample-app-js`); repeated ids get `-2`, `-3`. All text
taken from source code is HTML-escaped.

The page follows the reader's `prefers-color-scheme`: dark by default, light
when the system or browser asks for it. Colours are CSS variables on `:root`
(`--text`, `--surface-1`, `--accent`, `--link`…), so a stylesheet injected
after generation can retheme the page. The coverage dashboard stays dark.

## api.json

A `meta` block and one entry per scanned file, including files with no
functions or routes.

```json
{
  "meta": {
    "generated": "<timestamp>",
    "tool": "api-docs-generator",
    "toolVersion": "0.2.0",
    "apiVersion": "1.0.0"
  },
  "files": [
    {
      "file": "sample-app.js",
      "fileName": "sample-app.js",
      "functions": [
        {
          "name": "sum",
          "params": ["a", "b"],
          "paramDetails": [
            { "name": "a", "optional": false },
            { "name": "b", "optional": false }
          ],
          "description": "Calculate the sum of two numbers",
          "line": 11,
          "async": false,
          "generator": false,
          "exported": false,
          "jsdoc": {
            "description": "Calculate the sum of two numbers",
            "tags": [
              {
                "tag": "param",
                "name": "a",
                "type": "number",
                "optional": false,
                "description": "- First number",
                "problems": [],
                "source": ["..."]
              }
            ]
          }
        }
      ],
      "routes": [
        {
          "method": "GET",
          "path": "/users/:id",
          "params": ["id"],
          "line": 41,
          "jsdoc": {
            "description": "Get a single user by their ID",
            "tags": ["..."]
          }
        }
      ]
    }
  ]
}
```

| Field                                 | Meaning                                                                                                           |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `meta.toolVersion`                    | The api-docs-generator version that wrote the file                                                                |
| `meta.apiVersion`                     | `apiVersion` from the config (default `1.0.0`)                                                                    |
| `files[].file`                        | Path relative to the scanned directory, `/`-separated                                                             |
| `functions[].description`             | The JSDoc description, or `No description provided`                                                               |
| `functions[].exported`                | See [The exported flag](Technical-Design.md#the-exported-flag)                                                    |
| `functions[].className`               | Present for class and prototype methods, with `static` and `methodKind` (`method`, `constructor`, `get` or `set`) |
| `functions[].jsdoc`, `routes[].jsdoc` | `null` when no JSDoc block was matched                                                                            |
| `jsdoc.tags`                          | `comment-parser` tag objects as-is, including `source` and `problems`                                             |

`@param` descriptions keep the leading `- ` from the source; the Markdown and
HTML output strip it. The text of `@example`, `@deprecated` and `@see` tags is
kept whole in `description`, with `type` and `name` empty. `@example`
descriptions keep their line breaks and indentation.

## openapi.yaml

An OpenAPI 3.0.3 document describing the routes. Functions are not included.

```yaml
openapi: 3.0.3
info:
  title: API Documentation
  version: 1.0.0
  description: Auto-generated API documentation
  x-generator: api-docs-generator
  x-generated-at: "<timestamp>"
servers:
  - url: http://localhost:3000
    description: Default development server
tags:
  - name: sample-app.js
    description: Routes from sample-app.js
paths:
  /users/{id}:
    get:
      summary: Get a single user by their ID
      operationId: get-users-id
      tags:
        - sample-app.js
      parameters:
        - name: id
          in: path
          required: true
          description: The user ID from the URL path
          schema:
            type: string
      responses:
        "200":
          description: User object containing id and name
```

- `info.title` and `info.version` come from `apiTitle` and `apiVersion`;
  `servers[0].url` from `serverUrl`.
- `:id` in Express paths becomes `{id}`; a regex constraint such as
  `:id(\d+)` is dropped. OpenAPI has no optional path segments, so an
  optional parameter (`/users/:id?`, or `/users{/:id}` in Express 5) produces
  one path without it and one with it.
- `summary` is the route's JSDoc description, or `GET /users/{id}` without one.
- A path parameter's `description` and `schema` type come from its `@param`
  tag (`id` or `params.id`); the type defaults to `string`.
- `@param` tags named `query.<name>` become query parameters, required unless
  written in brackets: `@param {number} [query.limit=10] - Max results`.
- `@param body` and `@param body.<field>` tags become a JSON `requestBody` on
  `post`, `put` and `patch` operations; OpenAPI 3.0 does not define one for
  `get`, `head`, `delete` or `options`.
  Fields become object properties; the ones not in brackets are `required`.
- JSDoc types map to schemas: `string`, `number`, `integer`, `boolean`,
  `object` and arrays of them (`string[]`, `Array<number>`). Other types, such
  as `User`, give an empty schema that accepts any value.
- Success responses: `201` for `post`, `204` for `delete`, `200` otherwise.
  A `delete` route whose `@returns` has a non-void type gets `200`. The
  response `description` is the `@returns` description, or `Resource created`,
  `No content` or `Successful response`. No response schemas are generated.
- `@deprecated` sets `deprecated: true`.
- An `all` route (`app.all('/proxy')`) becomes one operation per method:
  `get`, `post`, `put`, `patch`, `delete`, `head` and `options`. An explicit
  route for the same path and method takes precedence, wherever it appears.
- There is one tag per source file name. If the same path and method are
  declared twice, only the first one is kept.

## GENERATION_REPORT.md

Written on every `generate` run that finds source files, even when no format
succeeded.

```markdown
# Documentation Generation Summary

Generated: <timestamp>

## Statistics

- Files Scanned: 2
- Functions Found: 6
- API Routes Found: 5
- Output Formats: markdown, html, json, openapi

## Generated Files

- MARKDOWN: `API.md`
- HTML: `index.html`
- JSON: `api.json`
- OPENAPI: `openapi.yaml`

## Location

All files generated in: `docs`
```

`Output Formats` lists the formats as requested, including skipped ones;
`Generated Files` lists only what was written. `Location` is relative to the
working directory. `Functions Found` counts every function, documented or
not; use `audit` for coverage.

## Terminal report

The default `audit` output. The bar and each file name are coloured like the
dashboard: green at or above the threshold, yellow within 30 points below it,
red under that. Without a colour terminal (not a TTY, or `NO_COLOR`
set) it uses `#`, `-`, `x`, `!` and `ok` instead of block characters and
symbols.

```
Documentation Coverage Report

[########------------] 40%

Summary
  Function Coverage:  33.3% (1/3)
  Route Coverage:     50% (1/2)
  Total Items:        5
  Documented Items:   2
  Documentation Gaps: 3

Per-File Breakdown

  users.js (40%)
    ! updateUser (line 12) - missing: params, returns
    x deleteUser (line 14) - missing: description, params, returns
    x GET /users/:id (line 21) - missing: description, params

3 documentation gaps found.
```

`x` (`✗` in colour) marks an item with no JSDoc block (severity `error`); `!`
(`⚠`) marks one with a block that is missing something (severity `warning`). A
file with no gaps shows `All items documented`; a run with no gaps ends with
`Perfect documentation coverage!`.

## Coverage JSON

`audit --format json` produces the analyzer's report.

```json
{
  "summary": {
    "totalFunctions": 3,
    "documentedFunctions": 1,
    "undocumentedFunctions": 1,
    "partiallyDocumented": 1,
    "partiallyDocumentedFunctions": 1,
    "totalRoutes": 2,
    "documentedRoutes": 1,
    "undocumentedRoutes": 1,
    "partiallyDocumentedRoutes": 0,
    "coveragePercentage": 40,
    "functionCoverage": 33.3,
    "routeCoverage": 50
  },
  "files": [
    {
      "fileName": "users.js",
      "filePath": "users.js",
      "totalItems": 5,
      "documentedItems": 2,
      "coveragePercentage": 40,
      "gaps": ["..."]
    }
  ],
  "gaps": [
    {
      "type": "function",
      "name": "updateUser",
      "fileName": "users.js",
      "filePath": "users.js",
      "line": 12,
      "severity": "warning",
      "missing": ["params", "returns"],
      "existing": {
        "description": "Update a user",
        "params": ["id"],
        "returns": false
      },
      "functionSignature": "updateUser(id, changes)"
    }
  ]
}
```

| Field                                                                       | Meaning                                                                                                        |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `summary.coveragePercentage`                                                | Fully documented items / all items, one decimal; the value `--threshold` is compared with                      |
| `summary.partiallyDocumented`                                               | Functions and routes that have a JSDoc block but are missing something                                         |
| `summary.partiallyDocumentedFunctions`, `summary.partiallyDocumentedRoutes` | The same, per kind                                                                                             |
| `summary.undocumentedFunctions`, `summary.undocumentedRoutes`               | Functions or routes with no JSDoc block                                                                        |
| `files[]`                                                                   | One entry per file that has at least one item, with that file's gaps                                           |
| `gaps[].type`                                                               | `function` or `route`; for a route, `name` is `METHOD /path`                                                   |
| `gaps[].missing`                                                            | Any of `description`, `params`, `returns` (`returns` never for routes)                                         |
| `gaps[].existing`                                                           | What the JSDoc block does have; `existing.voidReturn` is set for `@returns {void}`, `{undefined}` or `{never}` |
| `filePath`                                                                  | Path relative to the scanned directory                                                                         |

Without `--output`, the JSON is printed to stdout with nothing else around it,
so it can be piped or redirected. With `--output <file>` it is written to that
file instead.

## coverage-dashboard.html

A self-contained page (inline CSS and SVG, no scripts, no external requests).

```html
<header>
  <h1>📊 Documentation Coverage Dashboard</h1>
  <p class="subtitle">Generated: <local date and time></p>
</header>
<div class="dashboard">
  <div class="gauge-container">
    <svg class="gauge" viewBox="0 0 200 200">...</svg>
    <div class="gauge-label">
      <div class="gauge-percentage">40%</div>
      <div class="gauge-text">Overall Coverage</div>
    </div>
  </div>
  <div class="stats-grid">
    <div class="stat-card error">
      <div class="stat-label">Function Coverage</div>
      <div class="stat-value">33.3%</div>
      <div class="stat-detail">1 of 3</div>
    </div>
    ...
  </div>
</div>
<div class="section">
  <h2 class="section-title">Documentation Gaps</h2>
  <table>
    <thead>
      <tr><th>File</th><th>Type</th><th>Name</th><th>Line</th><th>Severity</th><th>Missing</th></tr>
    </thead>
    ...
  </table>
</div>
<div class="section">
  <h2 class="section-title">Per-File Coverage</h2>
  ...
</div>
```

- The gauge and the per-file bars are green at or above `--threshold` (default
  80%), yellow within 30 points below it and red under that. The function and
  route cards use the same bands; the gaps card is red whenever there is at
  least one gap. The gauge label shows the threshold.
- The timestamp uses the machine's locale, unlike the ISO timestamps elsewhere.
- File names, item names and the missing list are HTML-escaped.
