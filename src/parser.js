import fs from 'fs/promises';
import path from 'path';
import { parse } from 'comment-parser';
import { parse as tsParse } from '@typescript-eslint/typescript-estree';
import { getParamName, DEFAULT_EXCLUDE_PATTERN } from './utils.js';

const JSDOC_REGEX = /\/\*\*\s*([\s\S]*?)\*\//g;

const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch'];

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
 * Parse the text of a single JSDoc block
 * @param {string} raw - Comment text between the opening `/*` and closing `*\/`
 * @param {number} startLine - Line the comment starts on
 * @param {number} endLine - Line the comment ends on
 * @returns {Object|null} Parsed JSDoc object, or null if it has no content
 */
function toJSDoc(raw, startLine, endLine) {
  try {
    const parsed = parse('/*' + raw + '*/');
    if (parsed && parsed.length > 0) {
      return {
        raw,
        parsed: parsed[0],
        loc: {
          start: { line: startLine, column: 0 },
          end: { line: endLine, column: 0 },
        },
      };
    }
  } catch (parseErr) {
    console.warn(
      `Warning: Failed to parse JSDoc at line ${startLine}: ${parseErr.message}`,
    );
  }
  return null;
}

/**
 * Find the line of the first code token starting at or after an offset
 * @param {Array} tokens - Tokens sorted by position
 * @param {number} offset - Character offset
 * @returns {number|null} Line number, or null when no token follows
 */
function nextTokenLine(tokens, offset) {
  let lo = 0;
  let hi = tokens.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (tokens[mid].range[0] < offset) lo = mid + 1;
    else hi = mid;
  }
  return tokens[lo] ? tokens[lo].loc.start.line : null;
}

/**
 * Collect JSDoc blocks from a parsed AST
 * @param {Object} ast - AST produced by parseSource
 * @returns {Array} Parsed JSDoc objects, each with the line of the code that follows it
 */
function collectJSDoc(ast) {
  const comments = [];
  const tokens = ast.tokens || [];

  for (const comment of ast.comments || []) {
    if (comment.type !== 'Block' || !comment.value.startsWith('*')) continue;
    const jsdoc = toJSDoc(
      comment.value,
      comment.loc.start.line,
      comment.loc.end.line,
    );
    if (jsdoc) {
      jsdoc.nextLine = nextTokenLine(tokens, comment.range[1]);
      comments.push(jsdoc);
    }
  }

  return comments;
}

/**
 * Locate JSDoc blocks with a regex, for source that fails to parse
 * @param {string} sourceCode - JavaScript/TypeScript source code
 * @returns {Array} Parsed JSDoc objects
 */
function scanJSDocText(sourceCode) {
  const comments = [];
  JSDOC_REGEX.lastIndex = 0;
  let match;

  while ((match = JSDOC_REGEX.exec(sourceCode)) !== null) {
    const startLine = sourceCode.substring(0, match.index).split('\n').length;
    const endLine = startLine + match[0].split('\n').length - 1;
    const jsdoc = toJSDoc(match[1], startLine, endLine);
    if (jsdoc) comments.push(jsdoc);
  }

  return comments;
}

/**
 * Parse JSDoc comments from source code.
 * Comments are taken from the tokenizer so that JSDoc-shaped text inside
 * string or template literals is never mistaken for documentation;
 * regex-based extraction is kept only as a fallback for source that fails to
 * parse (e.g. fragments).
 * @param {string} sourceCode - JavaScript/TypeScript source code
 * @returns {Array} Array of parsed JSDoc objects
 */
function parseJSDoc(sourceCode) {
  const ast = parseSource(sourceCode);
  return ast ? collectJSDoc(ast) : scanJSDocText(sourceCode);
}

/**
 * Push function metadata for a function node
 * @param {Array} functions - Accumulator array for extracted function metadata
 * @param {Object} fnNode - Function AST node (declaration, expression or arrow)
 * @param {Object} info - Name, line, export flag and optional class details
 */
