import { calcPercentage, getParamTags, getReturnTags } from './utils.js';

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
  apiData.forEach((fileData) => {
    const fileGaps = [];
    let fileDocumentedItems = 0;
    let fileTotalItems = 0;

    // Analyze functions
    fileData.functions?.forEach((func) => {
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
          functionSignature: `${func.name}(${func.params.join(', ')})`,
        };
        fileGaps.push(gap);
        gaps.push(gap);
      }
    });

    // Analyze routes
    fileData.routes?.forEach((route) => {
      fileTotalItems++;
      totalRoutes++;

      const docStatus = checkRouteDocumentation(route);

      if (docStatus.isFullyDocumented) {
        fileDocumentedItems++;
        documentedRoutes++;
      } else if (docStatus.isPartiallyDocumented) {
        partiallyDocumented++;
      }

      if (!docStatus.isFullyDocumented) {
        const gap = {
          type: 'route',
          name: `${route.method} ${route.path}`,
          fileName: fileData.fileName,
          filePath: fileData.file,
          line: route.line,
          severity: docStatus.isPartiallyDocumented ? 'warning' : 'error',
          missing: docStatus.missing,
          existing: docStatus.existing,
          functionSignature: `${route.method} ${route.path}`,
        };
        fileGaps.push(gap);
        gaps.push(gap);
      }
    });

    // Build per-file breakdown
    if (fileTotalItems > 0) {
      const fileCoveragePercentage = calcPercentage(
        fileDocumentedItems,
        fileTotalItems,
      );

      files.push({
        fileName: fileData.fileName,
        filePath: fileData.file,
        totalItems: fileTotalItems,
        documentedItems: fileDocumentedItems,
        coveragePercentage: fileCoveragePercentage,
        gaps: fileGaps,
      });
    }
  });

  // Calculate summary coverage percentages
  const totalItems = totalFunctions + totalRoutes;
  const totalDocumentedItems = documentedFunctions + documentedRoutes;
  const undocumentedFunctions = totalFunctions - documentedFunctions;

  const coveragePercentage = calcPercentage(totalDocumentedItems, totalItems);
  const functionCoverage = calcPercentage(documentedFunctions, totalFunctions);
  const routeCoverage = calcPercentage(documentedRoutes, totalRoutes);

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
      routeCoverage,
    },
    files,
    gaps,
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
    returns: false,
  };

  const missing = [];

  // Check if jsdoc exists
  if (!func.jsdoc) {
    return {
      isFullyDocumented: false,
      isPartiallyDocumented: false,
      missing: ['description', 'params', 'returns'],
      existing,
    };
  }

  // Check description
  if (func.jsdoc.description && func.jsdoc.description.trim()) {
    existing.description = func.jsdoc.description;
  } else {
    missing.push('description');
  }

  // Check params
  const paramTags = getParamTags(func.jsdoc.tags);
  const documentedParamNames = paramTags.map((tag) => tag.name);

  existing.params = documentedParamNames;

  func.params.forEach((paramName) => {
    if (!documentedParamNames.includes(paramName)) {
      if (!missing.includes('params')) {
        missing.push('params');
      }
    }
  });

  // Check returns
  const hasReturnsTag = getReturnTags(func.jsdoc.tags).length > 0;

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
    existing,
  };
}

/**
 * Check documentation status of a route
 * @param {Object} route - Route object with method, path, params, jsdoc
 * @returns {Object} Status object with isFullyDocumented, isPartiallyDocumented, missing, existing
 */
function checkRouteDocumentation(route) {
  const existing = {
    description: null,
    params: [],
    returns: false,
  };

  const missing = [];

  if (!route.jsdoc) {
    return {
      isFullyDocumented: false,
      isPartiallyDocumented: false,
      missing: ['description', 'params', 'returns'],
      existing,
    };
  }

  // Check description
  if (route.jsdoc.description && route.jsdoc.description.trim()) {
    existing.description = route.jsdoc.description;
  } else {
    missing.push('description');
  }

  // Check path params documented via @param
  const paramTags = getParamTags(route.jsdoc.tags);
  const documentedParamNames = paramTags.map((tag) => tag.name);
  existing.params = documentedParamNames;

  route.params.forEach((paramName) => {
    if (!documentedParamNames.includes(paramName)) {
      if (!missing.includes('params')) {
        missing.push('params');
      }
    }
  });

  // Check returns
  const hasReturnsTag = getReturnTags(route.jsdoc.tags).length > 0;
  if (hasReturnsTag) {
    existing.returns = true;
  } else {
    missing.push('returns');
  }

  const isFullyDocumented = missing.length === 0;
  const isPartiallyDocumented = !isFullyDocumented && route.jsdoc !== null;

  return { isFullyDocumented, isPartiallyDocumented, missing, existing };
}

export { analyzeCoverage, checkRouteDocumentation };
