# 0006 — Require Node.js 22.12 or newer

**Status**: Accepted

## Context

`engines` once said `>=18`, then `>=20`. Neither held up:

- `commander` 14 requires Node 20, so 18 was never supported.
- Node 20 reached end-of-life in April 2026.
- vitest 5 requires `^22.12.0 || ^24.0.0 || >=26.0.0`, so the test suite cannot
  run on Node 20. Supporting 20 meant a separate CI job that installed runtime
  dependencies only and smoke-tested the CLI, without the tests.

## Decision

Set `engines.node` to `>=22.12.0`. CI runs `npm run check` and the full test
suite on Node 22, 24 and 26. The publish workflow runs on Node 24 with npm
pinned to 11.21.2, which supports OIDC trusted publishing.

## Consequences

- The minimum matches the test runner's, so every supported Node version is
  tested.
- Users still on Node 20 see an engines warning from npm; the CLI may still run
  but is not tested there.
- When a Node line reaches end-of-life, raise the minimum and drop it from the
  matrix together.
