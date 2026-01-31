/**
 * Analyze documentation coverage for parsed API data
 * @param {Array} apiData - Array of file objects from parseDirectory()
 * @returns {Object} Coverage analysis with summary, per-file breakdown, and gaps
 */
function analyzeCoverage(apiData) {
  const gaps = [];
  const files = [];
  
  let totalFunctions = 0;
  let documentedFunctions = 0;
  let totalRoutes = 0;
  let documentedRoutes = 0;
  let partiallyDocumented = 0;

  // Process each file
  apiData.forEach(fileData => {
    const fileGaps = [];
    let fileDocumentedItems = 0;
    let fileTotalItems = 0;

    // Analyze functions
    fileData.functions?.forEach(func => {
      fileTotalItems++;
      totalFunctions++;

      const docStatus = checkFunctionDocumentation(func);
      
      if (docStatus.isFullyDocumented) {
        fileDocumentedItems++;
        documentedFunctions++;
      } else if (docStatus.isPartiallyDocumented) {
        partiallyDocumented++;
      }

      if (!docStatus.isFullyDocumented) {
        const gap = {
          type: 'function',
          name: func.name,
          fileName: fileData.fileName,
          filePath: fileData.file,
          line: func.line,
          severity: docStatus.isPartiallyDocumented ? 'warning' : 'error',
          missing: docStatus.missing,
          existing: docStatus.existing,
          functionSignature: `${func.name}(${func.params.join(', ')})`
        };
        fileGaps.push(gap);
        gaps.push(gap);
      }
    });

    // Analyze routes
    fileData.routes?.forEach(route => {
      fileTotalItems++;
      totalRoutes++;

      // Routes are undocumented if jsdoc is null (current behavior)
      if (route.jsdoc === null) {
        const gap = {
          type: 'route',
          name: `${route.method} ${route.path}`,
          fileName: fileData.fileName,
          filePath: fileData.file,
          line: route.line,
          severity: 'error',
          missing: ['description'],
          existing: {
            description: null,
            params: [],
            returns: false
          },
          functionSignature: `${route.method} ${route.path}`
        };
        fileGaps.push(gap);
        gaps.push(gap);
      } else {
        documentedRoutes++;
      }
    });

    // Build per-file breakdown
    if (fileTotalItems > 0) {
      const fileCoveragePercentage = parseFloat(
        ((fileDocumentedItems / fileTotalItems) * 100).toFixed(1)
      );

      files.push({
        fileName: fileData.fileName,
        filePath: fileData.file,
        totalItems: fileTotalItems,
        documentedItems: fileDocumentedItems,
        coveragePercentage: fileCoveragePercentage,
        gaps: fileGaps
      });
    }
  });

  // Calculate summary coverage percentages
  const totalItems = totalFunctions + totalRoutes;
  const totalDocumentedItems = documentedFunctions + documentedRoutes;
  const undocumentedFunctions = totalFunctions - documentedFunctions;

  const coveragePercentage = totalItems > 0 
    ? parseFloat(((totalDocumentedItems / totalItems) * 100).toFixed(1))
    : 0;

  const functionCoverage = totalFunctions > 0
    ? parseFloat(((documentedFunctions / totalFunctions) * 100).toFixed(1))
    : 0;

  const routeCoverage = totalRoutes > 0
    ? parseFloat(((documentedRoutes / totalRoutes) * 100).toFixed(1))
    : 0;

  return {
    summary: {
      totalFunctions,
      documentedFunctions,
      undocumentedFunctions,
      partiallyDocumented,
      totalRoutes,
      documentedRoutes,
      coveragePercentage,
      functionCoverage,
      routeCoverage
    },
    files,
    gaps
  };
}

/**
 * Check documentation status of a function
 * @param {Object} func - Function object with name, params, jsdoc
 * @returns {Object} Status object with isFullyDocumented, isPartiallyDocumented, missing, existing
 */
function checkFunctionDocumentation(func) {
  const existing = {
    description: null,
    params: [],
    returns: false
  };

  const missing = [];

  // Check if jsdoc exists
  if (!func.jsdoc) {
    return {
      isFullyDocumented: false,
      isPartiallyDocumented: false,
      missing: ['description', 'params', 'returns'],
      existing
    };
  }

  // Check description
  if (func.jsdoc.description && func.jsdoc.description.trim()) {
    existing.description = func.jsdoc.description;
  } else {
    missing.push('description');
  }

  // Check params
  const paramTags = (func.jsdoc.tags || []).filter(tag => tag.tag === 'param');
  const documentedParamNames = paramTags.map(tag => tag.name);
  
  existing.params = documentedParamNames;

  func.params.forEach(paramName => {
    if (!documentedParamNames.includes(paramName)) {
      if (!missing.includes('params')) {
        missing.push('params');
      }
    }
  });

  // Check returns
  const hasReturnsTag = (func.jsdoc.tags || []).some(
    tag => tag.tag === 'returns' || tag.tag === 'return'
  );

  if (hasReturnsTag) {
    existing.returns = true;
  } else {
    missing.push('returns');
  }

  const isFullyDocumented = missing.length === 0;
  const isPartiallyDocumented = !isFullyDocumented && func.jsdoc !== null;

  return {
    isFullyDocumented,
    isPartiallyDocumented,
    missing,
    existing
  };
}

export { analyzeCoverage };