function pushFunction(functions, fnNode, info) {
  const item = {
    type: 'function',
    name: info.name,
    params: fnNode.params.map((p) => getParamName(p)),
    line: info.line,
    nodeType: info.nodeType || fnNode.type,
    async: !!fnNode.async,
    generator: !!fnNode.generator,
    exported: !!info.exported,
  };
  if (info.className) {
    item.className = info.className;
    item.static = !!info.static;
    item.methodKind = info.methodKind || 'method';
  }
  functions.push(item);
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
 * Extract function-valued properties of an object literal
 * @param {Object} objectNode - ObjectExpression node
 * @param {Array} functions - Accumulator array for extracted function metadata
 * @param {Object} options - Optional name prefix and export flag
 */
function handleObjectMethods(objectNode, functions, { prefix, exported }) {
  for (const prop of objectNode.properties) {
    if (prop.type !== 'Property' || !FUNCTION_TYPES.includes(prop.value?.type))
      continue;
    const key = propertyKey(prop);
    if (!key) continue;
    pushFunction(functions, prop.value, {
      name: prefix ? `${prefix}.${key}` : key,
      line: prop.loc?.start.line || 0,
      exported,
    });
  }
}

/**
 * Handle assignments of functions to CommonJS exports or class prototypes
 * @param {Object} node - AssignmentExpression node
 * @param {Array} functions - Accumulator array for extracted function metadata
 */
function handleAssignment(node, functions) {
  const target = memberPath(node.left);
  if (!target || target.length < 2) return;

  const value = node.right;
  const line = node.loc?.start.line || 0;
  const depth = commonJsExportDepth(target);

  if (depth >= 0) {
    const rest = target.slice(depth);
    if (rest.length === 0 && value.type === 'ObjectExpression') {
      handleObjectMethods(value, functions, { exported: true });
      return;
    }
    if (rest.length > 1 || !FUNCTION_TYPES.includes(value.type)) return;
    pushFunction(functions, value, {
      name: rest[0] || value.id?.name || 'default',
      line,
      exported: true,
    });
    return;
  }

  if (
    target.length === 3 &&
    target[1] === 'prototype' &&
    FUNCTION_TYPES.includes(value.type)
  ) {
    pushFunction(functions, value, {
      name: target[2],
      line,
      className: target[0],
    });
  }
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
 */
function pushRoute(functions, methodName, routePath, line) {
  if (typeof routePath !== 'string' || !routePath.startsWith('/')) return;
  functions.push({
    type: 'route',
    method: methodName.toUpperCase(),
    path: routePath,
    line,
    params: extractRouteParams(routePath),
  });
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

  const routePath = (props.get('url') || props.get('path'))?.value;
  const methodNode = props.get('method');
  const methods =
    methodNode?.type === 'ArrayExpression'
      ? methodNode.elements.map((el) => el?.value)
      : [methodNode?.value];

  for (const method of methods) {
    if (typeof method !== 'string') continue;
    const methodName = method.toLowerCase();
    if (HTTP_METHODS.includes(methodName)) {
      pushRoute(functions, methodName, routePath, node.loc?.start.line || 0);
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
      chainRoot.arguments[0]?.value,
      node.callee.property.loc?.start.line || 0,
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
    node.arguments[0]?.value,
    node.loc?.start.line || 0,
  );
}

/**
 * Handle a ClassDeclaration or ClassExpression node and extract its methods
 * @param {Object} node - AST ClassDeclaration or ClassExpression node
 * @param {Array} functions - Accumulator array for extracted function metadata
 * @param {boolean} exported - Whether the class is exported
 * @param {string} [className] - Name to use when the class itself is anonymous
 */
function handleClassDeclaration(node, functions, exported, className) {
  if (!node.body?.body) return;
  const name = node.id?.name || className || 'anonymous';

  for (const member of node.body.body) {
    if (
      member.type !== 'MethodDefinition' &&
      member.type !== 'TSAbstractMethodDefinition'
    )
      continue;
    if (!member.value) continue;

    pushFunction(functions, member.value, {
      name: member.key?.name || member.key?.value || 'anonymous',
      line: member.loc?.start.line || 0,
      nodeType: 'MethodDefinition',
      exported,
      className: name,
      static: member.static,
      methodKind: member.kind || 'method',
    });
  }
}

/**
 * Visit every node of an AST (excluding parent links) depth-first
 * @param {Object} root - AST root
 * @param {Function} visit - Called with each node
 */
function traverse(root, visit) {
  const visited = new Set();
  const walk = (node) => {
    if (!node || typeof node !== 'object' || visited.has(node)) return;
    visited.add(node);
    if (typeof node.type === 'string') visit(node);
    for (const key in node) {
      if (key === 'parent' || key === 'loc' || key === 'range') continue;
      const child = node[key];
      if (Array.isArray(child)) child.forEach(walk);
      else if (child && typeof child === 'object') walk(child);
    }
  };
  walk(root);
}

/**
 * Collect exported declaration nodes and exported local names
 * @param {Object} ast - Program AST
 * @returns {{declarations: Set<Object>, names: Set<string>}} Export information
 */
function collectExports(ast) {
  const declarations = new Set();
  const names = new Set();

  const addValueName = (value) => {
    if (value?.type === 'Identifier') names.add(value.name);
  };

  for (const node of ast.body || []) {
    if (
      (node.type === 'ExportNamedDeclaration' ||
        node.type === 'ExportDefaultDeclaration') &&
      node.declaration
    ) {
      declarations.add(node.declaration);
      node.declaration.declarations?.forEach((d) => declarations.add(d));
      addValueName(node.declaration);
    }
    if (node.type === 'ExportNamedDeclaration' && !node.source) {
      node.specifiers?.forEach((s) => addValueName(s.local));
    }
    const expr = node.type === 'ExpressionStatement' && node.expression;
    if (expr?.type === 'AssignmentExpression') {
      const target = memberPath(expr.left);
      if (target && commonJsExportDepth(target) >= 0) {
        addValueName(expr.right);
        if (expr.right.type === 'ObjectExpression') {
          expr.right.properties.forEach((p) => addValueName(p.value));
        }
      }
    }
  }

  return { declarations, names };
}

/**
 * Collect functions, class methods and routes from a parsed AST
 * @param {Object} ast - Program AST
 * @param {string[]} [routeServers] - Optional list of allowed server identifiers
 * @returns {Array} Array of function and route metadata objects
 */
function collectItems(ast, routeServers) {
  const functions = [];
  const exports = collectExports(ast);
  const isExported = (node, name) =>
    exports.declarations.has(node) || (!!name && exports.names.has(name));

  traverse(ast, (node) => {
    switch (node.type) {
      case 'FunctionDeclaration':
        pushFunction(functions, node, {
          name: node.id?.name || 'anonymous',
          line: node.loc?.start.line || 0,
          exported: isExported(node, node.id?.name),
        });
        break;
      case 'ClassDeclaration':
        handleClassDeclaration(
          node,
          functions,
          isExported(node, node.id?.name),
        );
        break;
      case 'VariableDeclarator': {
        const name = node.id?.type === 'Identifier' ? node.id.name : undefined;
        const exported = isExported(node, name);
        if (FUNCTION_TYPES.includes(node.init?.type)) {
          pushFunction(functions, node.init, {
            name: name || 'anonymous',
            line: node.loc?.start.line || 0,
            exported,
          });
        } else if (node.init?.type === 'ClassExpression') {
          handleClassDeclaration(node.init, functions, exported, name);
        } else if (node.init?.type === 'ObjectExpression' && name) {
          handleObjectMethods(node.init, functions, { prefix: name, exported });
        }
        break;
      }
      case 'ExportDefaultDeclaration':
        if (node.declaration?.type === 'ObjectExpression') {
          handleObjectMethods(node.declaration, functions, { exported: true });
        }
        break;
      case 'AssignmentExpression':
        if (node.operator === '=') handleAssignment(node, functions);
        break;
      case 'CallExpression':
        if (node.callee?.property) {
          handleRouteExpression(node, functions, routeServers);
        }
        break;
    }
  });

  return functions;
}

/**
 * Extract function information from AST
 * @param {string} sourceCode - JavaScript/TypeScript source code
 * @param {string[]} [routeServers] - Optional list of Express/Fastify instance
 *   identifiers to restrict route detection to.
 * @returns {Array} Array of function metadata objects
 */
function extractFunctions(sourceCode, routeServers) {
  const ast = parseSource(sourceCode);
  return ast ? collectItems(ast, routeServers) : [];
}

/**
 * Extract route parameters from path string
 * @param {string} routePath - Express route path
 * @returns {Array} Array of parameter names
 */
function extractRouteParams(routePath) {
  const paramRegex = /:(\w+)/g;
  const params = [];
  let match;

  while ((match = paramRegex.exec(routePath)) !== null) {
    params.push(match[1]);
  }

  return params;
}

/**
 * Match JSDoc comments to code items. A comment documents at most one item:
 * the nearest item starting within 2 lines below it. When the comment carries
 * `nextLine` (the line of the first code token after it), the item must also
 * start on that line, so a comment never documents code past an intervening
 * statement. If several comments target the same item, the closest one wins.
 * @param {Array} jsdocs - Array of parsed JSDoc objects
 * @param {Array} items - Array of function/route metadata objects
 * @returns {Object} Object with jsdocMap and itemKey function
 */
function matchJSDocToItems(jsdocs, items) {
  const jsdocMap = new Map();
  const claimedDistance = new Map();

  const itemKey = (fn) =>
    fn.type === 'route'
      ? `route:${fn.method}:${fn.path}:${fn.line}`
      : fn.className
        ? `fn:${fn.className}.${fn.name}:${fn.line}`
        : `fn:${fn.name}:${fn.line}`;

  for (const jsdoc of jsdocs) {
    if (!jsdoc.loc) continue;
    const endLine = jsdoc.loc.end.line;
    const hasNextLine = jsdoc.nextLine !== undefined;

    let best = null;
    let bestDistance = Infinity;
    for (const item of items) {
      const distance = item.line - endLine;
      if (distance < 0 || distance > 2) continue;
      if (hasNextLine && item.line !== jsdoc.nextLine) continue;
      if (distance < bestDistance) {
        best = item;
        bestDistance = distance;
      }
    }
    if (!best) continue;

    const key = itemKey(best);
    if (claimedDistance.has(key) && claimedDistance.get(key) <= bestDistance)
      continue;
    claimedDistance.set(key, bestDistance);
    jsdocMap.set(key, jsdoc);
  }

  return { jsdocMap, itemKey };
}

/** Maximum file size to parse (1 MB). Files larger than this are likely
 *  minified bundles or machine-generated code — skip them with a warning. */
const MAX_FILE_SIZE_BYTES = 1024 * 1024;

/**
 * Parse a file and extract all metadata
 * @param {string} filePath - Path to the file
 * @param {Object} [config] - Configuration affecting parsing (e.g. routeServers)
 * @returns {Object|null} Metadata object with functions, routes, and JSDoc, or null if skipped
 */
async function parseFile(filePath, config = {}) {
  const stat = await fs.stat(filePath);
  if (stat.size > MAX_FILE_SIZE_BYTES) {
    console.warn(
      `Warning: Skipping ${filePath} (${(stat.size / 1024).toFixed(0)} KB) — exceeds 1 MB limit. Add it to excludePattern to suppress this warning.`,
    );
    return null;
  }

  const sourceCode = await fs.readFile(filePath, 'utf8');
  const fileName = path.basename(filePath);
  const ast = parseSource(sourceCode, filePath);
  const jsdocs = ast ? collectJSDoc(ast) : [];
  const functions = ast ? collectItems(ast, config.routeServers) : [];
  const { jsdocMap, itemKey } = matchJSDocToItems(jsdocs, functions);

  const api = {
    file: filePath,
    fileName,
    functions: [],
    routes: [],
  };

  functions.forEach((fn) => {
    if (fn.type === 'function') {
      const jsdoc = jsdocMap.get(itemKey(fn));
      const description =
        jsdoc?.parsed?.description || 'No description provided';

      const item = {
        name: fn.name,
        params: fn.params,
        line: fn.line,
        jsdoc: jsdoc?.parsed || null,
        description: description,
        async: fn.async || false,
        generator: fn.generator || false,
        exported: fn.exported || false,
      };

      if (fn.className) {
        item.className = fn.className;
        item.static = fn.static || false;
        item.methodKind = fn.methodKind || 'method';
      }

      api.functions.push(item);
    } else if (fn.type === 'route') {
      const jsdoc = jsdocMap.get(itemKey(fn));
      api.routes.push({
        method: fn.method,
        path: fn.path,
        params: fn.params,
        line: fn.line,
        jsdoc: jsdoc?.parsed || null,
      });
    }
  });

  return api;
}

const JS_TS_FILE_REGEX = /\.(js|jsx|ts|tsx|mjs|cjs|mts|cts)$/;

const DECLARATION_FILE_REGEX = /\.d\.(ts|mts|cts)$/;

/**
 * Compile an exclude pattern into a segment-anchored regex. The pattern is
 * anchored to whole path segments so a term like "dist" only excludes a
 * "dist" directory, not similarly-named ones (e.g. "dist-tools").
 * Both `/` and `\` separators are accepted so the pattern also works on
 * Windows paths.
 * @param {string} excludePattern - Regex pattern to exclude directories
 * @returns {RegExp} Compiled exclude regex
 */
function compileExcludeRegex(excludePattern) {
  // Four backslashes in the template literal produce the regex source [\\/],
  // a character class matching either a backslash or a forward slash.
  return new RegExp(`(^|[\\\\/])(${excludePattern})([\\\\/]|$)`);
}

/**
 * Recursively scan directory for JS/TS files
 * @param {string} dir - Directory path
 * @param {string} excludePattern - Regex pattern to exclude directories
 * @returns {Array} Array of file paths
 */
async function scanDirectory(dir, excludePattern = DEFAULT_EXCLUDE_PATTERN) {
  let excludeRegex;
  try {
    excludeRegex = compileExcludeRegex(excludePattern);
  } catch {
    console.warn(
      `Warning: Invalid exclude pattern "${excludePattern}", falling back to default.`,
    );
    excludeRegex = compileExcludeRegex(DEFAULT_EXCLUDE_PATTERN);
  }
  return _scanDirectoryImpl(dir, excludeRegex, dir);
}

/**
 * Internal recursive implementation of directory scanning
 * @param {string} dir - Directory path
 * @param {RegExp} excludeRegex - Compiled regex for exclusion
 * @param {string} rootDir - Scan root; exclusion is tested against paths relative to it
 * @returns {Array} Array of file paths
 */
async function _scanDirectoryImpl(dir, excludeRegex, rootDir) {
  const files = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const subdirPromises = [];

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!excludeRegex.test(path.relative(rootDir, fullPath))) {
          subdirPromises.push(
            _scanDirectoryImpl(fullPath, excludeRegex, rootDir),
          );
        }
      } else if (
        entry.isFile() &&
        JS_TS_FILE_REGEX.test(entry.name) &&
        !DECLARATION_FILE_REGEX.test(entry.name)
      ) {
        files.push(fullPath);
      }
    }

    const subdirResults = await Promise.all(subdirPromises);
    for (const subFiles of subdirResults) {
      files.push(...subFiles);
    }
  } catch (err) {
    console.warn(`Warning: Could not read directory ${dir}: ${err.message}`);
  }

  return files;
}

