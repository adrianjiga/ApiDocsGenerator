# api-docs-generator

A powerful Node.js CLI tool that auto-generates API documentation from JavaScript/TypeScript source code and analyzes documentation coverage. Extracts function signatures, JSDoc comments, and Express/Fastify routes to produce beautiful documentation in multiple formats.

## Features

✨ **Multiple Output Formats**

- Markdown (`.md`) - For GitHub/documentation sites
- HTML (`.html`) - Self-contained with built-in styling
- JSON (`.json`) - Machine-readable for tool integration
- OpenAPI/Swagger (`.yaml`) - Standard API specification format

📊 **Documentation Coverage Analysis**

- Audit documentation completeness across your codebase
- Generate interactive HTML dashboards
- Terminal reports with visual progress bars
- JSON output for CI/CD integration
- Threshold-based exit codes for automation

🔍 **Smart Code Analysis**

- Extracts function signatures and parameters
- Parses JSDoc comments automatically
- Detects Express/Fastify API routes
- Identifies route parameters (`:id`, `:userId`, etc.)
- Generates usage examples

📚 **Zero Configuration**

- Works out of the box
- Simple CLI interface
- Sensible defaults for all options
- Recursive directory scanning

## Installation

```bash
npm install -g api-docs-generator
```

Or use locally:

```bash
npm install api-docs-generator
npm run start -- generate --dir ./src --output ./docs
```

## Quick Start

### Generate Documentation

```bash
api-docs-generator generate --dir ./src --output ./docs --formats markdown,html,json
```

### Audit Documentation Coverage

```bash
api-docs-generator audit --dir ./src --format dashboard
```

### Scan for APIs (Preview)

```bash
api-docs-generator scan ./src
```

## Usage

### Command: `generate` (alias: `gen`)

Generate API documentation from source code.

```bash
api-docs-generator generate [options]
```

**Options:**

- `-d, --dir <directory>` - Source directory to scan (default: `.`)
- `-o, --output <directory>` - Output directory for generated docs (default: `./docs`)
- `-f, --formats <formats>` - Output formats as comma-separated list (default: `markdown,html,json`)
  - Supported: `markdown`, `html`, `json`, `openapi` (alias: `swagger`)

**Examples:**

```bash
# Generate all formats in default directories
api-docs-generator generate

# Custom source and output directories
api-docs-generator generate --dir ./src --output ./api-docs

# Markdown only
api-docs-generator generate --dir ./src --formats markdown

# Multiple formats
api-docs-generator generate --formats markdown,html,json

# OpenAPI/Swagger spec
api-docs-generator generate --dir ./src --formats openapi
```

### Command: `audit` (alias: `a`)

Audit documentation coverage and generate coverage reports.

```bash
api-docs-generator audit [options]
```

**Options:**

- `-d, --dir <directory>` - Source directory to scan (default: `.`)
- `-t, --threshold <number>` - Coverage threshold percentage (default: `80`)
- `-f, --format <format>` - Output format: `terminal`, `json`, or `dashboard` (default: `terminal`)
- `-o, --output <file>` - Output file for dashboard format (default: `coverage-dashboard.html`)

**Exit Codes:**

- `0` - Coverage meets or exceeds threshold
- `1` - Coverage below threshold

**Examples:**

```bash
# Terminal report with default 80% threshold
api-docs-generator audit --dir ./src

# Generate interactive HTML dashboard
api-docs-generator audit --dir ./src --format dashboard

# Generate dashboard to custom location
api-docs-generator audit --dir ./src --format dashboard --output ./reports/coverage.html

# Set custom threshold and output JSON
api-docs-generator audit --dir ./src --threshold 90 --format json

# Use in CI/CD - fail if coverage below 75%
api-docs-generator audit --dir ./src --threshold 75 --format terminal
```

**Coverage Metrics:**

- **Fully Documented**: Function has JSDoc, description, @param for all params, and @returns (or @return) tag
- **Partially Documented**: Function has JSDoc but missing required elements
- **Undocumented**: No JSDoc comment
- **Coverage Percentage**: (Fully documented items) / (Total items) × 100

### Command: `scan`

