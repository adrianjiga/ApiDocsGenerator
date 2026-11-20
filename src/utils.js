import path from 'node:path';

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
  if (param.type === 'RestElement') return `...${getParamName(param.argument)}`;
  if (param.type === 'ObjectPattern') {
    if (param.properties && param.properties.length > 0) {
      const names = param.properties.map((prop) => {
        if (prop.type === 'RestElement')
          return `...${getParamName(prop.argument)}`;
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
 * Source text of a node with whitespace runs collapsed to one space
 * @param {Object} [node] - AST node with a `range`
 * @param {string} source - Source code the node was parsed from
 * @returns {string|undefined} Node text, or undefined without a node
 */
function nodeText(node, source) {
  if (!node?.range || typeof source !== 'string') return undefined;
  return source.slice(node.range[0], node.range[1]).replace(/\s+/g, ' ');
}

/**
 * Read a parameter's name, TypeScript type, optionality and default value
 * @param {Object} param - Parameter node from AST
 * @param {string} source - Source code the node was parsed from
 * @returns {{name: string, optional: boolean, type?: string, defaultValue?: string}} Parameter details
 */
function getParamDetails(param, source) {
  const inner = param.type === 'TSParameterProperty' ? param.parameter : param;
  const target = inner.type === 'AssignmentPattern' ? inner.left : inner;
  const details = {
    name: getParamName(param),
    optional: !!target.optional || inner.type === 'AssignmentPattern',
  };
  const type = nodeText(target.typeAnnotation?.typeAnnotation, source);
  if (type) details.type = type;
  if (inner.type === 'AssignmentPattern') {
    details.defaultValue = nodeText(inner.right, source);
  }
  return details;
}

/**
 * Whether a parameter node is TypeScript's `this` type declaration, which is
 * not a real parameter
 * @param {Object} param - Parameter node from AST
 * @returns {boolean} True for `this: Type`
 */
function isThisParam(param) {
  return param.type === 'Identifier' && param.name === 'this';
}

/**
 * Parameters to document for an item: its JSDoc @param tags, with the type,
 * optionality and default filled in from the TypeScript signature where the
 * tag leaves them out, followed by signature parameters no tag covers
 * @param {Object} item - Function or route with jsdoc and optional paramDetails
 * @returns {Array<{name: string, type?: string, description: string, optional: boolean, defaultValue?: string}>} Parameters in display order
 */
function describeParams(item) {
  const tags = getParamTags(item.jsdoc?.tags);
  const details = item.paramDetails ?? [];
  const plain = (name) => (name.startsWith('...') ? name.slice(3) : name);
  const byName = new Map(details.map((d) => [plain(d.name), d]));
  const topLevelTags = tags.filter((tag) => !tag.name?.includes('.'));
  const used = new Set();

  const described = tags.map((tag) => {
    const detail = !tag.name?.includes('.')
      ? (byName.get(tag.name) ??
        details.find((d, i) => /^[{[]/.test(d.name) && topLevelTags[i] === tag))
      : undefined;
    if (detail) used.add(detail);
    const defaultValue = tag.default ?? detail?.defaultValue;
    return {
      name: tag.name,
      ...((tag.type || detail?.type) && { type: tag.type || detail.type }),
      description: cleanTagDescription(tag.description),
      optional: !!tag.optional || !!detail?.optional,
      ...(defaultValue !== undefined && { defaultValue }),
    };
  });

  for (const detail of details) {
    if (used.has(detail)) continue;
    described.push({ ...detail, description: '' });
  }
  return described;
}

/**
 * Return values to document for an item: its JSDoc @returns tags, with the
 * type filled in from the TypeScript return type where a tag leaves it out,
 * or the TypeScript return type alone when there is no tag
 * @param {Object} item - Function with jsdoc and optional returnType
 * @returns {Array<{type?: string, description: string}>} Return values
 */
function describeReturns(item) {
  const tags = getReturnTags(item.jsdoc?.tags);
  if (tags.length === 0) {
    return item.returnType ? [{ type: item.returnType, description: '' }] : [];
  }
  return tags.map((tag) => ({
    ...((tag.type || item.returnType) && {
      type: tag.type || item.returnType,
    }),
    description: cleanTagDescription(tag.description),
  }));
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
 * Remove terminal control characters from text read out of source files
 * before printing it
 * @param {string} text - Text to sanitize
 * @returns {string} Text without control characters
 */
function stripControlChars(text) {
  return Array.from(String(text))
    .filter((ch) => {
      const code = ch.codePointAt(0);
      const isC0 = code < 0x20 && ch !== '\t' && ch !== '\n';
      const isC1 = code >= 0x7f && code <= 0x9f;
      return !isC0 && !isC1;
    })
    .join('');
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

/**
 * Coverage percentage `audit` requires when no --threshold is given
 * @type {number}
 */
const DEFAULT_COVERAGE_THRESHOLD = 80;

/**
 * Points below the threshold that still count as a warning rather than an error
 * @type {number}
 */
const COVERAGE_WARNING_BAND = 30;

/**
 * Classify a coverage percentage against the audit threshold: `good` at or
 * above it, `warning` within COVERAGE_WARNING_BAND points below it, `error`
 * otherwise. Shared by the terminal and dashboard reports.
 * @param {number} percentage - Coverage percentage
 * @param {number} [threshold] - Coverage threshold percentage
 * @returns {'good'|'warning'|'error'} Coverage level
 */
function coverageLevel(percentage, threshold = DEFAULT_COVERAGE_THRESHOLD) {
  if (percentage >= threshold) return 'good';
  if (percentage >= threshold - COVERAGE_WARNING_BAND) return 'warning';
  return 'error';
}

export {
  COVERAGE_WARNING_BAND,
  calcPercentage,
  cleanTagDescription,
  coverageLevel,
  DEFAULT_COVERAGE_THRESHOLD,
  DEFAULT_EXCLUDE_PATTERN,
  describeParams,
  describeReturns,
  escapeHtml,
  getParamDetails,
  getParamName,
  getParamTags,
  getReturnTags,
  githubSlug,
  isThisParam,
  nodeText,
  sanitizeHtmlId,
  stripControlChars,
  uniqueFileLabels,
};
