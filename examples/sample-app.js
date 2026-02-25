import express from 'express';

const app = express();

/**
 * Calculate the sum of two numbers
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} Sum of a and b
 */
function sum(a, b) {
  return a + b;
}

/**
 * Get user by ID
 * @param {string} userId - The user ID
 * @returns {Object} User object with id and name
 */
function getUserById(userId) {
  return {
    id: userId,
    name: 'John Doe',
  };
}

/**
 * Format a greeting message
 * @param {string} name - User's name
 * @returns {string} Formatted greeting
 */
function greet(name) {
  return `Hello, ${name}!`;
}

/**
 * Get a single user by their ID
 * @param {string} id - The user ID from the URL path
 * @returns {Object} User object containing id and name
 */
app.get('/users/:id', (req, res) => {
  const user = getUserById(req.params.id);
  res.json(user);
});

/**
 * Create a new user
 * @param {Object} req.body - Request body containing user data
 * @returns {Object} Created user with the assigned id
 */
app.post('/users', (req, res) => {
  res.json({ created: true, id: 'new-id' });
});

/**
 * Health check endpoint — returns service status
 * @returns {Object} Status object with a status field
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

/**
 * Update an existing user by ID
 * @param {string} id - The user ID from the URL path
 * @returns {Object} Confirmation object with updated flag and id
 */
app.put('/users/:id', (req, res) => {
  res.json({ updated: true, id: req.params.id });
});

/**
 * Delete a user by ID
 * @param {string} id - The user ID from the URL path
 * @returns {Object} Confirmation object with deleted flag and id
 */
app.delete('/users/:id', (req, res) => {
  res.json({ deleted: true, id: req.params.id });
});

export default { app, sum, getUserById, greet };
