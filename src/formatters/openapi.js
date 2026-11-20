import yaml from 'js-yaml';
import {
  cleanTagDescription,
  getParamTags,
  getReturnTags,
  uniqueFileLabels,
} from '../utils.js';

/**
 * Default success response code per HTTP method.
 * POST → 201 Created, DELETE → 204 No Content, others → 200 OK.
 * @type {Object.<string, number>}
 */
const METHOD_SUCCESS_CODE = {
  post: 201,
  delete: 204,
};

const OPENAPI_METHODS = new Set([
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
]);

const BODY_METHODS = new Set(['post', 'put', 'patch']);

const ALL_METHODS = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options',
];

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

const PRIMITIVE_SCHEMAS = {
  string: 'string',
  number: 'number',
  integer: 'integer',
  int: 'integer',
  boolean: 'boolean',
  bool: 'boolean',
  object: 'object',
};

/**
 * Map a JSDoc type to an OpenAPI schema
 * @param {string} [type] - JSDoc type, e.g. `number` or `string[]`
 * @param {Object} [fallback] - Schema to use when there is no type
 * @returns {Object} OpenAPI schema; `{}` (any value) for types it cannot map
 */
function schemaFor(type, fallback = { type: 'string' }) {
  const text = (type || '').trim();
  if (!text) return { ...fallback };
  const arrayOf =
    text.match(/^(.+)\[\]$/)?.[1] ?? text.match(/^Array<(.+)>$/i)?.[1];
  if (arrayOf) return { type: 'array', items: schemaFor(arrayOf, {}) };
  const primitive = PRIMITIVE_SCHEMAS[text.toLowerCase()];
  return primitive ? { type: primitive } : {};
}

/**
 * Convert a JSDoc default, which comment-parser keeps as source text, to a
 * value of the schema's type
 * @param {string} value - Default as written, e.g. `10` or `'asc'`
 * @param {Object} schema - Schema of the parameter
 * @returns {*} Typed default
 */
