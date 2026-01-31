/**
 * Generate JSON documentation
 * @param {Array} apiData - Array of parsed API metadata
 * @returns {string} JSON formatted documentation
 */
function generateJSON(apiData) {
  const output = {
    meta: {
      generated: new Date().toISOString(),
      version: '1.0.0',
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
      })),
    })),
  };

  return JSON.stringify(output, null, 2);
}

export { generateJSON };