Scan a directory and display found APIs without generating documentation.

```bash
api-docs-generator scan [directory]
```

**Examples:**

```bash
# Scan current directory
api-docs-generator scan

# Scan specific directory
api-docs-generator scan ./src
```

## JSDoc Format

For best results, document your functions using JSDoc format:

```javascript
/**
 * Brief description of what the function does
 * @param {type} paramName - Description of parameter
 * @param {type} paramName2 - Description of parameter 2
 * @returns {type} Description of return value
 */
function myFunction(paramName, paramName2) {
  // implementation
}
```

Both `@returns` and `@return` are recognized.

**Example:**

```javascript
/**
 * Calculate the sum of two numbers
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} Sum of a and b
 */
function sum(a, b) {
  return a + b;
}
```

## Express/Fastify Routes

The tool automatically detects Express and Fastify route definitions:

```javascript
app.get('/users/:id', (req, res) => {
  // route handler
});

app.post('/users', (req, res) => {
  // route handler
});
```

Supported HTTP methods:

- `get()`
- `post()`
- `put()`
- `delete()`
- `patch()`

## Output Files

### Markdown Output (`API.md`)

Human-readable documentation with:

- Table of contents
- Function signatures and descriptions
- Parameter details
- Usage examples
- API route documentation

### HTML Output (`index.html`)

Beautiful, self-contained HTML with:

- Responsive design
- Color-coded sections
- Interactive navigation
- Code syntax highlighting
- Professional styling
- Dark theme with rich color palette
- XSS-safe: all dynamic content is escaped

### JSON Output (`api.json`)

Machine-readable structured data with:

- Metadata (generation timestamp, version)
- All extracted functions and routes
- JSDoc information
- Route parameters

### OpenAPI Output (`openapi.yaml`)

OpenAPI 3.0.3 specification with:

- Standard spec structure compatible with Swagger UI and other tools
- Automatic conversion of Express `:param` to `{param}` syntax
- Routes grouped by path with proper HTTP method keys
- Path parameters with schema definitions
- Tags derived from source file names

### Generation Report (`GENERATION_REPORT.md`)

Summary of the documentation generation including:

- File count statistics
- Function and route counts
- Generated file list
- Output directory location

### Coverage Dashboard (`coverage-dashboard.html`)

Interactive HTML dashboard showing:

- Circular progress gauge (color-coded: green ≥80%, yellow 50-80%, red <50%)
- Summary stat cards (function coverage, route coverage, gaps count)
- Per-file coverage breakdown with progress bars
- Detailed table of all documentation gaps
- Per-file coverage table
- Responsive design with dark theme
- Self-contained with inline CSS (no external dependencies)

## Example Project Structure

```
my-api/
├── src/
│   ├── routes/
│   │   ├── users.js
│   │   └── posts.js
│   └── utils/
│       └── helpers.js
├── package.json
└── api-docs-generator.config.js (optional)
```

Generate documentation:

```bash
api-docs-generator generate --dir ./src --output ./docs
```

Result:

```
docs/
├── API.md                    # Markdown documentation
├── index.html                # HTML documentation
├── api.json                  # JSON data
├── openapi.yaml              # OpenAPI 3.0.3 spec
└── GENERATION_REPORT.md      # Generation summary
```

## Complete Example

### Sample Source Code (src/api.js)

```javascript
/**
 * Fetch user by ID from database
 * @param {string} userId - The unique user identifier
 * @returns {Promise<Object>} User object with id, name, and email
 */
async function getUserById(userId) {
  // implementation
}

const express = require('express');
const app = express();

/**
 * Get all users
 */
app.get('/users', (req, res) => {
  res.json([]);
});

/**
 * Create a new user
 */
app.post('/users', (req, res) => {
  res.json({ id: 'new-id' });
});
```

### Run Generation

```bash
api-docs-generator generate --dir ./src --output ./docs --formats markdown,html
```

### Generated Documentation

The tool will create:

- `docs/API.md` - Comprehensive markdown guide
- `docs/index.html` - Beautiful HTML documentation
- `docs/api.json` - Structured data
- `docs/GENERATION_REPORT.md` - Summary report

