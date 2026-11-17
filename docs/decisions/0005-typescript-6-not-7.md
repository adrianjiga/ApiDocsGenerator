# 0005 — Stay on TypeScript 6.0 until the parser supports 7

**Status**: Accepted

## Context

Source files are parsed with `@typescript-eslint/typescript-estree`, which
needs the `typescript` package at runtime, so `typescript` is a regular
dependency.

TypeScript 7 (the Go-native compiler) is the current `latest` on npm, but
`typescript-estree` 8.73 declares `typescript: >=4.8.4 <6.1.0`. Its TypeScript 7
support goes through a separate `@typescript/native` package and only covers
7.1 pre-releases. Tested directly:

- `npm install typescript@7.0.2 @typescript-eslint/typescript-estree@8.73.0`
  fails with `ERESOLVE`;
- forced with `--legacy-peer-deps`, `typescript` 7.0.2 exposes no JavaScript
  compiler API (`ts.createSourceFile` is `undefined`) and parsing throws
  `TypeError: Cannot read properties of undefined (reading 'Cjs')`.

## Decision

Depend on `typescript: "~6.0.3"`, the newest line inside the parser's range.
The tilde keeps npm from resolving 6.1 or later, which would fall outside that
range.

## Consequences

- Every scan works on a supported TypeScript version, and TypeScript 6 syntax
  parses.
- Users installing the package get their own copy of TypeScript 6 regardless
  of the version their project uses; the two do not interact.
- Moving to TypeScript 7 is a dependency bump plus a test run once
  `typescript-estree` releases support for a stable 7.x.
