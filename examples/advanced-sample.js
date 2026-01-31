/**
 * Utility module with various helper functions
 */

/**
 * Parse JSON with error handling
 * @param {string} jsonStr - JSON string to parse
 * @returns {Object|null} Parsed object or null if parsing fails
 */
function safeParseJSON(jsonStr) {
  try {
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error('Failed to parse JSON:', err);
    return null;
  }
}

/**
 * Format currency values for display
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (USD, EUR, etc)
 * @returns {string} Formatted currency string
 */
function formatCurrency(amount, currency = 'USD') {
  return `${currency} ${amount.toFixed(2)}`;
}

/**
 * Validate email address
 * @param {string} email - Email address to validate
 * @returns {boolean} True if valid email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export default {
  safeParseJSON,
  formatCurrency,
  isValidEmail,
};
