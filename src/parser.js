import fs from 'node:fs/promises';
import path from 'node:path';
import { parseSource } from './parser/ast.js';
import { collectItems } from './parser/items.js';
import { collectJSDoc, matchJSDocToItems } from './parser/jsdoc.js';
import { scanDirectory } from './parser/scan.js';
import { DEFAULT_EXCLUDE_PATTERN } from './utils.js';

/**
 * Escape a string so it matches literally inside a regular expression
 * @param {string} text - Text to escape
 * @returns {string} Regex-safe text
 */
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
      `Warning: Skipping ${filePath} (${(stat.size / 1024).toFixed(0)} KB) — exceeds 1 MB limit. To skip it without this warning, add ${escapeRegex(path.basename(filePath))} to excludePattern.`,
    );
    return null;
  }

  const sourceCode = await fs.readFile(filePath, 'utf8');
  const fileName = path.basename(filePath);
  const ast = parseSource(sourceCode, filePath);
  const jsdocs = ast ? collectJSDoc(ast) : [];
  const functions = ast
    ? collectItems(ast, sourceCode, config.routeServers)
    : [];
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
        paramDetails: fn.paramDetails,
        ...(fn.returnType && { returnType: fn.returnType }),
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

/**
 * Parse all files in a directory
 * @param {string} dir - Directory path
 * @param {Object} [config] - Configuration; reads excludePattern and routeServers
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

export { extractFunctions } from './parser/items.js';
export { matchJSDocToItems, parseJSDoc } from './parser/jsdoc.js';
export { compileExcludeRegex, scanDirectory } from './parser/scan.js';
export { parseDirectory, parseFile };
