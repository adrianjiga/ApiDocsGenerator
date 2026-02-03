import fs from 'fs/promises';
import path from 'path';
import { parse } from 'comment-parser';
import * as espree from 'espree';
import { getParamName, DEFAULT_EXCLUDE_PATTERN } from './utils.js';

/**
 * Parse JSDoc comments from source code
 * @param {string} sourceCode - JavaScript/TypeScript source code
 * @returns {Array} Array of parsed JSDoc objects
 */
function parseJSDoc(sourceCode) {
  const comments = [];

  try {
    // Use regex to find JSDoc comments in the source code
    const jsdocRegex = /\/\*\*\s*([\s\S]*?)\*\//g;
    let match;

    while ((match = jsdocRegex.exec(sourceCode)) !== null) {
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
function handleFunctionDeclaration(node, functions) {
  const params = node.params.map((p) => getParamName(p));
  functions.push({
    type: 'function',
    name: node.id?.name || 'anonymous',
    params,
    line: node.loc?.start.line || 0,
    nodeType: node.type,
  });
}

/**
 * Handle a VariableDeclarator node whose init is an ArrowFunctionExpression or FunctionExpression
 * @param {Object} node - AST VariableDeclarator node
 * @param {Array} functions - Accumulator array for extracted function metadata
 */
function handleFunctionExpression(node, functions) {
  const params = node.init.params.map((p) => getParamName(p));
  functions.push({
    type: 'function',
    name: node.id?.name || 'anonymous',
    params,
    line: node.loc?.start.line || 0,
    nodeType: node.init.type,
  });
}

/**
 * Handle a CallExpression node and push route metadata if it matches an HTTP method
 * @param {Object} node - AST CallExpression node
 * @param {Array} functions - Accumulator array for extracted function/route metadata
 */
function handleRouteExpression(node, functions) {
  const methodName = node.callee.property.name;
  if (!HTTP_METHODS.includes(methodName)) return;

  const method = methodName.toUpperCase();
  const pathArg = node.arguments[0];
  const routePath = pathArg?.value || '';

  if (routePath) {
    functions.push({
      type: 'route',
      method,
      path: routePath,
      line: node.loc?.start.line || 0,
      params: extractRouteParams(routePath),
    });
  }
}

/**
 * Extract function information from AST
 * @param {string} sourceCode - JavaScript/TypeScript source code
 * @returns {Array} Array of function metadata objects
 */
function extractFunctions(sourceCode) {
  const functions = [];

  try {
    const ast = espree.parse(sourceCode, {
      ecmaVersion: 2022,
      sourceType: 'module',
      range: true,
      loc: true,
    });

    const walk = (node, visited = new Set()) => {
      if (!node || typeof node !== 'object' || visited.has(node)) return;
      visited.add(node);

      if (node.type === 'FunctionDeclaration') {
        handleFunctionDeclaration(node, functions);
      }

      if (
        node.type === 'VariableDeclarator' &&
        (node.init?.type === 'ArrowFunctionExpression' ||
          node.init?.type === 'FunctionExpression')
      ) {
        handleFunctionExpression(node, functions);
      }

      if (node.type === 'CallExpression' && node.callee?.property) {
        handleRouteExpression(node, functions);
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

/**
 * Parse a file and extract all metadata
 * @param {string} filePath - Path to the file
 * @returns {Object} Metadata object with functions, routes, and JSDoc
 */
async function parseFile(filePath) {
  const sourceCode = await fs.readFile(filePath, 'utf8');
  const fileName = path.basename(filePath);
  const jsdocs = parseJSDoc(sourceCode);
  const functions = extractFunctions(sourceCode);
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

      api.functions.push({
        name: fn.name,
        params: fn.params,
        line: fn.line,
        jsdoc: jsdoc?.parsed || null,
        description: description,
      });
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

/**
 * Recursively scan directory for JS/TS files
 * @param {string} dir - Directory path
 * @param {string} excludePattern - Glob pattern to exclude
 * @returns {Array} Array of file paths
 */
async function scanDirectory(dir, excludePattern = DEFAULT_EXCLUDE_PATTERN) {
  const files = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const subdirPromises = [];

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!new RegExp(excludePattern).test(fullPath)) {
          subdirPromises.push(scanDirectory(fullPath, excludePattern));
        }
      } else if (entry.isFile() && /\.(js|ts|jsx|tsx)$/.test(entry.name)) {
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
        return await parseFile(file);
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
