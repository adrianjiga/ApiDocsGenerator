# Contributing to api-docs-generator

api-docs-generator is a command-line tool that reads JavaScript and TypeScript
source, writes API docs from the JSDoc in it, and audits documentation
coverage. It targets Node.js 22.12+.

Thanks for your interest. This file describes how to get set up and how to get
changes merged.

## Getting started

Prerequisites:

- Node.js 22.12+ (older versions are not supported)
- npm

```bash
npm install
```

The project is pure ESM, written in plain JavaScript with JSDoc types. There is
no build step: `bin/api-docs-generator` runs `src/cli.js` directly.

## Useful commands

| Command              | What it does                                                  |
| -------------------- | ------------------------------------------------------------- |
| `npm test`           | Run the test suite (vitest)                                   |
| `npm run test:watch` | Run the tests in watch mode                                   |
| `npm run check`      | Biome lint, format and import-order check (what CI runs)      |
| `npm run lint:fix`   | Apply Biome's safe lint fixes                                 |
| `npm run format`     | Format every file with Biome                                  |
| `npm run generate`   | Run the CLI against `examples/` and write to `examples/docs/` |
| `npm run audit`      | Run a coverage audit against `examples/`                      |
| `npm run scan`       | List what the parser finds in `examples/`                     |

`examples/docs/` is gitignored, so the `generate` scripts are safe to run.
`npm run audit` exits `1` when coverage is below the threshold. That is the
command working as intended, not a test failure.

## Development workflow

Every change goes through a branch and a pull request against
[`main`](https://github.com/adrianjiga/ApiDocsGenerator/tree/main).

1. Create a branch:

   ```bash
   git checkout -b <type>/<short-description>   # e.g. fix/route-detection
   ```

2. Commit in small, logical steps with single-line
   [conventional commit](https://www.conventionalcommits.org/) messages:

   ```text
   feat(parser): detect Koa router routes
   fix(markdown): keep TOC anchors unique
   docs: explain the coverage rules
   ci: test on Node 26
   ```

3. Before pushing, make sure the checks pass:

   ```bash
   npm run check && npm test
   ```

4. Push and open a pull request. The PR description has exactly three
   sections: **Summary**, **Why** and **What changed**.

5. CI runs `npm run check` and the tests on Node 22, 24 and 26. All checks
   must be green before merging.

## Testing conventions

- Tests live in `tests/`, with formatter tests in `tests/formatters/`.
- Reuse the factories in `tests/fixtures.js` (`makeFunction`, `makeRoute`,
  `fullyDocumentedJsdoc`, `mockApiData`) instead of hand-writing fixtures.
- Unit tests silence `console.log/warn/error` with
  `vi.spyOn(...).mockImplementation(() => {})` and restore them in
  `afterEach`.
- Integration tests write into `tests/.tmp-*` or `os.tmpdir()` directories and
  clean up after themselves. They read the real files in `examples/`.
- Vitest loads modules through its own loader, which accepts ES module syntax
  where plain Node would not. To test real Node behaviour, such as loading a
  config file in a CommonJS project, spawn `bin/api-docs-generator` in a child
  process, as `tests/config-loading.test.js` does.
- A bug fix comes with a test that fails without the fix.

## Code style

- Biome handles linting and formatting: single quotes, semicolons, trailing
  commas. `npm run check` also enforces import order.
- Every function has a JSDoc block describing its parameters and return value.
  Other comments are for things the code cannot say for itself.
- Keep the docs in `docs/` in step with behaviour. A decision with lasting
  trade-offs gets a new record in `docs/decisions/`.

## Releasing

Releases are maintainers-only:

1. Bump `version` in `package.json` and date the entry in `CHANGELOG.md`, in a
   pull request.
2. After it merges, create a GitHub release with the tag `v<version>`.
3. The `publish.yml` workflow checks that the tag matches `package.json`, runs
   `npm run check` and the tests, and publishes to npm through trusted
   publishing (OIDC) with provenance. No npm token is stored in the
   repository.
