import { getParamDetails, isThisParam, nodeText } from '../utils.js';
import {
  FUNCTION_TYPES,
  memberPath,
  parseSource,
  propertyKey,
  traverse,
} from './ast.js';
import { collectExports, commonJsExportDepth } from './exports.js';
import { handleRouteExpression, inferRouteServers } from './routes.js';

/**
 * Push function metadata for a function node
 * @param {Array} functions - Accumulator array for extracted function metadata
 * @param {Object} fnNode - Function AST node (declaration, expression or arrow)
 * @param {Object} info - Name, line, export flag, optional class details and
 *   optional extra docLines a preceding JSDoc may point at (e.g. an `export` line)
 * @param {string} source - Source code the node was parsed from
 * @returns {void}
 */
function pushFunction(functions, fnNode, info, source) {
  const paramDetails = fnNode.params
    .filter((p) => !isThisParam(p))
    .map((p) => getParamDetails(p, source));
  const returnType = nodeText(fnNode.returnType?.typeAnnotation, source);
  const item = {
    type: 'function',
    name: info.name,
    params: paramDetails.map((d) => d.name),
    paramDetails,
    ...(returnType && { returnType }),
    line: info.line,
    nodeType: info.nodeType || fnNode.type,
    async: !!fnNode.async,
    generator: !!fnNode.generator,
    exported: !!info.exported,
  };
  if (info.docLines) item.docLines = info.docLines;
  if (info.className) {
    item.className = info.className;
    item.static = !!info.static;
    item.methodKind = info.methodKind || 'method';
  }
  functions.push(item);
}

/**
 * Extract function-valued properties of an object literal
 * @param {Object} objectNode - ObjectExpression node
 * @param {Array} functions - Accumulator array for extracted function metadata
 * @param {Object} options - Optional name prefix and export flag
 * @param {string} source - Source code the node was parsed from
 * @returns {void}
 */
function handleObjectMethods(
  objectNode,
  functions,
  { prefix, exported },
  source,
) {
  for (const prop of objectNode.properties) {
    if (
      prop.type !== 'Property' ||
      prop.kind !== 'init' ||
      !FUNCTION_TYPES.includes(prop.value?.type)
    )
      continue;
    const key = propertyKey(prop);
    if (!key) continue;
    pushFunction(
      functions,
      prop.value,
      {
        name: prefix ? `${prefix}.${key}` : key,
        line: prop.loc?.start.line || 0,
        exported,
      },
      source,
    );
  }
}

/**
 * Handle assignments of functions to CommonJS exports or class prototypes
 * @param {Object} node - AssignmentExpression node
 * @param {Array} functions - Accumulator array for extracted function metadata
 * @param {string} source - Source code the node was parsed from
 * @param {Set<string>} [exportedNames] - Exported module-level names, used to
 *   mark prototype methods of an exported constructor as exported
 * @returns {void}
 */
function handleAssignment(node, functions, source, exportedNames = new Set()) {
  const target = memberPath(node.left);
  if (!target || target.length < 2) return;

  const value = node.right;
  const line = node.loc?.start.line || 0;
  const depth = commonJsExportDepth(target);

  if (depth >= 0) {
    const rest = target.slice(depth);
    if (rest.length === 0 && value.type === 'ObjectExpression') {
      handleObjectMethods(value, functions, { exported: true }, source);
      return;
    }
    if (rest.length > 1 || !FUNCTION_TYPES.includes(value.type)) return;
    pushFunction(
      functions,
      value,
      { name: rest[0] || value.id?.name || 'default', line, exported: true },
      source,
    );
    return;
  }

  if (
    target.length === 3 &&
    target[1] === 'prototype' &&
    FUNCTION_TYPES.includes(value.type)
  ) {
    pushFunction(
      functions,
      value,
      {
        name: target[2],
        line,
        className: target[0],
        exported: exportedNames.has(target[0]),
      },
      source,
    );
  }
}

/**
 * Handle a ClassDeclaration or ClassExpression node and extract its methods
 * @param {Object} node - AST ClassDeclaration or ClassExpression node
 * @param {Array} functions - Accumulator array for extracted function metadata
 * @param {boolean} exported - Whether the class is exported
 * @param {string} [className] - Name to use when the class itself is anonymous
 * @param {string} source - Source code the node was parsed from
 * @returns {void}
 */