/**
 * Parse all files in a directory
 * @param {string} dir - Directory path
 * @returns {Array} Array of file metadata objects
 */
async function parseDirectory(dir, config = {}) {
  const excludePattern = config.excludePattern || DEFAULT_EXCLUDE_PATTERN;
  const files = await scanDirectory(dir, excludePattern);

  // Bound the number of files read/parsed at once to avoid exhausting file
  // descriptors on large codebases.
  const MAX_CONCURRENCY = 10;
  const results = new Array(files.length);
  let nextIndex = 0;

  const parseNext = async () => {
    while (nextIndex < files.length) {
      const file = files[nextIndex];
      const slot = nextIndex;
      nextIndex += 1;
      try {
        const api = await parseFile(file, config);
        if (api) {
          api.relativePath = path.relative(dir, file).split(path.sep).join('/');
        }
        results[slot] = api;
      } catch (err) {
        console.warn(`Error parsing ${file}: ${err.message}`);
        results[slot] = null;
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(MAX_CONCURRENCY, files.length) }, () =>
      parseNext(),
    ),
  );

  return results.filter((r) => r !== null);
}

export {
  parseJSDoc,
  extractFunctions,
  matchJSDocToItems,
  parseFile,
  scanDirectory,
  parseDirectory,
  compileExcludeRegex,
};
