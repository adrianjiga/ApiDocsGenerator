import { propertyKey, staticString, traverse } from './ast.js';

const FUNCTION_NODE_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
  'TSDeclareFunction',
  'TSEmptyBodyFunctionExpression',
]);

const HTTP_METHODS = [
  'get',
  'post',
  'put',
  'delete',
  'patch',
  'head',
  'options',
  'all',
];

const BUILT_IN_CLASSES = new Set([
  'Map',
  'WeakMap',
  'Set',
  'WeakSet',
  'URL',
  'URLSearchParams',
  'Headers',
  'FormData',
  'Array',
  'Object',
  'Date',
  'RegExp',
  'Promise',
  'Error',
]);

const NON_SERVER_VALUE_TYPES = new Set([
  'Literal',
  'TemplateLiteral',
  'ObjectExpression',
  'ArrayExpression',
  'FunctionExpression',
  'ArrowFunctionExpression',
  'ClassExpression',
]);

/**
 * Whether a value cannot be an Express or Fastify server or router: a
 * literal, an object or array literal, a function or class, or `new` of a
 * JavaScript built-in such as `Map` or `URLSearchParams`. Calls such as
 * `express()`, `createApp()` or `require('./app')`, and `new` of any other
 * class, could return a server.
 * @param {Object} value - Value a name is bound to
 * @returns {boolean} True when the value is certainly not a server
 */
function isNonServerValue(value) {
  if (NON_SERVER_VALUE_TYPES.has(value.type)) return true;
  return (
    value.type === 'NewExpression' &&
    value.callee.type === 'Identifier' &&
    BUILT_IN_CLASSES.has(value.callee.name)
  );
}

/**
 * Names the file binds only to values that cannot be a server, such as
 * `cache` in `const cache = new Map()`. A name with any other binding in the
 * file (a call, an import, a function parameter) is left out, so routes on it
 * are still reported. Scopes are not tracked: bindings anywhere in the file
 * count.
 * @param {Object} ast - Program AST
 * @returns {Set<string>} Identifiers that are not servers
 */
function nonServerNames(ast) {
  const nonServer = new Set();
  const possibleServer = new Set();
  const bind = (name, value) => {
    if (value && isNonServerValue(value)) nonServer.add(name);
    else possibleServer.add(name);
  };

  traverse(ast, (node) => {
    if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier') {
      if (node.init) bind(node.id.name, node.init);
    } else if (
      node.type === 'AssignmentExpression' &&
      node.left.type === 'Identifier'
    ) {
      bind(node.left.name, node.right);
    } else if (FUNCTION_NODE_TYPES.has(node.type)) {
      for (const param of node.params) {
        const target = param.type === 'AssignmentPattern' ? param.left : param;
        if (target.type === 'Identifier') possibleServer.add(target.name);
      }
    } else if (node.type === 'ImportDeclaration') {
      for (const spec of node.specifiers) possibleServer.add(spec.local.name);
    }
  });

  for (const name of possibleServer) nonServer.delete(name);
  return nonServer;
}

/**
 * Build the check that decides whether a call's object is a route server
 * @param {Object} ast - Program AST
 * @param {string[]} [routeServers] - Configured server identifiers
 * @returns {function(Object): boolean} Called with the object a route method
 *   is called on (e.g. `app` in `app.get`)
 */
function routeServerFilter(ast, routeServers) {
  if (routeServers?.length) {
    return (node) =>
      node?.type === 'Identifier' && routeServers.includes(node.name);
  }
  const nonServers = nonServerNames(ast);
  return (node) => !(node?.type === 'Identifier' && nonServers.has(node.name));
}

/**
 * Push route metadata when the path is server-relative
 * @param {Array} functions - Accumulator array for extracted function/route metadata
 * @param {string} methodName - Lowercase HTTP method
 * @param {*} routePath - Candidate route path
 * @param {number} line - Line the route is declared on
 * @param {number} [group] - Id shared by routes declared in the same call
 * @param {number[]} [docLines] - Extra lines a preceding JSDoc may point at
 * @returns {void}
 */
