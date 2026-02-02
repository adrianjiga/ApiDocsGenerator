# api-docs-generator Quick Start Guide

Get up and running with api-docs-generator in 2 minutes.

## Installation

```bash
npm install -g api-docs-generator
```

## Basic Usage

### 1. Generate Documentation

```bash
api-docs-generator generate --dir ./src --output ./docs
```

This will:

- Scan `./src` for all `.js`, `.ts`, `.jsx`, and `.tsx` files
- Extract functions and API routes
- Generate documentation in `./docs` folder with:
  - `API.md` (Markdown)
  - `index.html` (Beautiful HTML)
  - `api.json` (Machine-readable JSON)

### 2. View Results

Open `./docs/index.html` in your browser to see beautiful documentation!

## Add JSDoc Comments

For best results, document your functions with JSDoc:

```javascript
/**
 * Get user by ID
 * @param {string} userId - The user ID
 * @returns {Object} User object
 */
function getUser(userId) {
  return { id: userId, name: 'John Doe' };
}
```

## Preview APIs Without Generating

```bash
api-docs-generator scan ./src
```

Output:

```
📂 Scanning: /path/to/src

📄 users.js
  Functions: getUser, createUser, deleteUser
  Routes: GET /users/:id, POST /users, DELETE /users/:id

✅ Found 1 file(s) with 3 function(s) and 3 route(s)
```

## Audit Documentation Coverage

Check how well your code is documented:

```bash
api-docs-generator audit --dir ./src
```

This generates a beautiful terminal report showing:

- Overall coverage percentage
- Function vs route coverage
- List of undocumented/partially documented items

### Generate Interactive Dashboard

```bash
api-docs-generator audit --dir ./src --format dashboard
```

Opens `coverage-dashboard.html` in your browser with:

- Color-coded progress gauge
- Summary statistics
- Per-file breakdown
- Detailed gaps table

### Use in CI/CD

```bash
# Fail if coverage drops below 80%
api-docs-generator audit --dir ./src --threshold 80
```

## Common Commands

### Generate Markdown Only

```bash
api-docs-generator generate --dir ./src --formats markdown
```

### Generate HTML Only

```bash
api-docs-generator generate --dir ./api --output ./public/docs --formats html
```

### Generate OpenAPI Spec

```bash
api-docs-generator generate --dir ./src --formats openapi
```

### Multiple Format Output

```bash
api-docs-generator generate --formats markdown,html,json
```

### Audit with Custom Threshold

```bash
api-docs-generator audit --dir ./src --threshold 90 --format terminal
```

## Working with Express/Fastify

The tool automatically detects routes:

```javascript
const express = require('express');
const app = express();

// These routes are auto-detected!
app.get('/users/:id', (req, res) => {
  /* ... */
});
app.post('/users', (req, res) => {
  /* ... */
});
app.put('/users/:id', (req, res) => {
  /* ... */
});
app.delete('/users/:id', (req, res) => {
  /* ... */
});
```

## Output Structure

```
docs/
├── API.md                 # Read on GitHub or your wiki
├── index.html             # Share with team - open in browser
├── api.json               # Use with tools and integrations
├── openapi.yaml           # OpenAPI 3.0.3 spec for Swagger UI
└── GENERATION_REPORT.md   # Summary of generation

# Coverage audit outputs:
coverage-dashboard.html    # Interactive coverage dashboard
```

## Tips

1. **Keep JSDoc updated** - Tool uses JSDoc for detailed info
2. **Use consistent patterns** - Helps AST parsing work better
3. **Export functions** - Both `function` and `const fn = () => {}` work
4. **Exclude directories** - `node_modules`, `dist`, `build` automatically excluded
5. **Audit regularly** - Monitor documentation coverage as code grows

## Supported File Types

- `.js` JavaScript
- `.ts` TypeScript
- `.jsx` React
- `.tsx` React TypeScript

## Documentation Coverage Levels

✅ **Fully Documented** - Has JSDoc, description, @param for all params, and @returns (or @return) tag

⚠️ **Partially Documented** - Has JSDoc but missing required elements

❌ **Undocumented** - No JSDoc comment

## Need Help?

```bash
api-docs-generator --help
api-docs-generator generate --help
api-docs-generator audit --help
api-docs-generator scan --help
```

---

**Ready?** Start documenting: `api-docs-generator generate --dir ./src`