## Supported File Types

The tool scans and parses:

- `.js` - JavaScript files
- `.ts` - TypeScript files
- `.jsx` - React JavaScript
- `.tsx` - React TypeScript

## How It Works

1. **Directory Scanning** - Recursively scans for JS/TS files
2. **AST Parsing** - Uses espree to parse JavaScript code
3. **JSDoc Extraction** - Parses JSDoc comments using comment-parser
4. **Route Detection** - Identifies Express/Fastify route definitions
5. **Metadata Collection** - Gathers functions, routes, and documentation
6. **Format Generation** - Creates output in specified formats
7. **File Writing** - Writes all documentation to output directory

## Configuration

### Environment Variables

- `API_DOC_GEN_EXCLUDE` - Glob pattern to exclude directories (default: `node_modules|dist|build`)

### Command Line Options

All options can be specified via command line flags. No configuration file is required.

## Documentation Coverage Analysis

The built-in coverage analyzer helps you maintain high documentation quality across your codebase.

### How Coverage is Calculated

**Fully Documented Items** have:

- ✅ JSDoc comment block
- ✅ Description text
- ✅ @param tags for all parameters
- ✅ @returns tag (or @return alias)

**Partially Documented Items** have:

- ⚠️ JSDoc comment block
- ⚠️ Missing one or more required elements

**Undocumented Items**:

- ❌ No JSDoc comment

### Coverage Report Formats

**Terminal Format** (default):

```
[████████████░░░░░░░░░] 65.2%
Function Coverage: 65.2% (15/23)
Route Coverage: 0% (0/0)
Documentation Gaps: 8
```

Perfect for local development and CI/CD pipelines.

**Dashboard Format**:

- Interactive HTML dashboard
- Color-coded gauge (green/yellow/red)
- Summary stat cards
- Per-file breakdown with progress bars
- Detailed gaps table
- Responsive design

**JSON Format**:

- Machine-readable output
- Complete analysis data
- Easy integration with other tools

### CI/CD Integration

Use the audit command in your build pipeline:

```bash
# Fail if coverage drops below 80%
api-docs-generator audit --dir ./src --threshold 80

# Generate dashboard for build artifacts
api-docs-generator audit --dir ./src --format dashboard --output ./artifacts/coverage.html
```

## Visual Design

The HTML formatters feature a **bold, production-ready design** with:

- **Rich dark theme** with sophisticated color palette
- **Animated gradient orbs** for visual depth
- **Golden ratio typography** for readability
- **Micro-interactions** on hover and focus states
- **Responsive design** for mobile, tablet, and desktop
- **Accessibility support** including reduced-motion preferences

All styling is inline with zero external dependencies.

## Troubleshooting

### No files found

Make sure:

- Directory path is correct
- Files have `.js`, `.ts`, `.jsx`, or `.tsx` extensions
- Check that `node_modules`, `dist`, `build` directories are not your only source files

### JSDoc not detected

JSDoc comments must:

- Use the `/** */` block comment format
- Appear within 2 lines above the function declaration (at most one blank line between `*/` and the function)
- Be valid JSDoc syntax

### Routes not detected

Express/Fastify routes must:

- Use `app.get()`, `app.post()`, etc.
- Have a string literal as the first argument
- Follow standard Express route syntax

## Performance

- **Fast AST parsing** with espree
- **Recursive scanning** with efficient directory traversal
- **Minimal dependencies** for small bundle size
- Handles projects with hundreds of files efficiently

## Limitations

- Does not analyze runtime behavior
- JSDoc linking is proximity-based (closest comment within 2 lines before function)
- Routes with dynamic paths may not be detected
- Comments must be in standard JSDoc format

## Development

```bash
# Run the full test suite (vitest)
npm test

# Generate docs for the examples directory
npm run generate

# Run linter
npm run lint
```

Tests use [vitest](https://vitest.dev/) with shared fixtures in `tests/fixtures.js`.

## License

MIT

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## Support

For issues and questions:

- Check the examples directory
- Review generated output formats
- Ensure JSDoc is properly formatted

---

**Made with ❤️ for API documentation lovers**
