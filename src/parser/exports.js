import { FUNCTION_TYPES, memberPath } from './ast.js';

/**
 * Number of leading segments that make a member path refer to CommonJS exports
 * @param {string[]} target - Member path from memberPath
 * @returns {number} 2 for module.exports, 1 for exports, -1 otherwise
 */
function commonJsExportDepth(target) {
  if (target[0] === 'module' && target[1] === 'exports') return 2;
  if (target[0] === 'exports') return 1;
  return -1;
}

/**
 * Statement lists of functions that run immediately at module load:
 * `(function () {})()`, `(() => {})()`, `!function () {}()`,
 * `(function () {}).call(this)`, plus function expressions passed as arguments
 * to such a call, as in the UMD pattern `(function (root, factory) {})(this,
 * function () { ... })`
 * @param {Object} expression - Expression of a top-level expression statement
 * @returns {Array<Array>} Statement lists to treat as module level
 */
function immediatelyInvokedBodies(expression) {
  const call =
    expression?.type === 'UnaryExpression' ? expression.argument : expression;
  if (call?.type !== 'CallExpression') return [];

  const callee =
    call.callee?.type === 'MemberExpression' &&
    ['call', 'apply'].includes(call.callee.property?.name)
      ? call.callee.object
      : call.callee;
  if (!FUNCTION_TYPES.includes(callee?.type)) return [];

  return [callee, ...call.arguments]
    .filter(
      (fn) =>
        FUNCTION_TYPES.includes(fn?.type) && fn.body?.type === 'BlockStatement',
    )
    .map((fn) => fn.body.body);
}

/**
 * Collect module-level declarations, exported declaration nodes and exported
 * local names. Besides the program body, these count as module level:
 * TypeScript namespace and `declare module` bodies, top-level blocks (`if`,
 * `try`, bare blocks, labels) and the bodies of immediately-invoked functions,
 * including function arguments passed to them (the UMD factory pattern).
 * @param {Object} ast - Program AST
 * @returns {{declarations: Set<Object>, names: Set<string>, moduleLevel: Set<Object>, exportLines: Map<Object, number>}} Export information
 */
function collectExports(ast) {
  const declarations = new Set();
  const exportLines = new Map();
  const names = new Set();
  const moduleLevel = new Set();

  const addValueName = (value) => {
    if (value?.type === 'Identifier') names.add(value.name);
  };

  const addModuleLevel = (decl) => {
    if (!decl) return;
    moduleLevel.add(decl);
    for (const d of decl.declarations ?? []) moduleLevel.add(d);
  };

  const scan = (statements) => {
    for (const node of statements) {
      const isExport =
        node.type === 'ExportNamedDeclaration' ||
        node.type === 'ExportDefaultDeclaration';
      const decl = isExport ? node.declaration : node;
      addModuleLevel(decl);

      if (isExport && node.declaration) {
        declarations.add(node.declaration);
        exportLines.set(node.declaration, node.loc?.start.line);
        for (const d of node.declaration.declarations ?? []) {
          declarations.add(d);
          exportLines.set(d, node.loc?.start.line);
        }
        addValueName(node.declaration);
      }
      if (node.type === 'ExportNamedDeclaration' && !node.source) {
        for (const s of node.specifiers ?? []) addValueName(s.local);
      }
      const expr = node.type === 'ExpressionStatement' && node.expression;
      if (expr) moduleLevel.add(expr);
      if (expr?.type === 'AssignmentExpression') {
        const target = memberPath(expr.left);
        if (target && commonJsExportDepth(target) >= 0) {
          addValueName(expr.right);
          if (expr.right.type === 'ObjectExpression') {
            for (const p of expr.right.properties) addValueName(p.value);
          }
        }
      }
      if (decl?.type === 'TSModuleDeclaration' && decl.body?.body) {
        scan(decl.body.body);
      }
      enterNested(node);
    }
  };

  const enterNested = (node) => {
    switch (node.type) {
      case 'BlockStatement':
        scan(node.body);
        break;
      case 'IfStatement':
        enterNested(node.consequent);
        if (node.alternate) enterNested(node.alternate);
        break;
      case 'TryStatement':
        scan(node.block.body);
        if (node.handler) scan(node.handler.body.body);
        if (node.finalizer) scan(node.finalizer.body);
        break;
      case 'LabeledStatement':
        enterNested(node.body);
        break;
      case 'ExpressionStatement':
        for (const body of immediatelyInvokedBodies(node.expression)) {
          scan(body);
        }
        break;
    }
  };

  scan(ast.body || []);
  return { declarations, names, moduleLevel, exportLines };
}

export { collectExports, commonJsExportDepth };
