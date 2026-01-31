import fs from 'fs';
import path from 'path';
import { parse } from 'comment-parser';
import * as espree from 'espree';

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
        const params = node.params.map(
          (p) =>
            p.name ||
            (p.type === 'RestElement' ? '...' + p.argument.name : 'arg'),
        );

        functions.push({
          type: 'function',
          name: node.id?.name || 'anonymous',
          params,
          line: node.loc?.start.line || 0,
          nodeType: node.type,
        });
      }

      if (
        node.type === 'VariableDeclarator' &&
        (node.init?.type === 'ArrowFunctionExpression' ||
          node.init?.type === 'FunctionExpression')
      ) {
        const params = node.init.params.map(
          (p) =>
            p.name ||
            (p.type === 'RestElement' ? '...' + p.argument.name : 'arg'),
        );

        functions.push({
          type: 'function',
          name: node.id?.name || 'anonymous',
          params,
          line: node.loc?.start.line || 0,
          nodeType: node.init.type,
        });
      }

      if (node.type === 'CallExpression' && node.callee?.property) {
        const methodName = node.callee.property.name;
        if (['get', 'post', 'put', 'delete', 'patch'].includes(methodName)) {
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
 * Parse a file and extract all metadata
 * @param {string} filePath - Path to the file
 * @returns {Object} Metadata object with functions, routes, and JSDoc
 */
function parseFile(filePath) {
  const sourceCode = fs.readFileSync(filePath, 'utf8');
  const fileName = path.basename(filePath);
  const jsdocs = parseJSDoc(sourceCode);
  const functions = extractFunctions(sourceCode);

  const api = {
    file: filePath,
    fileName,
    functions: [],
    routes: [],
  };

  // Create a better JSDoc matching using source line positions
  const jsdocMap = new Map();

  functions.forEach((fn) => {
    let closestJsdoc = null;
    let closestDistance = Infinity;

    // Find the JSDoc comment that appears closest to this function
    jsdocs.forEach((jsdoc) => {
      if (jsdoc.loc) {
        const jsdocEndLine = jsdoc.loc.end.line;
        // Calculate the distance - prefer JSDoc immediately before
        const distance =
          fn.line >= jsdocEndLine ? fn.line - jsdocEndLine : Infinity;

        // If this is closer and still reasonable, use it
        if (distance < closestDistance && distance >= 0 && distance <= 2) {
          closestDistance = distance;
          closestJsdoc = jsdoc;
        }
      }
    });

    if (closestJsdoc) {
      jsdocMap.set(`${fn.name}:${fn.line}`, closestJsdoc);
    }
  });

  functions.forEach((fn) => {
    if (fn.type === 'function') {
      const jsdoc = jsdocMap.get(`${fn.name}:${fn.line}`);
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
      api.routes.push({
        method: fn.method,
        path: fn.path,
        params: fn.params,
        line: fn.line,
        jsdoc: null,
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
function scanDirectory(dir, excludePattern = 'node_modules|dist|build') {
  const files = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    entries.forEach((entry) => {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!new RegExp(excludePattern).test(fullPath)) {
          files.push(...scanDirectory(fullPath, excludePattern));
        }
      } else if (entry.isFile() && /\.(js|ts|jsx|tsx)$/.test(entry.name)) {
        files.push(fullPath);
      }
    });
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
function parseDirectory(dir) {
  const files = scanDirectory(dir);
  const results = [];

  files.forEach((file) => {
    try {
      const metadata = parseFile(file);
      results.push(metadata);
    } catch (err) {
      console.warn(`Error parsing ${file}: ${err.message}`);
    }
  });

  return results;
}

export {
  parseJSDoc,
  extractFunctions,
  parseFile,
  scanDirectory,
  parseDirectory,
};
