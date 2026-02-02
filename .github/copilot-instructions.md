# Copilot Instructions for api-docs-generator

## Quick Reference

**Run the CLI directly:**

```bash
npm run start -- generate --dir ./src --output ./docs --formats markdown,html,json
npm run start -- audit --dir ./src --threshold 80 --format terminal
npm run start -- scan ./src
```

**Available npm scripts:**

```bash
# Documentation generation (from examples directory)
npm run generate              # All formats (markdown, html, json)
npm run generate:markdown     # Markdown only
npm run generate:html         # HTML only
npm run generate:json         # JSON only

# Scanning & auditing (examples directory)
npm run scan                  # Preview APIs without generating files
npm run audit                 # Terminal coverage report
npm run audit:json            # JSON coverage report
npm run audit:dashboard       # HTML coverage dashboard

# Testing & linting
npm test                      # Run vitest test suite
npm run test:watch            # Run vitest in watch mode
npm run lint                  # Run ESLint
npm run lint:fix              # Run ESLint with auto-fix

# Formatting
npm run format                # Run Prettier (write)
npm run format:check          # Run Prettier (check only)
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
Format Generators (Markdown, HTML, JSON, OpenAPI)
    ↓
Output files: API.md, index.html, api.json, openapi.yaml, GENERATION_REPORT.md
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
  - `html.js` - Generates self-contained index.html with styling; escapes all dynamic content via `escapeHtml` to prevent XSS
  - `json.js` - Generates api.json with structured data
  - `openapi.js` - Generates OpenAPI 3.0.3 spec as YAML via js-yaml; converts Express `:param` to `{param}` syntax
  - `terminal.js` - Formats coverage reports for terminal output
  - `dashboard.js` - Generates self-contained HTML coverage dashboard; imports `escapeHtml` from utils

- **`src/utils.js`** - Helper utilities: `sanitizeHtmlId`, `getParamName`, `truncate`, `capitalize`, `formatTimestamp`, `escapeHtml`

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
2. For each function, find the closest JSDoc comment that appears **before** it within **2 lines** (distance ≤ 2)
3. If JSDoc exists, attach parsed JSDoc data to the function object

This means JSDoc must appear immediately before the function it documents (at most one blank line between the closing `*/` and the function).

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
- `openapi.yaml` - OpenAPI 3.0.3 specification (YAML)
- `GENERATION_REPORT.md` - Summary report

### Documentation Coverage Analysis

The `analyzeCoverage()` function evaluates documentation completeness:

**Function Coverage Rules:**

- **Fully documented**: JSDoc exists + non-empty description + @param for all params + @returns tag (or @return alias)
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

- `npm test` - Run the full vitest test suite
- `npm run start` - Run CLI manually
- `npm run generate` - Generate docs from examples directory (quick sanity check)
- `npm run lint` - Run ESLint

**Test Framework:** vitest (ESM-native, uses `describe`, `it`, `expect`, `vi` for mocking)

**Shared Fixtures:** `tests/fixtures.js` exports reusable helpers to avoid mock data duplication:

- `makeFunction(name, params, jsdoc)` - Creates a mock function object
- `makeRoute(method, path, params, jsdoc?)` - Creates a mock route object
- `fullyDocumentedJsdoc(params)` - Creates a complete JSDoc object with @param tags for all params and @returns
- `mockApiData` - A standard parsed file array used across formatter tests (html, markdown, json)

**Console Suppression:** Tests that exercise code paths which call `console.log`/`console.warn`/`console.error` use `vi.spyOn(console, '<method>').mockImplementation(() => {})` in `beforeEach` and `vi.restoreAllMocks()` in `afterEach` to keep test output clean while still allowing assertions on what was logged.

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

## UI/UX Design

The HTML formatters (dashboard and API docs) feature **production-ready design** with:

- **Rich dark theme**: `#0a0a0f` primary background, `#f8fafc` text
- **Vibrant accent colors**: Indigo (#6366f1), Purple (#8b5cf6), Emerald (#10b981), Amber (#f59e0b)
- **Animated gradient orbs**: Floating background elements for visual depth (8s-12s animations)
- **Golden ratio typography**: Scientifically scaled font sizes from 0.75rem to 4.236rem
- **Micro-interactions**: Smooth card hover effects, badge glows, transitions (0.3s)
- **8px grid spacing**: Consistent, proportional spacing throughout
- **Entrance animations**: fadeInDown/fadeInUp with staggered timing
- **Accessibility**: Respects `prefers-reduced-motion`, proper color contrast (4.5:1+)
- **Responsive**: Mobile-first design works on all device sizes

All CSS is inline with zero external dependencies. Design follows the frontend-design skill principles.

## Important Notes

- **No configuration file** - All options are command-line flags; environment variables for exclusion patterns only
- **AST parsing scope** - Limited to ES2022 syntax (see espree config in parser.js)
- **JSDoc format requirement** - Must use `/** */` block comment format within 2 lines above the function
- **JSDoc tag aliases** - Both `@returns` and `@return` are recognized as the returns tag
- **Route detection limitation** - Only detects routes with string literal paths, not dynamic/template paths
- **XSS protection** - HTML and dashboard formatters escape all dynamic content via `escapeHtml` (from `src/utils.js`) to prevent injection
- **Error handling** - Parser warns on individual file parse failures but continues processing
- **Dashboard output** - Automatically creates parent directories as needed
