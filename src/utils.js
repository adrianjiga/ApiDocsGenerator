import path from 'path';

/**
 * Default regex pattern for directories to exclude when scanning
 * @type {string}
 */
const DEFAULT_EXCLUDE_PATTERN =
  'node_modules|dist|build|\\.cache|coverage|\\.turbo|\\.nx|\\.next|\\.nuxt|out|\\.git';

const NON_WORD_REGEX = /\W+/g;

/**
 * Sanitize filename for use as HTML id attribute
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string safe for HTML id
 */
function sanitizeHtmlId(str) {
  return str
    .replace(NON_WORD_REGEX, '-')
    .toLowerCase()
    .replace(/^-+|-+$/g, '');
}

/**
 * Generate a heading anchor slug that matches GitHub's markdown anchor
 * algorithm. GitHub derives anchors from heading text by lowercasing, stripping
 * punctuation (but keeping `-` and `_`), and collapsing whitespace runs to a
 * single hyphen. The generic `sanitizeHtmlId` replaces every non-word char
 * with `-`, which diverges for dotted names (e.g. `app.js` → `app-js` vs
 * GitHub's `appjs`) and would produce broken table-of-contents links.
 * @param {string} str - Heading text to slugify
 * @returns {string} GitHub-compatible anchor slug
 */
function githubSlug(str) {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Extract variable/parameter name from complex destructuring
 * @param {Object} param - Parameter node from AST
 * @returns {string} Parameter name
 */
function getParamName(param) {
  if (typeof param === 'string') return param;
  if (param.name) return param.name;
  if (param.type === 'RestElement') return '...' + getParamName(param.argument);
  if (param.type === 'ObjectPattern') {
    if (param.properties && param.properties.length > 0) {
      const names = param.properties.map((prop) => {
        if (prop.type === 'RestElement')
          return '...' + getParamName(prop.argument);
        return prop.key?.name || 'arg';
      });
      return `{${names.join(', ')}}`;
    }
    return '{...}';
  }
  if (param.type === 'ArrayPattern') {
    if (param.elements && param.elements.length > 0) {
      const names = param.elements.map((el) => {
        if (el === null) return '_';
        return getParamName(el);
      });
      return `[${names.join(', ')}]`;
    }
    return '[...]';
  }
  if (param.type === 'TSParameterProperty')
    return getParamName(param.parameter);
  if (param.type === 'AssignmentPattern') return getParamName(param.left);
  return 'arg';
}

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Filter JSDoc tags to only @param tags
 * @param {Array} tags - Array of JSDoc tag objects
 * @returns {Array} Only the @param tags
 */
function getParamTags(tags) {
  return (tags || []).filter((t) => t.tag === 'param');
}

/**
 * Filter JSDoc tags to only @returns/@return tags
 * @param {Array} tags - Array of JSDoc tag objects
 * @returns {Array} Only the @returns or @return tags
 */
function getReturnTags(tags) {
  return (tags || []).filter((t) => t.tag === 'returns' || t.tag === 'return');
}

/**
 * Clean leading whitespace and dashes from a tag description
 * @param {string} description - Tag description string
 * @returns {string} Cleaned description
 */
function cleanTagDescription(description) {
  return (description || '').replace(/^[\s-]+/, '');
}

/**
 * Generate unique display labels for scanned files, disambiguating basename
 * collisions (e.g. `a/util.js` and `b/util.js`) by prefixing the directory
 * path relative to the common scan root. Labels are used as heading text and
 * anchor ids in markdown/HTML output, so they must be unique per file.
 * @param {Array} apiData - Array of parsed file metadata (each with fileName and file)
 * @returns {Map<string,string>} Map keyed by file path (file.file) to unique label
 */
function uniqueFileLabels(apiData) {
  const labels = new Map();
  if (!Array.isArray(apiData) || apiData.length === 0) return labels;

  const nameCounts = new Map();
  for (const file of apiData) {
    nameCounts.set(file.fileName, (nameCounts.get(file.fileName) || 0) + 1);
  }

  // Only files whose basename collides need deduplication.
  const colliding = apiData.filter((file) => nameCounts.get(file.fileName) > 1);
  if (colliding.length === 0) {
    for (const file of apiData) labels.set(file.file, file.fileName);
    return labels;
  }

  // Common ancestor directory shared by all colliding files, used to keep
  // the disambiguating prefix short and independent of absolute vs relative.
  const dirs = colliding.map((file) => path.dirname(file.file));
  let commonDir = dirs[0];
  for (const dir of dirs.slice(1)) {
    while (dir !== commonDir && !dir.startsWith(commonDir + path.sep)) {
      commonDir = path.dirname(commonDir);
      if (commonDir === path.dirname(commonDir)) break;
    }
  }

  for (const file of apiData) {
    let label = file.fileName;
    if (nameCounts.get(file.fileName) > 1) {
      const relativePath = path.relative(commonDir, file.file);
      label = relativePath.split(path.sep).join('/');
    }
    labels.set(file.file, label);
  }
  return labels;
}

/**
 * Calculate percentage with one decimal place
 * @param {number} part - The portion
 * @param {number} total - The total
 * @returns {number} Percentage rounded to one decimal place, or 0 if total is 0
 */
function calcPercentage(part, total) {
  if (total === 0) return 0;
  return parseFloat(((part / total) * 100).toFixed(1));
}

export {
  DEFAULT_EXCLUDE_PATTERN,
  sanitizeHtmlId,
  githubSlug,
  getParamName,
  escapeHtml,
  calcPercentage,
  getParamTags,
  getReturnTags,
  cleanTagDescription,
  uniqueFileLabels,
};
