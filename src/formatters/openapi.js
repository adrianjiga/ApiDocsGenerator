import yaml from 'js-yaml';

/**
 * Default success response code per HTTP method.
 * POST → 201 Created, DELETE → 204 No Content, others → 200 OK.
 * @type {Object.<string, number>}
 */
const METHOD_SUCCESS_CODE = {
  post: 201,
  delete: 204,
};

/**
 * Convert an Express-style path to OpenAPI path syntax.
 * @param {string} expressPath - e.g. /users/:id
 * @returns {string} e.g. /users/{id}
 */
function convertPath(expressPath) {
  return expressPath.replace(/:(\w+)/g, '{$1}');
}

/**
 * Derive an operationId from method and path.
 * @param {string} method - HTTP method (lowercase)
 * @param {string} openApiPath - e.g. /users/{id}
 * @returns {string} e.g. get-users-id
 */
function deriveOperationId(method, openApiPath) {
  const slug = openApiPath
    .replace(/[{}]/g, '')
    .replace(/\//g, '-')
    .replace(/^-/, '')
    .replace(/-$/, '');
  return `${method}-${slug}`;
}

/**
 * Extract path parameter names from an OpenAPI path.
 * @param {string} openApiPath - e.g. /users/{id}
 * @returns {string[]} e.g. ['id']
 */
function extractParams(openApiPath) {
  const params = [];
  const re = /\{(\w+)}/g;
  let match;
  while ((match = re.exec(openApiPath)) !== null) {
    params.push(match[1]);
  }
  return params;
}

/**
 * Generate OpenAPI 3.0.3 YAML documentation from parsed API data.
 * @param {Array} apiData - Array of parsed API metadata from parser
 * @returns {string} OpenAPI spec as YAML string
 */
function generateOpenAPI(apiData, config = {}) {
  const paths = new Map();
  const tagSet = new Map();
  const usedOperationIds = new Map();

  for (const file of apiData) {
    for (const route of file.routes) {
      const openApiPath = convertPath(route.path);
      const method = route.method.toLowerCase();
      const sourceFile = file.fileName;

      if (!tagSet.has(sourceFile)) {
        tagSet.set(sourceFile, {
          name: sourceFile,
          description: `Routes from ${sourceFile}`,
        });
      }

      if (!paths.has(openApiPath)) {
        paths.set(openApiPath, {});
      }

      const summary =
        route.jsdoc?.description || `${route.method} ${openApiPath}`;

      // Deduplicate operationIds: append a counter suffix on collision
      const baseId = deriveOperationId(method, openApiPath);
      const idKey = baseId;
      const count = usedOperationIds.get(idKey) || 0;
      usedOperationIds.set(idKey, count + 1);
      const operationId = count === 0 ? baseId : `${baseId}-${count}`;

      const params = extractParams(openApiPath);

      const successCode = METHOD_SUCCESS_CODE[method] || 200;
      const successDescription =
        successCode === 201
          ? 'Resource created'
          : successCode === 204
            ? 'No content'
            : 'Successful response';

      const operation = {
        summary,
        operationId,
        tags: [sourceFile],
        responses: {
          [successCode]: { description: successDescription },
        },
      };

      if (params.length > 0) {
        operation.parameters = params.map((name) => ({
          name,
          in: 'path',
          required: true,
          schema: { type: 'string' },
        }));
      }

      paths.get(openApiPath)[method] = operation;
    }
  }

  const spec = {
    openapi: '3.0.3',
    info: {
      title: config.apiTitle || 'API Documentation',
      version: config.apiVersion || '1.0.0',
      description: 'Auto-generated API documentation',
      'x-generator': 'api-docs-generator',
      'x-generated-at': new Date().toISOString(),
    },
    servers: [
      {
        url: config.serverUrl || 'http://localhost:3000',
        description: 'Default development server',
      },
    ],
  };

  if (tagSet.size > 0) {
    spec.tags = Array.from(tagSet.values());
  }

  const pathsObj = {};
  for (const [pathKey, methods] of paths) {
    pathsObj[pathKey] = methods;
  }
  spec.paths = pathsObj;

  return yaml.dump(spec, {
    lineWidth: -1,
    quotingType: "'",
    forceQuotes: false,
  });
}

export { generateOpenAPI };
