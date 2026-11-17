# 0002 — Match a JSDoc comment to the code that directly follows it

**Status**: Accepted

## Context

JSDoc used to be matched by proximity: every item took the closest `/** */`
comment ending within 2 lines above it. Nothing stopped one comment from being
used by several items, so:

- `/** doc */ function first() {}` followed by `function second() {}` on the
  next line counted both as documented;
- a class comment was credited to the class's first method.

Both inflated audit coverage, which is the number the `audit` CI gate relies on.

## Decision

`matchJSDocToItems` (`src/parser.js`) uses the tokenizer instead of line
distance alone:

- Each comment records `nextLine`, the line of the first code token after it.
- Each item has its own line plus optional `docLines`: the line of its
  `export` keyword, or the first line of a route chain (`app.route('/x')`).
- A comment documents the nearest item whose line or doc line equals
  `nextLine`, still within 2 lines of the comment's end.
- Routes declared by the same call (`app.route('/x').get(a).post(b)`, a Fastify
  `route({ method: [...] })`) share a `group` and are documented together.
- If several comments reach one item, the closest wins, and the later one on a
  tie, so a comment before `.get(...)` overrides the comment above the chain
  for that method.

Items are indexed by line, so matching is linear in comments plus items.

## Consequences

- One comment, one item (or one call's routes). Coverage numbers dropped for
  code that relied on the old sharing, which is the point.
- A statement between the comment and the item breaks the link, even within 2
  lines.
- Comments without `nextLine` (only produced by the exported `parseJSDoc`
  regex fallback, or by callers building them by hand) match the nearest item
  within 2 lines. A file that fails to parse yields no items at all.
