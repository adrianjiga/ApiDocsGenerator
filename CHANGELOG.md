# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - Unreleased

Initial public release as `@adrianjiga/api-docs-generator`. Requires Node.js 22.12 or newer.

### Added

- CLI commands: `generate` (alias `gen`), `audit` (alias `a`) and `scan`
- Documentation output as Markdown (`API.md`), HTML (`index.html`), JSON (`api.json`) and OpenAPI 3.0.3 YAML (`openapi.yaml`, alias `swagger`), plus a `GENERATION_REPORT.md` summary
- Coverage audit with terminal, JSON and self-contained HTML dashboard reports
- `--threshold` for `audit`: exits with code `1` when coverage is below it, for use in CI
- `generate` exits with code `1` when nothing was generated or a format failed
- Parsing of `.js`, `.mjs`, `.cjs`, `.jsx`, `.ts`, `.mts`, `.cts` and `.tsx` files via `@typescript-eslint/typescript-estree`; TypeScript declaration files and files over 1 MB are skipped
- Detection of function declarations, arrow and function expressions, class and prototype methods, object-literal methods and CommonJS exports
- Route detection for Express (`app.get('/path')`, `app.route('/path').get()`) and Fastify (`fastify.route({ method, url })`), optionally restricted with `routeServers`
- JSDoc comments are attached to the item that directly follows them; each comment documents at most one item
- Configuration via `apidocs.config.js`, `.mjs` or `.cjs`, with command-line overrides for `--server-url`, `--api-title`, `--api-version` and `--exclude`
- `excludePattern` matched against paths relative to the scanned directory
- Generated output uses paths relative to the scanned directory, not absolute machine paths
- Programmatic API exporting the `generator`, `parser` and `analyzer` modules

[0.1.0]: https://github.com/adrianjiga/ApiDocsGenerator/releases/tag/v0.1.0
