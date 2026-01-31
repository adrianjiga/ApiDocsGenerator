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

app.get('/users/:id', (req, res) => {
  const user = getUserById(req.params.id);
  res.json(user);
});

app.post('/users', (req, res) => {
  res.json({ created: true, id: 'new-id' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.put('/users/:id', (req, res) => {
  res.json({ updated: true, id: req.params.id });
});

app.delete('/users/:id', (req, res) => {
  res.json({ deleted: true, id: req.params.id });
});

export default { app, sum, getUserById, greet };
