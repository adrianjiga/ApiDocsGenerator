/**
 * Sanitize filename for use as HTML id attribute
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string safe for HTML id
 */
function sanitizeHtmlId(str) {
  return str.replace(/\W+/g, '-').toLowerCase();
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
        if (prop.type === 'RestElement') return '...' + getParamName(prop.argument);
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
  return 'arg';
}

/**
 * Truncate long strings with ellipsis
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated string
 */
function truncate(str, maxLength = 100) {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '...';
}

/**
 * Capitalize first letter of string
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Format timestamp for display
 * @param {Date} date - Date object
 * @returns {string} Formatted date string
 */
function formatTimestamp(date = new Date()) {
  return date.toISOString();
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

export { sanitizeHtmlId, getParamName, truncate, capitalize, formatTimestamp, escapeHtml };
