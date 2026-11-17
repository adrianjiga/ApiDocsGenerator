# 0001 — Publish as a scoped package

**Status**: Accepted

## Context

The package was named `api-docs-generator` in `package.json`, but that name is
already taken on npm by an unrelated package (published at
`0.0.11-preview-1a`). A publish under the unscoped name would be rejected, and
the README's `npm install -g api-docs-generator` installed someone else's tool.

## Decision

Publish as `@adrianjiga/api-docs-generator`, starting at `0.1.0`, with
`publishConfig.access: "public"` so the scoped package is public by default.

The executable keeps its name: `bin` still maps `api-docs-generator` to
`bin/api-docs-generator`, and the tool still identifies itself as
`api-docs-generator` in generated output (`meta.tool` in `api.json`,
`x-generator` in `openapi.yaml`, the HTML footers).

## Consequences

- Install commands use the scope (`npm install -g
  @adrianjiga/api-docs-generator`, `npx @adrianjiga/api-docs-generator`); the
  command people type afterwards does not change.
- The scope is guaranteed to be ours, so future renames are not needed.
- `0.1.0` rather than `1.0.0` leaves room for breaking changes while detection
  is still being extended.
