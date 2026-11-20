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
 * Expand a route path's optional parts into the concrete paths they allow.
 * Express 4 marks an optional segment as `/:id?`; Express 5 wraps optional
 * parts in braces, as in `/files{/:name}`. OpenAPI has no optional path
 * segments, so each combination becomes its own path.
 * @param {string} expressPath - e.g. /users/:id?
 * @returns {string[]} e.g. ['/users', '/users/:id']
 */
function pathVariants(expressPath) {
  const braced = expressPath.replace(
    /\/:(\w+)(\([^)]*\))?\?/g,
    (_, name, pattern = '') => `{/:${name}${pattern}}`,
  );
  const expand = (p) => {
    const group = p.match(/\{([^{}]*)\}/);
    if (!group) return [p || '/'];
    const before = p.slice(0, group.index);
    const after = p.slice(group.index + group[0].length);
    return [...expand(before + after), ...expand(before + group[1] + after)];
  };
  return [...new Set(expand(braced))];
}

/**
 * Convert an Express-style path to OpenAPI path syntax, dropping any regex
 * constraint on a parameter.
 * @param {string} expressPath - e.g. /users/:id(\\d+)
 * @returns {string} e.g. /users/{id}
 */
function convertPath(expressPath) {
  return expressPath.replace(/:(\w+)(\([^)]*\))?/g, '{$1}');
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
    .replace(/[^\w/-]/g, '')
    .replace(/\//g, '-')
    .replace(/^-/, '')
    .replace(/-$/, '');
  return slug ? `${method}-${slug}` : method;
}

/**
 * Extract path parameter names from an OpenAPI path.
 * @param {string} openApiPath - e.g. /users/{id}
 * @returns {string[]} e.g. ['id']
 */
function extractParams(openApiPath) {
  return Array.from(openApiPath.matchAll(/\{(\w+)}/g), (match) => match[1]);
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
      const method = route.method.toLowerCase();
      const sourceFile = file.fileName;

      if (!tagSet.has(sourceFile)) {
        tagSet.set(sourceFile, {
          name: sourceFile,
          description: `Routes from ${sourceFile}`,
        });
      }

      for (const variant of pathVariants(route.path)) {
        const openApiPath = convertPath(variant);
        if (!paths.has(openApiPath)) {
          paths.set(openApiPath, {});
        }

        // A path/method pair may exist only once in an OpenAPI spec. Earlier
        // routes win; later duplicates are skipped rather than silently
        // overwriting the operation already registered for that pair.
        if (paths.get(openApiPath)[method]) {
          continue;
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
