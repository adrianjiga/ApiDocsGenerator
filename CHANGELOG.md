# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-26

### Added

- Multiple output formats: Markdown, HTML, JSON, and OpenAPI 3.0.3
- Coverage analysis with terminal, HTML dashboard, and JSON report modes
- CLI commands: `generate` (`gen`), `audit` (`a`), and `scan`
- TypeScript and JSDoc parsing via `@typescript-eslint/typescript-estree`
- Express and Fastify route auto-detection
- `apidocs.config.js` configuration file support for zero-flag operation
- Threshold-based exit codes for CI integration (`--min-coverage`)
- Coverage dashboard as a self-contained HTML file
- JSON output exposes `async`, `exported`, `className`, `static`, and `methodKind` fields per endpoint
- `DEFAULT_EXCLUDE_PATTERN` covers modern monorepo tooling directories (`.turbo`, `.nx`, etc.)
- Automatic skip of files over 1 MB to prevent hanging on minified bundles

### Fixed

- Absolute server paths no longer leak into HTML and Markdown output
- `config.apiTitle` now propagates correctly to HTML `<title>`, `<h1>`, and Markdown heading
- `sanitizeHtmlId` strips leading/trailing hyphens for Unicode filenames
- Shared `sanitizeHtmlId` used for Markdown TOC anchor links for consistency
- Misleading `arg_` prefix removed from generated usage examples
- Tool version and API version are now separated in the JSON `meta` block
- ANSI codes stripped and ASCII fallback used when stdout is not a TTY
- `@returns {void}` now correctly satisfies the returns coverage check
- OpenAPI spec uses correct HTTP success codes (POST → 201, DELETE → 204)
- OpenAPI `operationId` values deduplicated to produce a valid spec
- Config file loaded via `pathToFileURL` for cross-platform compatibility
- `scanDirectory` guards against invalid exclude regex patterns
- `--version` flag reads from `package.json` instead of a hardcoded string
- ESM `import` used in generated documentation examples (replaced CommonJS `require`)
- `aria-label` added to nav element for screen reader accessibility

### Changed

- Formatting centralized across all output formatters
- Analyzer hardened with try-catch blocks to prevent uncaught parse errors
- Common analyzer utility functions extracted to reduce duplication
- SVG gauge magic number `5.65` replaced with a named constant
- Dead CSS keyframe animations (`stagger-1/2/3`) removed from HTML output

[1.0.0]: https://github.com/adrianjiga/ApiDocsGenerator/releases/tag/v1.0.0
