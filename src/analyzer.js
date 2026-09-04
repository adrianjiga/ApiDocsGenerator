import { calcPercentage, getParamTags, getReturnTags } from './utils.js';

/**
 * Analyze documentation coverage for parsed API data
 * @param {Array} apiData - Array of file objects from parseDirectory()
 * @returns {Object} Coverage analysis with summary, per-file breakdown, and gaps
 */
function analyzeCoverage(apiData) {
  if (!Array.isArray(apiData)) {
    return {
      summary: {
        totalFunctions: 0,
        documentedFunctions: 0,
        undocumentedFunctions: 0,
        partiallyDocumented: 0,
        totalRoutes: 0,
        documentedRoutes: 0,
        coveragePercentage: 0,
        functionCoverage: 0,
        routeCoverage: 0,
      },
      files: [],
      gaps: [],
    };
  }

  const gaps = [];
  const files = [];

  let totalFunctions = 0;
  let documentedFunctions = 0;
  let partiallyDocumentedFunctions = 0;
  let totalRoutes = 0;
  let documentedRoutes = 0;
  let partiallyDocumented = 0;

  // Process each file
  apiData.forEach((fileData) => {
    try {
      const fileGaps = [];
      let fileDocumentedItems = 0;
      let fileTotalItems = 0;

      // Analyze functions
      fileData.functions?.forEach((func) => {
        try {
          fileTotalItems++;
          totalFunctions++;

          const docStatus = checkFunctionDocumentation(func);

          if (docStatus.isFullyDocumented) {
            fileDocumentedItems++;
            documentedFunctions++;
          } else if (docStatus.isPartiallyDocumented) {
            partiallyDocumented++;
            partiallyDocumentedFunctions++;
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
        } catch (err) {
          console.warn(
            `Warning: Error analyzing function ${func?.name || 'unknown'}: ${err.message}`,
          );
        }
      });

      // Analyze routes
      fileData.routes?.forEach((route) => {
        try {
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
        } catch (err) {
          console.warn(
            `Warning: Error analyzing route ${route?.method || ''} ${route?.path || 'unknown'}: ${err.message}`,
          );
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
    } catch (err) {
      console.warn(
        `Warning: Error analyzing file ${fileData?.fileName || 'unknown'}: ${err.message}`,
      );
    }
  });

  // Calculate summary coverage percentages
  const totalItems = totalFunctions + totalRoutes;
  const totalDocumentedItems = documentedFunctions + documentedRoutes;
  const undocumentedFunctions =
    totalFunctions - documentedFunctions - partiallyDocumentedFunctions;

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
 * Check documentation status of an item (function or route)
 * @param {Object} item - Item with params and jsdoc properties
 * @returns {Object} Status object with isFullyDocumented, isPartiallyDocumented, missing, existing
 */
function checkDocumentation(item) {
  const existing = {
    description: null,
    params: [],
    returns: false,
  };

  const missing = [];

  if (!item.jsdoc) {
    return {
      isFullyDocumented: false,
      isPartiallyDocumented: false,
      missing: ['description', 'params', 'returns'],
      existing,
    };
  }

  // Check description
  if (item.jsdoc.description && item.jsdoc.description.trim()) {
    existing.description = item.jsdoc.description;
  } else {
    missing.push('description');
  }

  // Check params
  const paramTags = getParamTags(item.jsdoc.tags);
  const documentedParamNames = paramTags.map((tag) => tag.name);
  existing.params = documentedParamNames;

  item.params.forEach((paramName) => {
    if (!documentedParamNames.includes(paramName)) {
      if (!missing.includes('params')) {
        missing.push('params');
      }
    }
  });

  // Check returns — @returns {void} or @returns {undefined} counts as
  // intentionally documented (the developer chose to declare no return value)
  const returnTags = getReturnTags(item.jsdoc.tags);
  const hasReturnsTag = returnTags.length > 0;
  const isVoidReturn =
    hasReturnsTag &&
    returnTags.some((t) => {
      const type = (t.type || '').toLowerCase().trim();
      return type === 'void' || type === 'undefined' || type === 'never';
    });

  if (hasReturnsTag) {
    existing.returns = true;
    if (isVoidReturn) {
      existing.voidReturn = true;
    }
  } else {
    missing.push('returns');
  }

  const isFullyDocumented = missing.length === 0;
  const isPartiallyDocumented = !isFullyDocumented && item.jsdoc !== null;

  return { isFullyDocumented, isPartiallyDocumented, missing, existing };
}

/**
 * Check documentation status of a function
 * @param {Object} func - Function object with name, params, jsdoc
 * @returns {Object} Status object with isFullyDocumented, isPartiallyDocumented, missing, existing
 */
function checkFunctionDocumentation(func) {
  return checkDocumentation(func);
}

/**
 * Check documentation status of a route
 * @param {Object} route - Route object with method, path, params, jsdoc
 * @returns {Object} Status object with isFullyDocumented, isPartiallyDocumented, missing, existing
 */
function checkRouteDocumentation(route) {
  return checkDocumentation(route);
}

export { analyzeCoverage, checkRouteDocumentation };
