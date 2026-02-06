/**
 * Default regex pattern for directories to exclude when scanning
 * @type {string}
 */
const DEFAULT_EXCLUDE_PATTERN = 'node_modules|dist|build';

const NON_WORD_REGEX = /\W+/g;

/**
 * Sanitize filename for use as HTML id attribute
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string safe for HTML id
 */
function sanitizeHtmlId(str) {
  return str.replace(NON_WORD_REGEX, '-').toLowerCase();
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
  if (param.type === 'TSParameterProperty') return getParamName(param.parameter);
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
  getParamName,
  escapeHtml,
  calcPercentage,
  getParamTags,
  getReturnTags,
  cleanTagDescription,
};