function pushRoute(functions, methodName, routePath, line, group, docLines) {
  if (typeof routePath !== 'string' || !routePath.startsWith('/')) return;
  functions.push({
    type: 'route',
    method: methodName.toUpperCase(),
    path: routePath,
    line,
    params: extractRouteParams(routePath),
    ...(group !== undefined && { group }),
    ...(docLines && { docLines }),
  });
}

/**
 * Extract route parameters from path string
 * @param {string} routePath - Express route path
 * @returns {Array} Array of parameter names
 */
function extractRouteParams(routePath) {
  return Array.from(routePath.matchAll(/:(\w+)/g), (match) => match[1]);
}

/**
 * Find the `.route('/path')` call at the base of a chained route definition
 * such as `app.route('/users').get(h).post(h)`
 * @param {Object} node - Callee object of an HTTP method call
 * @returns {Object|null} The `.route()` CallExpression, or null
 */
function findRouteChainRoot(node) {
  let current = node;
  while (
    current?.type === 'CallExpression' &&
    current.callee?.type === 'MemberExpression'
  ) {
    const name = current.callee.property?.name;
    if (name === 'route') return current;
    if (!HTTP_METHODS.includes(name)) return null;
    current = current.callee.object;
  }
  return null;
}

/**
 * Handle a Fastify-style `server.route({ method, url, handler })` call
 * @param {Object} node - AST CallExpression node
 * @param {Array} functions - Accumulator array for extracted function/route metadata
 * @param {function(Object): boolean} isServer - Result of routeServerFilter
 * @returns {void}
 */
function handleRouteObject(node, functions, isServer) {
  const options = node.arguments[0];
  if (options?.type !== 'ObjectExpression') return;
  if (!isServer(node.callee.object)) return;

  const props = new Map();
  for (const prop of options.properties) {
    const key = prop.type === 'Property' ? propertyKey(prop) : undefined;
    if (key) props.set(key, prop.value);
  }

  const routePath = staticString(props.get('url') || props.get('path'));
  const methodNode = props.get('method');
  const methods =
    methodNode?.type === 'ArrayExpression'
      ? methodNode.elements.map(staticString)
      : [staticString(methodNode)];

  for (const method of methods) {
    if (typeof method !== 'string') continue;
    const methodName = method.toLowerCase();
    if (HTTP_METHODS.includes(methodName)) {
      pushRoute(
        functions,
        methodName,
        routePath,
        node.loc?.start.line || 0,
        node.range?.[0],
      );
    }
  }
}

/**
 * Handle a CallExpression node and push route metadata if it matches an HTTP method
 * @param {Object} node - AST CallExpression node
 * @param {Array} functions - Accumulator array for extracted function/route metadata
 * @param {function(Object): boolean} isServer - Result of routeServerFilter;
 *   decides whether the object the method is called on is a server
 * @returns {void}
 */
function handleRouteExpression(node, functions, isServer) {
  const methodName = node.callee?.property?.name;
  if (methodName === 'route') {
    handleRouteObject(node, functions, isServer);
    return;
  }
  if (!methodName || !HTTP_METHODS.includes(methodName)) return;

  const chainRoot = findRouteChainRoot(node.callee.object);
  if (chainRoot) {
    if (!isServer(chainRoot.callee.object)) return;
    pushRoute(
      functions,
      methodName,
      staticString(chainRoot.arguments[0]),
      node.callee.property.loc?.start.line || 0,
      chainRoot.range?.[0],
      chainRoot.loc ? [chainRoot.loc.start.line] : undefined,
    );
    return;
  }

  if (!isServer(node.callee.object)) return;

  // Only treat the call as a route when the first argument is a server-relative
  // path (e.g. "/users/:id"). This avoids misreporting unrelated HTTP-client
  // calls such as `http.get('https://...')` as API routes.
  pushRoute(
    functions,
    methodName,
    staticString(node.arguments[0]),
    node.loc?.start.line || 0,
  );
}

export { handleRouteExpression, routeServerFilter };
