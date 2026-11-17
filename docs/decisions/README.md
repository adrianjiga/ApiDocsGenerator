# Architecture Decision Records

Decisions here capture _why_ the codebase looks the way it does, so a future
change can weigh the original trade-off before unpicking it.

- [0001-scoped-package-name](0001-scoped-package-name.md) — publish as
  `@adrianjiga/api-docs-generator`; the command stays `api-docs-generator`.
- [0002-jsdoc-matching-by-next-token](0002-jsdoc-matching-by-next-token.md) —
  a comment documents the item that directly follows it, one item per comment,
  instead of the nearest item within 2 lines.
- [0003-module-level-detection](0003-module-level-detection.md) — object
  literal methods, export assignments and export-by-name only count at module
  level; object accessors are skipped (amended by **0003A**: functions and
  classes are module level only too, and class fields holding functions are
  detected).
- [0004-routes-do-not-require-returns](0004-routes-do-not-require-returns.md) —
  a route is documented with a description and its path parameters.
- [0005-typescript-6-not-7](0005-typescript-6-not-7.md) — stay on TypeScript
  `~6.0.3` until the parser supports TypeScript 7.
- [0006-node-22-minimum](0006-node-22-minimum.md) — require Node.js 22.12+ and
  test on 22, 24 and 26.
- [0007-biome-over-eslint-prettier](0007-biome-over-eslint-prettier.md) — one
  tool for linting, formatting and import order.
- [0008-relative-output-paths](0008-relative-output-paths.md) — generated files
  contain paths relative to the scanned directory, never absolute ones.
