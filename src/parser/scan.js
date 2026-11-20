import fs from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_EXCLUDE_PATTERN } from '../utils.js';

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
 * @param {string} rootDir - Scan root; exclusion is tested against directory
 *   and file paths relative to it
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
        !DECLARATION_FILE_REGEX.test(entry.name) &&
        !excludeRegex.test(path.relative(rootDir, fullPath))
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

export { compileExcludeRegex, scanDirectory };
