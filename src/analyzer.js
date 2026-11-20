import {
  calcPercentage,
  destructuredParamTags,
  getParamTags,
  getReturnTags,
} from './utils.js';

/**
 * Analyze documentation coverage for parsed API data
 * @param {Array} apiData - Array of file objects from parseDirectory()
 * @param {Object} [options] - Analysis options
 * @param {boolean} [options.acceptTypeScriptReturns=false] - Count a declared
 *   TypeScript return type as a documented @returns
 * @param {boolean} [options.exportedOnly=false] - Leave out functions that are
 *   not exported; routes always count
 * @returns {Object} Coverage analysis with summary, per-file breakdown, and gaps
 */
function analyzeCoverage(
  apiData,
  { acceptTypeScriptReturns = false, exportedOnly = false } = {},
) {
  if (!Array.isArray(apiData)) {
    return {
      summary: {
        totalFunctions: 0,
        documentedFunctions: 0,
        undocumentedFunctions: 0,
        partiallyDocumented: 0,
        partiallyDocumentedFunctions: 0,
        totalRoutes: 0,
        documentedRoutes: 0,
        undocumentedRoutes: 0,
        partiallyDocumentedRoutes: 0,
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
  let partiallyDocumentedRoutes = 0;

  // Process each file
  apiData.forEach((fileData) => {
    try {
      const fileGaps = [];
      let fileDocumentedItems = 0;
      let fileTotalItems = 0;

      // Analyze functions
      fileData.functions?.forEach((func) => {
        if (exportedOnly && !func.exported) return;
        try {
          fileTotalItems++;
          totalFunctions++;

          const docStatus = checkFunctionDocumentation(func, {
            acceptTypeScriptReturns,
          });

          if (docStatus.isFullyDocumented) {
            fileDocumentedItems++;
            documentedFunctions++;
          } else if (docStatus.isPartiallyDocumented) {
            partiallyDocumentedFunctions++;
          }

          if (!docStatus.isFullyDocumented) {
            const gap = {
              type: 'function',
              name: func.name,
              fileName: fileData.fileName,
              filePath: fileData.relativePath ?? fileData.file,
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
            partiallyDocumentedRoutes++;
          }

          if (!docStatus.isFullyDocumented) {
            const gap = {
              type: 'route',
              name: `${route.method} ${route.path}`,
              fileName: fileData.fileName,
              filePath: fileData.relativePath ?? fileData.file,
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
          filePath: fileData.relativePath ?? fileData.file,
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
  const undocumentedRoutes =
    totalRoutes - documentedRoutes - partiallyDocumentedRoutes;

  const coveragePercentage = calcPercentage(totalDocumentedItems, totalItems);
  const functionCoverage = calcPercentage(documentedFunctions, totalFunctions);
  const routeCoverage = calcPercentage(documentedRoutes, totalRoutes);

  return {
    summary: {
      totalFunctions,
      documentedFunctions,
      undocumentedFunctions,
      partiallyDocumented:
        partiallyDocumentedFunctions + partiallyDocumentedRoutes,
      partiallyDocumentedFunctions,
      totalRoutes,
      documentedRoutes,
      undocumentedRoutes,
      partiallyDocumentedRoutes,
      coveragePercentage,
      functionCoverage,
      routeCoverage,
    },
    files,
    gaps,
  };
}

/**
 * Whether a parameter has a matching @param tag. Rest parameters (`...args`)
 * match `@param args`. Destructured parameters (`{a, b}`, `[a, b]`) match the
 * tag destructuredParamTags pairs them with.
 * @param {string} paramName - Parameter name from the parser
 * @param {number} index - Position of the parameter
 * @param {string[]} documentedNames - Names of all @param tags
 * @param {Map<number, Object>} destructured - Result of destructuredParamTags
 * @returns {boolean} True when the parameter is documented
 */
function isParamDocumented(paramName, index, documentedNames, destructured) {
  const name = paramName.startsWith('...') ? paramName.slice(3) : paramName;
  return (
    documentedNames.includes(paramName) ||
    documentedNames.includes(name) ||
    destructured.has(index)
  );
}

/**
 * Whether a return type names no value
 * @param {string} [type] - JSDoc or TypeScript type text
 * @returns {boolean} True for void, undefined and never
 */
function isVoidType(type) {
  return ['void', 'undefined', 'never'].includes(
    (type || '').toLowerCase().trim(),
  );
}

/**
 * Check documentation status of an item (function or route)
 * @param {Object} item - Item with params and jsdoc properties
 * @param {Object} [options] - Check options
 * @param {boolean} [options.requireReturns=true] - Whether a @returns tag is required
 * @param {boolean} [options.acceptTypeScriptReturns=false] - Whether a declared
 *   TypeScript return type stands in for a @returns tag
 * @returns {Object} Status object with isFullyDocumented, isPartiallyDocumented, missing, existing
 */
function checkDocumentation(
  item,
  { requireReturns = true, acceptTypeScriptReturns = false } = {},
) {
  const existing = {
    description: null,
    params: [],
    returns: false,
  };

  const missing = [];
  const typedReturn = acceptTypeScriptReturns && !!item.returnType;

  if (!item.jsdoc) {
    return {
      isFullyDocumented: false,
      isPartiallyDocumented: false,
      missing: [
        'description',
        ...(item.params.length > 0 ? ['params'] : []),
        ...(requireReturns && !typedReturn ? ['returns'] : []),
      ],
      existing,
    };
  }

  // Check description
  if (item.jsdoc.description?.trim()) {
    existing.description = item.jsdoc.description;
  } else {
    missing.push('description');
  }

  // Check params
  const paramTags = getParamTags(item.jsdoc.tags);
  const documentedParamNames = paramTags.map((tag) => tag.name);
  existing.params = documentedParamNames;

  const destructured = destructuredParamTags(item.params, paramTags);
  item.params.forEach((paramName, index) => {
    if (
      !isParamDocumented(
        paramName,
        index,
        documentedParamNames,
        destructured,
      ) &&
      !missing.includes('params')
    ) {
      missing.push('params');
    }
  });

  // Check returns — @returns {void} or @returns {undefined} counts as
  // intentionally documented (the developer chose to declare no return value)
  const returnTags = getReturnTags(item.jsdoc.tags);
  const hasReturnsTag = returnTags.length > 0;
  const isVoidReturn = hasReturnsTag
    ? returnTags.some((t) => isVoidType(t.type))
    : typedReturn && isVoidType(item.returnType);

  if (hasReturnsTag || typedReturn) {
    existing.returns = true;
    if (isVoidReturn) {
      existing.voidReturn = true;
    }
  } else if (requireReturns) {
    missing.push('returns');
  }

  const isFullyDocumented = missing.length === 0;
  const isPartiallyDocumented = !isFullyDocumented && item.jsdoc !== null;

  return { isFullyDocumented, isPartiallyDocumented, missing, existing };
}

/**
 * Check documentation status of a function
 * @param {Object} func - Function object with name, params, jsdoc
 * @param {Object} [options] - Options passed on to checkDocumentation
 * @returns {Object} Status object with isFullyDocumented, isPartiallyDocumented, missing, existing
 */
function checkFunctionDocumentation(func, options) {
  return checkDocumentation(func, options);
}

/**
 * Check documentation status of a route: a description and a @param for each
 * path parameter are required, @returns is not
 * @param {Object} route - Route object with method, path, params, jsdoc
 * @returns {Object} Status object with isFullyDocumented, isPartiallyDocumented, missing, existing
 */
function checkRouteDocumentation(route) {
  return checkDocumentation(route, { requireReturns: false });
}

export { analyzeCoverage, checkRouteDocumentation };
