import fs from 'fs/promises';
import path from 'path';
import { parse } from 'comment-parser';
import { parse as tsParse } from '@typescript-eslint/typescript-estree';
import { getParamName, DEFAULT_EXCLUDE_PATTERN } from './utils.js';

const JSDOC_REGEX = /\/\*\*\s*([\s\S]*?)\*\//g;

/**
 * Parse JSDoc comments from source code
 * @param {string} sourceCode - JavaScript/TypeScript source code
 * @returns {Array} Array of parsed JSDoc objects
 */
function parseJSDoc(sourceCode) {
  const comments = [];

  try {
    // Use regex to find JSDoc comments in the source code
    JSDOC_REGEX.lastIndex = 0;
    let match;

    while ((match = JSDOC_REGEX.exec(sourceCode)) !== null) {
      // Calculate line number by counting newlines before this match
      const beforeMatch = sourceCode.substring(0, match.index);
      const lineNumber = beforeMatch.split('\n').length;

      try {
        const parsed = parse('/*' + match[1] + '*/');
        if (parsed && parsed.length > 0) {
          comments.push({
            raw: match[1],
            parsed: parsed[0],
            loc: {
              start: { line: lineNumber, column: 0 },
              end: {
                line: lineNumber + match[0].split('\n').length - 1,
                column: 0,
              },
            },
          });
        }
      } catch (parseErr) {
        // JSDoc parse error - continue
        console.warn(
          `Warning: Failed to parse JSDoc at line ${lineNumber}: ${parseErr.message}`,
        );
      }
    }
  } catch (err) {
    console.warn(`Warning: Failed to parse JSDoc: ${err.message}`);
  }

  return comments;
}

const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch'];

/**
 * Handle a FunctionDeclaration AST node and push its metadata
 * @param {Object} node - AST FunctionDeclaration node
 * @param {Array} functions - Accumulator array for extracted function metadata
 */
function handleFunctionDeclaration(node, functions, exported) {
  const params = node.params.map((p) => getParamName(p));
  functions.push({
    type: 'function',
    name: node.id?.name || 'anonymous',
    params,
    line: node.loc?.start.line || 0,
    nodeType: node.type,
    async: !!node.async,
    generator: !!node.generator,
    exported,
  });
}

/**
 * Handle a VariableDeclarator node whose init is an ArrowFunctionExpression or FunctionExpression
 * @param {Object} node - AST VariableDeclarator node
 * @param {Array} functions - Accumulator array for extracted function metadata
 */
function handleFunctionExpression(node, functions, exported) {
  const params = node.init.params.map((p) => getParamName(p));
  functions.push({
    type: 'function',
    name: node.id?.name || 'anonymous',
    params,
    line: node.loc?.start.line || 0,
    nodeType: node.init.type,
    async: !!node.init.async,
    generator: !!node.init.generator,
    exported,
  });
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
  if (!methodName || !HTTP_METHODS.includes(methodName)) return;

  if (routeServers && routeServers.length > 0) {
    const serverName = node.callee?.object?.name;
    if (!serverName || !routeServers.includes(serverName)) return;
  }

  const method = methodName.toUpperCase();
  const pathArg = node.arguments[0];
  const routePath = pathArg?.value || '';

  // Only treat the call as a route when the first argument is a server-relative
  // path (e.g. "/users/:id"). This avoids misreporting unrelated HTTP-client
  // calls such as `http.get('https://...')` as API routes.
  if (typeof routePath !== 'string' || !routePath.startsWith('/')) return;

  functions.push({
    type: 'route',
    method,
    path: routePath,
    line: node.loc?.start.line || 0,
    params: extractRouteParams(routePath),
  });
}

/**
 * Handle a ClassDeclaration or ClassExpression node and extract its methods
 * @param {Object} node - AST ClassDeclaration or ClassExpression node
 * @param {Array} functions - Accumulator array for extracted function metadata
 * @param {boolean} exported - Whether the class is exported
 */
function handleClassDeclaration(node, functions, exported) {
  const className = node.id?.name || 'anonymous';
  if (!node.body?.body) return;

  for (const member of node.body.body) {
    if (
      member.type !== 'MethodDefinition' &&
      member.type !== 'TSAbstractMethodDefinition'
    )
      continue;

    const methodName = member.key?.name || member.key?.value || 'anonymous';
    const fnNode = member.value;
    if (!fnNode) continue;

    const params = fnNode.params.map((p) => getParamName(p));
    functions.push({
      type: 'function',
      name: methodName,
      params,
      line: member.loc?.start.line || 0,
      nodeType: 'MethodDefinition',
      async: !!fnNode.async,
      generator: !!fnNode.generator,
      exported,
      className,
      static: !!member.static,
      methodKind: member.kind || 'method',
    });
  }
}

/**
 * Extract function information from AST
 * @param {string} sourceCode - JavaScript/TypeScript source code
 * @param {string[]} [routeServers] - Optional list of Express/Fastify instance
 *   identifiers to restrict route detection to.
 * @returns {Array} Array of function metadata objects
 */
