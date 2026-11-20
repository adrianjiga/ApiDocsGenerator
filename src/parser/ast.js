import { parse as tsParse } from '@typescript-eslint/typescript-estree';

const FUNCTION_TYPES = ['FunctionExpression', 'ArrowFunctionExpression'];

/**
 * Parse source code into an AST with comments and tokens attached
 * @param {string} sourceCode - JavaScript/TypeScript source code
 * @param {string} [filePath] - Source path, used to pick JSX/TypeScript mode from the extension
 * @returns {Object|null} AST, or null when the source cannot be parsed
 */
function parseSource(sourceCode, filePath) {
  try {
    return tsParse(sourceCode, {
      loc: true,
      range: true,
      jsx: true,
      allowInvalidAST: true,
      comment: true,
      tokens: true,
      ...(filePath && { filePath }),
    });
  } catch (err) {
    console.warn(
      `Warning: Failed to parse ${filePath || 'source code'}: ${err.message}`,
    );
    return null;
  }
}

/**
 * Read a non-computed property key as a string
 * @param {Object} prop - Property or MethodDefinition node
 * @returns {string|undefined} Key name
 */
function propertyKey(prop) {
  if (prop.computed) return undefined;
  const key = prop.key?.name ?? prop.key?.value;
  return typeof key === 'string' ? key : undefined;
}

/**
 * Flatten a non-computed member expression into its identifier names
 * @param {Object} node - Identifier or MemberExpression node
 * @returns {string[]|null} e.g. ['module', 'exports', 'foo'], or null if not a plain chain
 */
function memberPath(node) {
  if (node?.type === 'Identifier') return [node.name];
  if (
    node?.type === 'MemberExpression' &&
    !node.computed &&
    node.property.type === 'Identifier'
  ) {
    const base = memberPath(node.object);
    return base && [...base, node.property.name];
  }
  return null;
}

/**
 * Value of a string literal, or of a template literal without expressions
 * @param {Object} [node] - AST node
 * @returns {string|undefined} The string, or undefined for any other node
 */
function staticString(node) {
  if (node?.type === 'Literal' && typeof node.value === 'string') {
    return node.value;
  }
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? undefined;
  }
  return undefined;
}

const SKIPPED_AST_KEYS = new Set([
  'parent',
  'loc',
  'range',
  'tokens',
  'comments',
]);

/**
 * Visit every syntax node of an AST depth-first, skipping parent links and
 * the program's token and comment lists
 * @param {Object} root - AST root
 * @param {Function} visit - Called with each node
 * @returns {void}
 */
function traverse(root, visit) {
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (typeof node.type === 'string') visit(node);
    for (const key in node) {
      if (SKIPPED_AST_KEYS.has(key)) continue;
      const child = node[key];
      if (Array.isArray(child)) child.forEach(walk);
      else if (child && typeof child === 'object') walk(child);
    }
  };
  walk(root);
}

export {
  FUNCTION_TYPES,
  memberPath,
  parseSource,
  propertyKey,
  staticString,
  traverse,
};
