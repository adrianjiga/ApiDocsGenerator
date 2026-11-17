# 0004 — Routes do not need `@returns` to count as documented

**Status**: Accepted

## Context

Functions and routes shared one rule: a description, a `@param` for each
parameter, and a `@returns` tag. For an Express or Fastify handler that rule
does not fit. What a route sends back is its response, set through
`res.json(...)` or a reply object, not the handler's return value, so
`@returns` on a route comment is usually meaningless. Requiring it marked
well-described routes as partially documented.

## Decision

`checkRouteDocumentation` (`src/analyzer.js`) calls the shared check with
`requireReturns: false`. A route is fully documented when its comment has a
description and a `@param` for each path parameter (`:id` in `/users/:id`).
Functions keep requiring `@returns`; `@returns {void}`, `{undefined}` and
`{never}` satisfy it.

## Consequences

- An undocumented route's gap lists `description` and `params`, never
  `returns`.
- A route comment that does include `@returns` is still recorded
  (`existing.returns`), so nothing written is lost.
- Request bodies and query parameters are not checked; only path parameters
  are visible to the parser.
