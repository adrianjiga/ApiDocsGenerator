# Copilot Instructions for api-docs-generator

## Quick Reference

**Run the CLI:**

```bash
npm run start -- generate --dir ./src --output ./docs --formats markdown,html,json
npm run start -- audit --dir ./src --threshold 80 --format terminal
npm run start -- scan ./src
npm run test:sample
```

**Available Commands:**
- `generate` (alias `gen`) - Generate API documentation in multiple formats
- `audit` (alias `a`) - Audit documentation coverage against a threshold
- `scan` - Preview APIs without generating files

## Architecture Overview

**api-docs-generator** is a Node.js CLI that auto-generates API documentation by parsing JavaScript/TypeScript source files and extracting:

1. **Function declarations** - via AST parsing with espree
2. **JSDoc comments** - via comment-parser
3. **Express/Fastify routes** - by detecting `app.get()`, `app.post()`, etc. in AST

### Data Flow

```
Source Directory
    ↓
parser.parseDirectory() → Scans .js, .ts, .jsx, .tsx files recursively
    ↓
1. parseJSDoc() → Extracts JSDoc blocks with comment-parser
2. extractFunctions() → Walks AST to find function declarations & route handlers
3. matchJSDocToFunctions() → Links JSDoc to nearest preceding function
    ↓
Array of parsed file objects: { fileName, file, functions[], routes[] }
    ↓
Format Generators (Markdown, HTML, JSON)
    ↓
Output files: API.md, index.html, api.json, GENERATION_REPORT.md
```

### Module Structure

- **`src/cli.js`** - Command-line interface with three commands:
  - `generate` - Generates docs from source directory
  - `scan` - Preview APIs without generating files
  - `audit` - Audits documentation coverage against a threshold

- **`src/parser.js`** - Core parsing logic:
  - `parseDirectory(dir)` - Recursively scans directory, returns array of file objects
  - `parseFile(filePath)` - Parses single file
  - `parseJSDoc(sourceCode)` - Extracts JSDoc comments
  - `extractFunctions(sourceCode)` - Walks AST to extract functions and routes
  - `extractRouteParams(routePath)` - Parses route parameters (`:id`, `:userId`)
  - `matchJSDocToFunctions(functions, comments)` - Links JSDoc to functions by line proximity

- **`src/analyzer.js`** - Documentation coverage analysis:
  - `analyzeCoverage(apiData)` - Analyzes documentation completeness across all files
  - `checkFunctionDocumentation(func)` - Determines if a function is fully/partially/undocumented
  - Returns summary metrics, per-file breakdown, and detailed list of gaps

- **`src/generator.js`** - Orchestrates documentation generation:
  - `generate(sourceDir, outputDir, formats)` - Main entry point
  - Calls appropriate formatter based on format type
  - Writes files to output directory

- **`src/formatters/`** - Format-specific generators:
  - `markdown.js` - Generates API.md with TOC, function signatures, JSDoc details
  - `html.js` - Generates self-contained index.html with styling
  - `json.js` - Generates api.json with structured data

- **`src/utils.js`** - Helper utilities for sanitization, truncation, formatting

## Key Conventions

### AST Node Matching

When extracting functions, the parser walks the entire AST looking for:

- **FunctionDeclaration** nodes - `function myFunc() {}`
- **VariableDeclarator** nodes with ArrowFunctionExpression/FunctionExpression - `const fn = () => {}`
- **CallExpression** nodes with HTTP methods - `app.get('/path', handler)`

Uses a `visited` Set during tree walk to prevent processing the same node twice.

### JSDoc Linking Strategy

JSDoc comments are matched to functions by **line proximity**:

1. Extract all JSDoc blocks with their line numbers
2. For each function, find the closest JSDoc comment that appears **before** it
3. If JSDoc exists, attach parsed JSDoc data to the function object

This means JSDoc must appear immediately before the function it documents (no blank lines recommended).

### Route Detection Pattern

Routes are identified by looking for CallExpression nodes where:

- `callee.property.name` is one of: `get`, `post`, `put`, `delete`, `patch`
- First argument (`arguments[0]`) is a string literal (the route path)
- Route parameters are extracted via regex: `/:(\w+)/g`

Example: `app.post("/users/:userId/posts/:postId", handler)` extracts `["userId", "postId"]`

### File Filtering

The parser recursively scans for files with extensions:

- `.js`, `.ts`, `.jsx`, `.tsx`

