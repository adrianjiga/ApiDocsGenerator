import { propertyKey, staticString, traverse } from './ast.js';

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

const SERVER_MODULES = new Set(['express', 'fastify']);

const DEFAULT_SERVER_FACTORIES = ['express', 'Router', 'fastify', 'Fastify'];

/**
 * Names bound to a module by `import` or `require()`, split into the module
 * itself (default and namespace imports, `const x = require('m')`) and its
 * named exports (`import { Router }`, `const { Router } = require('m')`)
 * @param {Object} node - ImportDeclaration or VariableDeclarator node
 * @returns {{module: string, local: string, imported?: string}[]} Bindings
 */
function moduleBindings(node) {
  if (node.type === 'ImportDeclaration') {
    return node.specifiers.map((spec) => ({
      module: node.source.value,
      local: spec.local.name,
      ...(spec.type === 'ImportSpecifier' && {
        imported: spec.imported.name ?? spec.imported.value,
      }),
    }));
  }
  const init = node.init;
  const isRequire =
    init?.type === 'CallExpression' &&
    init.callee.type === 'Identifier' &&
    init.callee.name === 'require';
  const module = isRequire && staticString(init.arguments[0]);
  if (!module) return [];
  if (node.id.type === 'Identifier') {
    return [{ module, local: node.id.name }];
  }
  if (node.id.type !== 'ObjectPattern') return [];
  return node.id.properties
    .filter((p) => p.type === 'Property' && p.value.type === 'Identifier')
    .map((p) => ({ module, local: p.value.name, imported: propertyKey(p) }));
}

/**
 * Identifiers a file assigns an Express or Fastify server or router to, such
 * as `app` in `const app = express()` or `router` in
 * `const router = express.Router()`. The factory names `express`, `Router`,
 * `fastify` and `Fastify` are always recognised, as are the local names the
 * `express` and `fastify` modules are imported or required under.
 * @param {Object} ast - Program AST
 * @returns {string[]} Server identifiers, empty when the file creates none
 */
function inferRouteServers(ast) {
  const factories = new Set(DEFAULT_SERVER_FACTORIES);
  const modules = new Set(['express']);
  const assignments = [];

  traverse(ast, (node) => {
    if (
      node.type === 'ImportDeclaration' ||
      node.type === 'VariableDeclarator'
    ) {
      for (const binding of moduleBindings(node)) {
        if (!SERVER_MODULES.has(binding.module)) continue;
        if (!binding.imported || binding.imported === 'default') {
          factories.add(binding.local);
          modules.add(binding.local);
        } else if (
          binding.imported === 'Router' ||
          binding.imported === 'fastify'
        ) {
          factories.add(binding.local);
        }
      }
    }
    if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier') {
      assignments.push([node.id.name, node.init]);
    } else if (
      node.type === 'AssignmentExpression' &&
      node.left.type === 'Identifier'
    ) {
      assignments.push([node.left.name, node.right]);
    }
  });

  const isFactoryCall = (value) => {
    const call = value?.type === 'AwaitExpression' ? value.argument : value;
    if (call?.type !== 'CallExpression' && call?.type !== 'NewExpression') {
      return false;
    }
    const callee = call.callee;
    if (callee.type === 'Identifier') return factories.has(callee.name);
    return (
      callee.type === 'MemberExpression' &&
      !callee.computed &&
      callee.object.type === 'Identifier' &&
      modules.has(callee.object.name) &&
      callee.property.name === 'Router'
    );
  };

  return [
    ...new Set(
      assignments.filter(([, value]) => isFactoryCall(value)).map(([n]) => n),
    ),
  ];
}

/**
 * Whether a route's server object passes the optional routeServers filter
 * @param {Object} serverNode - Callee object node (e.g. `app` in `app.get`)
 * @param {string[]} [routeServers] - Allowed server identifiers
 * @returns {boolean} True when the route should be reported
 */
function isAllowedServer(serverNode, routeServers) {
  if (!routeServers || routeServers.length === 0) return true;
  return (
    serverNode?.type === 'Identifier' && routeServers.includes(serverNode.name)
  );
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
 * @param {string[]} [routeServers] - Optional list of allowed server identifiers
 * @returns {void}
 */
function handleRouteObject(node, functions, routeServers) {
  const options = node.arguments[0];
  if (options?.type !== 'ObjectExpression') return;
  if (!isAllowedServer(node.callee.object, routeServers)) return;

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
 * @param {string[]} [routeServers] - Optional list of Express/Fastify instance
 *   identifiers (e.g. ['app', 'router']) to restrict route detection to. When
 *   omitted, any identifier callee with a server-relative path is treated as a
 *   route.
 * @returns {void}
 */
function handleRouteExpression(node, functions, routeServers) {
  const methodName = node.callee?.property?.name;
  if (methodName === 'route') {
    handleRouteObject(node, functions, routeServers);
    return;
  }
  if (!methodName || !HTTP_METHODS.includes(methodName)) return;

  const chainRoot = findRouteChainRoot(node.callee.object);
  if (chainRoot) {
    if (!isAllowedServer(chainRoot.callee.object, routeServers)) return;
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

  if (!isAllowedServer(node.callee.object, routeServers)) return;

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

export { handleRouteExpression, inferRouteServers };
