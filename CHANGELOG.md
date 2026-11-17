# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-11-17

Initial public release as `@adrianjiga/api-docs-generator`. Requires Node.js 22.12 or newer.

### Added

- CLI commands: `generate` (alias `gen`), `audit` (alias `a`) and `scan`
- Documentation output as Markdown (`API.md`), HTML (`index.html`), JSON (`api.json`) and OpenAPI 3.0.3 YAML (`openapi.yaml`, alias `swagger`), plus a `GENERATION_REPORT.md` summary
- Coverage audit with terminal, JSON and self-contained HTML dashboard reports
- `--threshold` for `audit`: exits with code `1` when coverage is below it, for use in CI
- `generate` exits with code `1` when nothing was generated or a format failed; `scan` exits with code `1` when no files are found
- `audit` writes progress and status messages to stderr and only the report to stdout, so `--format json` output can be piped
- The terminal report and the coverage dashboard are coloured against `--threshold`
- Parsing of `.js`, `.mjs`, `.cjs`, `.jsx`, `.ts`, `.mts`, `.cts` and `.tsx` files via `@typescript-eslint/typescript-estree`; TypeScript declaration files and files over 1 MB are skipped
- Detection of module-level function declarations, arrow and function expressions, class methods and function-valued class fields, prototype methods, object-literal methods and CommonJS exports; immediately-invoked wrappers (IIFE, UMD) and top-level blocks count as module level
- Route detection for Express (`app.get('/path')`, `app.route('/path').get()`) and Fastify (`fastify.route({ method, url })`), optionally restricted with `routeServers`
- JSDoc comments are attached to the item that directly follows them; each comment documents at most one item
- Destructured parameters are documented by the `@param` in their position, and rest parameters by their name without the dots
- Configuration via `apidocs.config.js`, `.mjs` or `.cjs`, with command-line overrides for `--server-url`, `--api-title`, `--api-version` and `--exclude`
- `excludePattern` matched against directory and file names relative to the scanned directory
- Generated output uses paths relative to the scanned directory, not absolute machine paths
- Programmatic API exporting the `generator`, `parser` and `analyzer` modules

[0.1.0]: https://github.com/adrianjiga/ApiDocsGenerator/releases/tag/v0.1.0