function typedDefault(value, schema) {
  const text = value.trim();
  if (schema.type === 'number' || schema.type === 'integer') {
    const number = Number(text);
    if (text !== '' && Number.isFinite(number)) return number;
  }
  if (schema.type === 'boolean' && /^(true|false)$/.test(text)) {
    return text === 'true';
  }
  return text.replace(/^(['"`])(.*)\1$/, '$2');
}

/**
 * OpenAPI parameter object for a documented or path parameter
 * @param {string} name - Parameter name
 * @param {string} location - `path` or `query`
 * @param {Object} [tag] - Matching @param tag
 * @returns {Object} Parameter object
 */
function parameterObject(name, location, tag) {
  const description = cleanTagDescription(tag?.description);
  const schema = schemaFor(tag?.type);
  if (tag?.default !== undefined) {
    schema.default = typedDefault(tag.default, schema);
  }
  return {
    name,
    in: location,
    required: location === 'path' || !tag?.optional,
    ...(description && { description }),
    schema,
  };
}

/**
 * Request body built from `@param body` and `@param body.<field>` tags
 * @param {Array} paramTags - The route's @param tags
 * @returns {Object|undefined} OpenAPI requestBody, or undefined when not documented
 */
function requestBody(paramTags) {
  const bodyTag = paramTags.find((tag) => tag.name === 'body');
  const fields = paramTags.filter((tag) => tag.name.startsWith('body.'));
  if (!bodyTag && fields.length === 0) return undefined;

  let schema = schemaFor(bodyTag?.type, { type: 'object' });
  if (fields.length > 0) {
    const properties = {};
    const required = [];
    for (const tag of fields) {
      const field = tag.name.slice('body.'.length);
      const description = cleanTagDescription(tag.description);
      properties[field] = {
        ...schemaFor(tag.type, {}),
        ...(description && { description }),
      };
      if (!tag.optional) required.push(field);
    }
    schema = {
      type: 'object',
      properties,
      ...(required.length > 0 && { required }),
    };
  }

  const description = cleanTagDescription(bodyTag?.description);
  return {
    ...(description && { description }),
    required: !bodyTag?.optional,
    content: { 'application/json': { schema } },
  };
}

/**
 * Build the OpenAPI operation for one route at one concrete path
 * @param {Object} route - Route from the parser
 * @param {string} openApiPath - OpenAPI path, e.g. /users/{id}
 * @param {string} operationId - Unique operation id
 * @param {string} tag - Tag the operation is grouped under
 * @returns {Object} Operation object
 */
function buildOperation(route, openApiPath, operationId, tag) {
  const method = route.method.toLowerCase();
  const tags = route.jsdoc?.tags ?? [];
  const paramTags = getParamTags(tags).filter((t) => t.name);
  const tagFor = (name) =>
    paramTags.find((t) => t.name === name || t.name === `params.${name}`);

  const text = (route.jsdoc?.description || '').trim();
  const [firstLine] = text.split('\n');

  const [returnTag] = getReturnTags(tags);
  const returnsBody =
    !!returnTag &&
    !['void', 'undefined', 'never'].includes(
      (returnTag.type || '').toLowerCase().trim(),
    );
  const successCode =
    method === 'delete' && returnsBody
      ? 200
      : METHOD_SUCCESS_CODE[method] || 200;
  const returnDescription = cleanTagDescription(returnTag?.description);
  const successDescription =
    returnDescription ||
    (successCode === 201
      ? 'Resource created'
      : successCode === 204
        ? 'No content'
        : 'Successful response');

  const operation = {
    summary: firstLine || `${route.method} ${openApiPath}`,
    ...(text !== firstLine && { description: text }),
    operationId,
    tags: [tag],
  };

  const parameters = [
    ...extractParams(openApiPath).map((name) =>
      parameterObject(name, 'path', tagFor(name)),
    ),
    ...paramTags
      .filter((t) => /^query\.\w+$/.test(t.name))
      .map((t) => parameterObject(t.name.slice('query.'.length), 'query', t)),
  ];
  if (parameters.length > 0) operation.parameters = parameters;

  const body = BODY_METHODS.has(method) && requestBody(paramTags);
  if (body) operation.requestBody = body;

  operation.responses = {
    [successCode]: { description: successDescription },
  };
  if (tags.some((t) => t.tag === 'deprecated')) operation.deprecated = true;

  return operation;
}

/**
 * Generate OpenAPI 3.0.3 YAML documentation from parsed API data.
 * @param {Array} apiData - Array of parsed API metadata from parser
 * @param {Object} [config] - Configuration; reads apiTitle, apiVersion and serverUrl
 * @returns {string} OpenAPI spec as YAML string
 */
function generateOpenAPI(apiData, config = {}) {
  const paths = new Map();
  const tagSet = new Map();
  const usedOperationIds = new Set();
  const labels = uniqueFileLabels(apiData);

  const fromAll = new Set();

  for (const file of apiData) {
    for (const route of file.routes) {
      const isAll = route.method.toUpperCase() === 'ALL';
      const methods = isAll ? ALL_METHODS : [route.method.toLowerCase()];
      if (!methods.every((m) => OPENAPI_METHODS.has(m))) continue;
      const sourceFile = labels.get(file.file) ?? file.fileName;

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
        const operations = paths.get(openApiPath);

        for (const method of methods) {
          const key = `${method} ${openApiPath}`;
          const existing = operations[method];
          if (existing && (isAll || !fromAll.has(key))) continue;

          let operationId = existing?.operationId;
          if (!operationId) {
            const baseId = deriveOperationId(method, openApiPath);
            operationId = baseId;
            for (let n = 1; usedOperationIds.has(operationId); n++) {
              operationId = `${baseId}-${n}`;
            }
            usedOperationIds.add(operationId);
          }

          operations[method] = buildOperation(
            { ...route, method: method.toUpperCase() },
            openApiPath,
            operationId,
            sourceFile,
          );
          if (isAll) fromAll.add(key);
          else fromAll.delete(key);
        }
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
