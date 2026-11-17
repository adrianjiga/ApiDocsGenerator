# 0007 — Use Biome instead of ESLint and Prettier

**Status**: Accepted

## Context

Linting and formatting used ESLint (flat config with `@eslint/js` and
`globals`) and Prettier: four dev dependencies, three config files
(`eslint.config.js`, `.prettierrc`, `.prettierignore`) and two tools to keep in
step.

## Decision

Replace both with Biome (`@biomejs/biome`, pinned exactly). `biome.json` sets
only what differs from Biome's defaults:

- single quotes and space indentation, keeping the previous Prettier style
  (semicolons and trailing commas are Biome defaults);
- the recommended lint rules;
- `.gitignore` respected, `package-lock.json` excluded;
- no linting of `examples/`, which is sample input for the tool.

The npm scripts keep their names (`lint`, `lint:fix`, `format`,
`format:check`) and `check` runs `biome check`, which adds import ordering
(`organizeImports`). CI and the publish workflow run `npm run check`.

## Consequences

- One dev dependency and one config file for lint, format and import order.
- The JavaScript formatting did not change in the switch. Biome formats YAML
  with double quotes, so the workflow files changed quote style once.
- Biome's recommended rules are stricter than ESLint's were; the findings were
  fixed (`node:` import prefixes, `matchAll` over assignment-in-`while`,
  `for...of` over value-returning `forEach`) rather than disabled.
- `lint` and `format:check` alone do not check import order; run
  `npm run check` before pushing.
