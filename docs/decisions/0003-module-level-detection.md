# 0003 — Only detect object methods and export assignments at module level

**Status**: Accepted (amended by **0003A**, below)

## Context

Detection was extended to object literal methods, CommonJS exports
(`exports.x = ...`, `module.exports = ...`), prototype methods
(`Foo.prototype.y = ...`) and export-by-name (`export { x }`,
`module.exports = { x }`). Applied everywhere in a file, these produced noise:

- option and callback objects inside function bodies
  (`const opts = { onError() {} }`) became undocumented "functions" and lowered
  coverage enough to fail `audit`;
- a nested function sharing its name with an exported one was marked exported;
- `exports.x = ...` inside a setup or factory function counted as API;
- object getters and setters were listed as functions, twice for a get/set
  pair.

## Decision

`collectExports` (`src/parser.js`) builds a set of module-level nodes: the
program's statements and the bodies of TypeScript `namespace` and
`declare module` blocks. Then:

- object literal methods are read only from module-level variable
  declarations, `export default { ... }` and `module.exports = { ... }`;
- assignment forms count only as module-level expression statements;
- export-by-name marks only module-level declarations as exported;
- object literal getters and setters are skipped.

## Consequences

- The audit reflects a module's public surface instead of every function value
  in the file.
- Code that builds its API inside a function (`function makeApi() { return {
  ... } }`) is not detected item by item; only `makeApi` is listed.
- Class getters and setters are still listed, since they are part of a class's
  documented surface.

---

## 0003A — Functions and classes too

**Status**: Accepted

### Context

0003 left function declarations, `const f = () => {}` and classes detected
anywhere in a file. Helpers declared inside a function body were reported as
undocumented API items, which is the same noise 0003 removed for object
literals and assignments.

### Decision

Function declarations, variables holding a function or class, and class
declarations are detected only at module level, using the same `moduleLevel`
set. Class fields that hold an arrow function or function expression
(`handle = () => {}`) are detected as methods of a module-level class.

### Consequences

- Every detected item is reachable from the module's top level, so the audit
  covers the module's surface and nothing inside function bodies.
- Factory-style code that defines its functions inside another function lists
  only the outer function.
