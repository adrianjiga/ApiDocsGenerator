/**
 * Generate JSON documentation
 * @param {Array} apiData - Array of parsed API metadata
 * @returns {string} JSON formatted documentation
 */
function generateJSON(apiData, config = {}) {
  const output = {
    meta: {
      generated: new Date().toISOString(),
      version: config.apiVersion || '1.0.0',
      tool: 'api-docs-generator',
    },
    files: apiData.map((file) => ({
      file: file.file,
      fileName: file.fileName,
      functions: file.functions.map((fn) => ({
        name: fn.name,
        params: fn.params,
        description: fn.description,
        line: fn.line,
        async: fn.async || false,
        generator: fn.generator || false,
        exported: fn.exported || false,
        ...(fn.className !== undefined && {
          className: fn.className,
          static: fn.static || false,
          methodKind: fn.methodKind || 'method',
        }),
        jsdoc: fn.jsdoc
          ? {
              description: fn.jsdoc.description,
              tags: fn.jsdoc.tags || [],
            }
          : null,
      })),
      routes: file.routes.map((route) => ({
        method: route.method,
        path: route.path,
        params: route.params,
        line: route.line,
        jsdoc: route.jsdoc
          ? {
              description: route.jsdoc.description,
              tags: route.jsdoc.tags || [],
            }
          : null,
      })),
    })),
  };

  return JSON.stringify(output, null, 2);
}

export { generateJSON };