Default exclusions (via environment variable `API_DOC_GEN_EXCLUDE`):

- `node_modules`, `dist`, `build`

### Output Naming

Generated files always use these exact names:

- `API.md` - Markdown documentation
- `index.html` - HTML documentation
- `api.json` - JSON structured data
- `GENERATION_REPORT.md` - Summary report

### Documentation Coverage Analysis

The `analyzeCoverage()` function evaluates documentation completeness:

**Function Coverage Rules:**
- **Fully documented**: JSDoc exists + non-empty description + @param for all params + @returns/@return tag
- **Partially documented**: JSDoc exists but missing required elements
- **Undocumented**: No JSDoc (jsdoc is null)

**Route Coverage Rules:**
- **Documented**: jsdoc is not null (currently routes rarely have docs)
- **Undocumented**: jsdoc is null

**Coverage Percentage Calculation:**
```
coverage % = (fully documented items) / (total items) * 100
```
Rounded to 1 decimal place.

**Return Object Structure:**
```javascript
{
  summary: {
    totalFunctions,        // Total function count
    documentedFunctions,   // Fully documented
    undocumentedFunctions, // No JSDoc at all
    partiallyDocumented,   // JSDoc exists but incomplete
    totalRoutes,
    documentedRoutes,
    coveragePercentage,    // 0-100
    functionCoverage,      // 0-100
    routeCoverage          // 0-100
  },
  files: [
    {
      fileName,
      filePath,
      totalItems,          // Functions + routes in file
      documentedItems,     // Fully documented items
      coveragePercentage,
      gaps: [...]          // File-specific gaps
    }
  ],
  gaps: [
    {
      type: "function" | "route",
      name,
      fileName,
      filePath,
      line,
      severity: "error" | "warning",  // "error" = undocumented, "warning" = partial
      missing: ["description", "params", "returns"],
      existing: {
        description: string | null,
        params: string[],    // Documented param names
        returns: boolean
      },
      functionSignature     // e.g. "myFunc(arg1, arg2)"
    }
  ]
}
```

## Code Patterns

### Parser Result Object Structure

Each file parsed returns:

```javascript
{
  file: "/absolute/path/to/file.js",
  fileName: "file.js",
  functions: [
    {
      type: "function",
      name: "myFunction",
      params: ["arg1", "arg2"],
      line: 42,
      nodeType: "FunctionDeclaration",
      jsdoc: { /* parsed JSDoc object */ }  // Only if JSDoc found
    }
  ],
  routes: [
    {
      type: "route",
      method: "GET",
      path: "/users/:id",
      params: ["id"],
      line: 55,
      jsdoc: { /* parsed JSDoc object */ }  // Optional
    }
  ]
}
```

### Formatter Function Signature

All formatters export a single function:

```javascript
function generate<Format>(apiData, options = {}) {
  // apiData is the array of parsed file objects from parser
  return contentString;  // Returns string, not file path
}
```

The generator.js then writes the returned string to disk.

## Testing & Validation

**Available Scripts:**

- `npm run start` - Run CLI manually
- `npm run test:sample` - Generate docs from examples directory (quick sanity check)

**Manual Testing:**

```bash
# Scan for APIs
npm run start -- scan ./src

# Generate docs
npm run start -- generate --dir ./examples --output /tmp/docs-test

# Audit coverage (terminal output)
npm run start -- audit --dir ./src --threshold 80 --format terminal

# Audit coverage (JSON output)
npm run start -- audit --dir ./src --threshold 90 --format json

# Test single format
npm run start -- generate --dir ./src --formats markdown

# Verify output exists
ls -la ./docs/
```

**Audit Command Options:**
- `-d, --dir <directory>` - Source directory to scan (default: `.`)
- `-t, --threshold <number>` - Coverage threshold percentage (default: `80`)
- `-f, --format <format>` - Output format: `terminal` or `json` (default: `terminal`)

Exit codes for audit command:
- **0** - Coverage meets or exceeds threshold
- **1** - Coverage below threshold

## Important Notes

- **No configuration file** - All options are command-line flags; environment variables for exclusion patterns only
- **AST parsing scope** - Limited to ES2022 syntax (see espree config in parser.js)
- **JSDoc format requirement** - Must use `/** */` block comment format immediately before function
- **Route detection limitation** - Only detects routes with string literal paths, not dynamic/template paths
- **Error handling** - Parser warns on individual file parse failures but continues processing
