/**
 * Shared test fixtures and helper factories used across test files.
 */

/**
 * Create a mock function object.
 * @param {string} name
 * @param {string[]} params
 * @param {Object|null} jsdoc
 * @returns {Object}
 */
export function makeFunction(name, params, jsdoc) {
  return {
    name,
    params,
    line: 1,
    jsdoc,
    description: jsdoc?.description || 'No description',
  };
}

/**
 * Create a mock route object.
 * @param {string} method
 * @param {string} routePath
 * @param {string[]} params
 * @param {Object|null} jsdoc
 * @returns {Object}
 */
export function makeRoute(method, routePath, params, jsdoc = null) {
  return { method, path: routePath, params, line: 1, jsdoc };
}

/**
 * Create a fully documented JSDoc object.
 * @param {string[]} params
 * @returns {Object}
 */
export function fullyDocumentedJsdoc(params) {
  return {
    description: 'A documented function',
    tags: [
      ...params.map((p) => ({
        tag: 'param',
        name: p,
        type: 'string',
        description: `The ${p}`,
      })),
      { tag: 'returns', type: 'string', description: 'result' },
    ],
  };
}

/**
 * Standard mock API data shared across formatter tests.
 * Contains one file with a documented function and a route.
 * @type {Array}
 */
export const mockApiData = [
  {
    file: '/src/app.js',
    fileName: 'app.js',
    functions: [
      {
        name: 'greet',
        params: ['name'],
        description: 'Greets a user',
        line: 10,
        jsdoc: {
          description: 'Greets a user',
          tags: [
            {
              tag: 'param',
              name: 'name',
              type: 'string',
              description: 'The name',
            },
            {
              tag: 'returns',
              type: 'string',
              description: 'Greeting message',
            },
          ],
        },
      },
    ],
    routes: [
      { method: 'GET', path: '/users/:id', params: ['id'], line: 20 },
    ],
  },
];
