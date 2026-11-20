# AGENTS.md

Node.js CLI (npm package `@adrianjiga/api-docs-generator`, CLI command `api-docs-generator`) that scans JS/TS source and generates API docs + coverage audits. Pure ESM, plain JS with JSDoc types — no build step, no TypeScript source.

## Commands

- Test: `npm test` (vitest). Single file: `npx vitest run tests/parser.test.js`. Single test: `npx vitest run tests/parser.test.js -t "name"`.
- Lint: `npm run lint` / `npm run lint:fix` (Biome, `biome.json`; `examples/` is excluded from linting).
- Format: `npm run format:check` / `npm run format` (Biome: single quotes, semi, trailing commas). `npm run check` runs lint + format together.
- CI order (`.github/workflows/ci.yml`, Node 22, 24 and 26): `npm run check` (Biome lint + format + import order) → test → `npm run audit:self` (audits `src/` at threshold 100: every function needs a description, `@param` per param, and `@returns`, `{void}` included). Run all three before finishing.
- `npm run generate` variants run the CLI against `./examples` and write into `examples/docs/` (gitignored).
- `npm run audit` exits `1` when coverage is below threshold — this is the CLI's CI hook, not a test failure.

## Architecture

- Entrypoint: `bin/api-docs-generator` → `src/cli.js`. `src/index.js` is the package `main` export.
- Pipeline: `parser.js` (`parseDirectory` → `scanDirectory`/`parseFile`, using `@typescript-eslint/typescript-estree`) → `analyzer.js` (`analyzeCoverage`) → `generator.js` (`generate`).
- Formatters live in `src/formatters/` and are wired in `registry.js`. Two shapes:
  - `type: 'doc'` — `generate(apiData, config)` returns a string written to its `filename` (e.g. markdown → `API.md`).
  - `type: 'report'` — `generate(report, threshold?)`; `filename: null` means print to stdout (terminal).
  - Aliases exist: `md`→markdown, `swagger`→openapi. `generate` skips unknown formats rather than failing.
- Config: first of `apidocs.config.js`/`.mjs`/`.cjs` in cwd (or `--config`), loaded via dynamic `import()` in `generator.js:loadConfig`, merged over defaults. Keys: `excludePattern`, `serverUrl`, `apiTitle`, `apiVersion`, `routeServers`, `acceptTypeScriptReturns`. Vitest's loader accepts ESM in CommonJS packages where Node doesn't, so test real-Node config behaviour by spawning the CLI. Repo root has `apidocs.config.js` — don't break it.

## Gotchas

- JSDoc matching (`matchJSDocToItems`): a comment must end within 2 lines above the item, and the first code token after it must be on the item's line. Each comment documents at most one item. `/** */` only; `//` comments are ignored.
- Route detection: `x.<get|post|put|delete|patch|head|options|all>('/path', ...)`, chained `x.route('/path').get(...)`, and Fastify `x.route({ method, url })`. Paths must be string literals (or `${}`-free template literals) starting with `/`. `x` must be in `routeServers` (config or `--route-servers`); when that's empty, in the file's own `express()`/`Router()`/`fastify()` assignments (`inferRouteServers`); when the file has none, anything goes.
- Files over 1 MB are skipped with a warning (`MAX_FILE_SIZE_BYTES`). Minified bundles: add to `excludePattern`.
- `@returns {void|undefined|never}` counts as fully documented; a missing `@returns` is a gap for functions only — routes don't need one.
- Audit coverage = fully documented items / total items. Dashboard output default filename is `coverage-dashboard.html`.
- Output filenames are fixed: `API.md`, `index.html`, `api.json`, `openapi.yaml`, `GENERATION_REPORT.md`.

## Testing conventions

- `tests/fixtures.js` exports factories (`makeFunction`, `makeRoute`, `fullyDocumentedJsdoc`, `mockApiData`) — reuse these instead of hand-writing fixtures.
- Unit tests mock `console.log/warn/error` via `vi.spyOn(...).mockImplementation(() => {})` and restore in `afterEach`.
- Integration tests (`cli-integration.test.js`, `generator.test.js`) generate into `tests/.tmp-*` dirs and clean up in `beforeEach`/`afterEach`; they assert against real files in `examples/` (`sample-app.js`, `advanced-sample.js`). `examples/sample-app.js` imports `express` (a devDependency).