function handleClassDeclaration(node, functions, exported, className, source) {
  if (!node.body?.body) return;
  const name = node.id?.name || className || 'anonymous';

  for (const member of node.body.body) {
    const isMethod =
      member.type === 'MethodDefinition' ||
      member.type === 'TSAbstractMethodDefinition';
    const isFunctionField =
      (member.type === 'PropertyDefinition' ||
        member.type === 'AccessorProperty') &&
      FUNCTION_TYPES.includes(member.value?.type);
    if ((!isMethod && !isFunctionField) || !member.value) continue;

    pushFunction(
      functions,
      member.value,
      {
        name: member.key?.name || member.key?.value || 'anonymous',
        line: member.loc?.start.line || 0,
        nodeType: isMethod ? 'MethodDefinition' : 'PropertyDefinition',
        exported,
        className: name,
        static: member.static,
        methodKind: isMethod ? member.kind || 'method' : 'method',
      },
      source,
    );
  }
}

/**
 * Collect functions, class methods and routes from a parsed AST
 * @param {Object} ast - Program AST
 * @param {string} source - Source code the AST was parsed from
 * @param {string[]} [routeServers] - Allowed server identifiers. When empty,
 *   the identifiers the file assigns a server or router to are used, and when
 *   it assigns none, any identifier counts.
 * @returns {Array} Array of function and route metadata objects
 */
function collectItems(ast, source, routeServers) {
  const functions = [];
  const servers = routeServers?.length ? routeServers : inferRouteServers(ast);
  const exports = collectExports(ast);
  const isExported = (node, name) =>
    exports.declarations.has(node) || (!!name && exports.names.has(name));
  const exportedNames = new Set(exports.names);
  for (const decl of exports.declarations) {
    if (decl.id?.type === 'Identifier') exportedNames.add(decl.id.name);
  }
  const exportDocLines = (node) =>
    exports.exportLines.has(node) ? [exports.exportLines.get(node)] : undefined;

  traverse(ast, (node) => {
    switch (node.type) {
      case 'FunctionDeclaration':
        if (!exports.moduleLevel.has(node)) break;
        pushFunction(
          functions,
          node,
          {
            name: node.id?.name || 'anonymous',
            line: node.loc?.start.line || 0,
            exported: isExported(node, node.id?.name),
            docLines: exportDocLines(node),
          },
          source,
        );
        break;
      case 'ClassDeclaration':
        if (!exports.moduleLevel.has(node)) break;
        handleClassDeclaration(
          node,
          functions,
          isExported(node, node.id?.name),
          undefined,
          source,
        );
        break;
      case 'VariableDeclarator': {
        if (!exports.moduleLevel.has(node)) break;
        const name = node.id?.type === 'Identifier' ? node.id.name : undefined;
        const exported = isExported(node, name);
        if (FUNCTION_TYPES.includes(node.init?.type)) {
          pushFunction(
            functions,
            node.init,
            {
              name: name || 'anonymous',
              line: node.loc?.start.line || 0,
              exported,
              docLines: exportDocLines(node),
            },
            source,
          );
        } else if (node.init?.type === 'ClassExpression') {
          handleClassDeclaration(node.init, functions, exported, name, source);
        } else if (node.init?.type === 'ObjectExpression' && name) {
          handleObjectMethods(
            node.init,
            functions,
            { prefix: name, exported },
            source,
          );
        }
        break;
      }
      case 'ExportDefaultDeclaration':
        if (node.declaration?.type === 'ObjectExpression') {
          handleObjectMethods(
            node.declaration,
            functions,
            { exported: true },
            source,
          );
        }
        break;
      case 'AssignmentExpression':
        if (node.operator === '=' && exports.moduleLevel.has(node)) {
          handleAssignment(node, functions, source, exportedNames);
        }
        break;
      case 'CallExpression':
        if (node.callee?.property) {
          handleRouteExpression(node, functions, servers);
        }
        break;
    }
  });

  return functions;
}

/**
 * Extract function information from AST
 * @param {string} sourceCode - JavaScript/TypeScript source code
 * @param {string[]} [routeServers] - Optional list of Express/Fastify instance
 *   identifiers to restrict route detection to.
 * @returns {Array} Array of function metadata objects
 */
function extractFunctions(sourceCode, routeServers) {
  const ast = parseSource(sourceCode);
  return ast ? collectItems(ast, sourceCode, routeServers) : [];
}

export { collectItems, extractFunctions };
