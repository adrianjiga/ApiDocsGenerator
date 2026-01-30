# api-docs-generator

A powerful Node.js CLI tool that auto-generates API documentation from JavaScript/TypeScript source code. Extracts function signatures, JSDoc comments, and Express/Fastify routes to produce beautiful documentation in multiple formats.

## Features

✨ **Multiple Output Formats**

- Markdown (`.md`) - For GitHub/documentation sites
- HTML (`.html`) - Self-contained with built-in styling
- JSON (`.json`) - Machine-readable for tool integration

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
  - Supported: `markdown`, `html`, `json`

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
```

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
app.get("/users/:id", (req, res) => {
  // route handler
});

app.post("/users", (req, res) => {
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

### JSON Output (`api.json`)

Machine-readable structured data with:

- Metadata (generation timestamp, version)
- All extracted functions and routes
- JSDoc information
- Route parameters

### Generation Report (`GENERATION_REPORT.md`)

Summary of the documentation generation including:

- File count statistics
- Function and route counts
- Generated file list
- Output directory location

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

const express = require("express");
const app = express();

/**
 * Get all users
 */
app.get("/users", (req, res) => {
  res.json([]);
});

/**
 * Create a new user
 */
app.post("/users", (req, res) => {
  res.json({ id: "new-id" });
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

## Troubleshooting

### No files found

Make sure:

- Directory path is correct
- Files have `.js`, `.ts`, `.jsx`, or `.tsx` extensions
- Check that `node_modules`, `dist`, `build` directories are not your only source files

### JSDoc not detected

JSDoc comments must:

- Use the `/** */` block comment format
- Appear immediately before the function declaration
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
- JSDoc linking is proximity-based (closest comment before function)
- Routes with dynamic paths may not be detected
- Comments must be in standard JSDoc format

## Development

```bash
# Run tests
npm test

# Generate docs for the sample app
npm run test:sample

# Run linter
npm run lint
```

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