function extractFunctions(sourceCode, routeServers) {
  const functions = [];

  try {
    const ast = tsParse(sourceCode, {
      loc: true,
      range: true,
      jsx: true,
      allowInvalidAST: true,
    });

    // Pre-pass: collect exported declaration nodes
    const exportedDeclarations = new Set();
    (function collectExports(node, visited = new Set()) {
      if (!node || typeof node !== 'object' || visited.has(node)) return;
      visited.add(node);
      if (
        (node.type === 'ExportNamedDeclaration' ||
          node.type === 'ExportDefaultDeclaration') &&
        node.declaration
      ) {
        exportedDeclarations.add(node.declaration);
        if (node.declaration.type === 'VariableDeclaration') {
          node.declaration.declarations?.forEach((d) =>
            exportedDeclarations.add(d),
          );
        }
      }
      for (const key in node) {
        if (key === 'parent') continue;
        const child = node[key];
        if (child && typeof child === 'object') {
          if (Array.isArray(child)) {
            child.forEach((c) => {
              if (c && typeof c === 'object') collectExports(c, visited);
            });
          } else {
            collectExports(child, visited);
          }
        }
      }
    })(ast);

    const walk = (node, visited = new Set()) => {
      if (!node || typeof node !== 'object' || visited.has(node)) return;
      visited.add(node);

      if (node.type === 'FunctionDeclaration') {
        handleFunctionDeclaration(
          node,
          functions,
          exportedDeclarations.has(node),
        );
      }

      if (
        node.type === 'VariableDeclarator' &&
        (node.init?.type === 'ArrowFunctionExpression' ||
          node.init?.type === 'FunctionExpression')
      ) {
        handleFunctionExpression(
          node,
          functions,
          exportedDeclarations.has(node),
        );
      }

      if (node.type === 'CallExpression' && node.callee?.property) {
        handleRouteExpression(node, functions, routeServers);
      }

      // Class declarations
      if (node.type === 'ClassDeclaration') {
        handleClassDeclaration(node, functions, exportedDeclarations.has(node));
      }

      // Class expressions assigned to variables
      if (
        node.type === 'VariableDeclarator' &&
        node.init?.type === 'ClassExpression'
      ) {
        const classNode = node.init;
        if (!classNode.id && node.id?.name) {
          classNode.id = { name: node.id.name };
        }
        handleClassDeclaration(
          classNode,
          functions,
          exportedDeclarations.has(node),
        );
      }

      // Walk child nodes
      for (const key in node) {
        if (key === 'parent') continue;
        const child = node[key];
        if (child !== null && typeof child === 'object') {
          if (Array.isArray(child)) {
            child.forEach((item) => {
              if (item && typeof item === 'object') {
                walk(item, visited);
              }
            });
          } else {
            walk(child, visited);
          }
        }
      }
    };

    walk(ast);
  } catch (err) {
    console.warn(`Warning: Failed to extract functions: ${err.message}`);
  }

  return functions;
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
 * Match JSDoc comments to code items by proximity
 * @param {Array} jsdocs - Array of parsed JSDoc objects
 * @param {Array} items - Array of function/route metadata objects
 * @returns {Object} Object with jsdocMap and itemKey function
 */
function matchJSDocToItems(jsdocs, items) {
  const jsdocMap = new Map();

  const itemKey = (fn) =>
    fn.type === 'route'
      ? `route:${fn.method}:${fn.path}:${fn.line}`
      : fn.className
        ? `fn:${fn.className}.${fn.name}:${fn.line}`
        : `fn:${fn.name}:${fn.line}`;

  items.forEach((fn) => {
    let closestJsdoc = null;
    let closestDistance = Infinity;

    jsdocs.forEach((jsdoc) => {
      if (jsdoc.loc) {
        const jsdocEndLine = jsdoc.loc.end.line;
        const distance =
          fn.line >= jsdocEndLine ? fn.line - jsdocEndLine : Infinity;

        if (distance < closestDistance && distance >= 0 && distance <= 2) {
          closestDistance = distance;
          closestJsdoc = jsdoc;
        }
      }
    });

    if (closestJsdoc) {
      jsdocMap.set(itemKey(fn), closestJsdoc);
    }
  });

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
  const jsdocs = parseJSDoc(sourceCode);
  const functions = extractFunctions(sourceCode, config.routeServers);
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

const JS_TS_FILE_REGEX = /\.(js|ts|jsx|tsx)$/;

/**
 * Recursively scan directory for JS/TS files
 * @param {string} dir - Directory path
 * @param {string} excludePattern - Regex pattern to exclude directories
 * @returns {Array} Array of file paths
 */
async function scanDirectory(dir, excludePattern = DEFAULT_EXCLUDE_PATTERN) {
  let excludeRegex;
  try {
    // Anchor the pattern to whole path segments so a term like "dist" only
    // excludes a "dist" directory, not similarly-named ones (e.g. "dist-tools").
    excludeRegex = new RegExp(`(^|/)(${excludePattern})($|/)`);
  } catch {
    console.warn(
      `Warning: Invalid exclude pattern "${excludePattern}", falling back to default.`,
    );
    excludeRegex = new RegExp(`(^|/)(${DEFAULT_EXCLUDE_PATTERN})($|/)`);
  }
  return _scanDirectoryImpl(dir, excludeRegex);
}

/**
 * Internal recursive implementation of directory scanning
 * @param {string} dir - Directory path
 * @param {RegExp} excludeRegex - Compiled regex for exclusion
 * @returns {Array} Array of file paths
 */
async function _scanDirectoryImpl(dir, excludeRegex) {
  const files = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const subdirPromises = [];

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!excludeRegex.test(fullPath)) {
          subdirPromises.push(_scanDirectoryImpl(fullPath, excludeRegex));
        }
      } else if (entry.isFile() && JS_TS_FILE_REGEX.test(entry.name)) {
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
  const results = await Promise.all(
    files.map(async (file) => {
      try {
        return await parseFile(file, config);
      } catch (err) {
        console.warn(`Error parsing ${file}: ${err.message}`);
        return null;
      }
    }),
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
};
