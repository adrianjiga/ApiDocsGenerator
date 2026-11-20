import { parse } from 'comment-parser';
import { parseSource } from './ast.js';

const JSDOC_REGEX = /\/\*\*\s*([\s\S]*?)\*\//g;

const NAMELESS_TAGS = new Set(['returns', 'return', 'throws', 'yields']);

const FREE_TEXT_TAGS = new Set(['example', 'deprecated', 'see']);

/**
 * Text that follows a tag, rebuilt from comment-parser's raw line tokens so
 * that line breaks and indentation survive
 * @param {Object} tag - Tag parsed by comment-parser
 * @returns {string} Tag text with one line per comment line
 */
function rawTagText(tag) {
  const lines = (tag.source ?? []).map(({ tokens }, index) => {
    const indent = index === 0 ? '' : tokens.postDelimiter.slice(1);
    const text =
      tokens.type +
      tokens.postType +
      tokens.name +
      tokens.postName +
      tokens.description;
    return (indent + text).trimEnd();
  });
  while (lines.length > 0 && lines.at(-1) === '') lines.pop();
  return lines.join('\n').replace(/^\s+/, '');
}

/**
 * Keep the whole text of tags whose content is free text rather than
 * `{type} name description`: `@example` code with its line breaks and
 * indentation, and `@deprecated` and `@see` text (which may hold an inline
 * `{@link}`) on one line
 * @param {Object} tag - Tag parsed by comment-parser
 * @returns {Object} The tag with its text as description, no type and no name
 */
function normalizeFreeTextTag(tag) {
  if (!FREE_TEXT_TAGS.has(tag.tag)) return tag;
  const text = rawTagText(tag);
  const { default: _default, ...rest } = tag;
  return {
    ...rest,
    type: '',
    name: '',
    optional: false,
    description: tag.tag === 'example' ? text : text.replace(/\s+/g, ' '),
  };
}

/**
 * Put back the first word of tags that take no name. comment-parser reads
 * every tag as `{type} name description`, so `@returns {number} The sum`
 * would otherwise lose "The" to the name field.
 * @param {Object} tag - Tag parsed by comment-parser
 * @returns {Object} The tag with its full description and an empty name
 */
function normalizeNamelessTag(tag) {
  if (!NAMELESS_TAGS.has(tag.tag) || !tag.name) return tag;
  const word = tag.source?.[0]?.tokens?.name || tag.name;
  const { default: _default, ...rest } = tag;
  return {
    ...rest,
    name: '',
    optional: false,
    description: `${word} ${tag.description}`.trim(),
  };
}

/**
 * Parse the text of a single JSDoc block
 * @param {string} raw - Comment text between the opening `/*` and closing `*\/`
 * @param {number} startLine - Line the comment starts on
 * @param {number} endLine - Line the comment ends on
 * @returns {Object|null} Parsed JSDoc object, or null if it has no content
 */
function toJSDoc(raw, startLine, endLine) {
  try {
    const parsed = parse(`/*${raw}*/`);
    if (parsed && parsed.length > 0) {
      const [block] = parsed;
      return {
        raw,
        parsed: {
          ...block,
          tags: block.tags.map((tag) =>
            normalizeFreeTextTag(normalizeNamelessTag(tag)),
          ),
        },
        loc: {
          start: { line: startLine, column: 0 },
          end: { line: endLine, column: 0 },
        },
      };
    }
  } catch (parseErr) {
    console.warn(
      `Warning: Failed to parse JSDoc at line ${startLine}: ${parseErr.message}`,
    );
  }
  return null;
}

/**
 * Find the line of the first code token starting at or after an offset
 * @param {Array} tokens - Tokens sorted by position
 * @param {number} offset - Character offset
 * @returns {number|null} Line number, or null when no token follows
 */
function nextTokenLine(tokens, offset) {
  let lo = 0;
  let hi = tokens.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (tokens[mid].range[0] < offset) lo = mid + 1;
    else hi = mid;
  }
  return tokens[lo] ? tokens[lo].loc.start.line : null;
}

/**
 * Collect JSDoc blocks from a parsed AST
 * @param {Object} ast - AST produced by parseSource
 * @returns {Array} Parsed JSDoc objects, each with the line of the code that follows it
 */
function collectJSDoc(ast) {
  const comments = [];
  const tokens = ast.tokens || [];

  for (const comment of ast.comments || []) {
    if (comment.type !== 'Block' || !comment.value.startsWith('*')) continue;
    const jsdoc = toJSDoc(
      comment.value,
      comment.loc.start.line,
      comment.loc.end.line,
    );
    if (jsdoc) {
      jsdoc.nextLine = nextTokenLine(tokens, comment.range[1]);
      comments.push(jsdoc);
    }
  }

  return comments;
}

/**
 * Locate JSDoc blocks with a regex, for source that fails to parse
 * @param {string} sourceCode - JavaScript/TypeScript source code
 * @returns {Array} Parsed JSDoc objects
 */
function scanJSDocText(sourceCode) {
  const comments = [];

  for (const match of sourceCode.matchAll(JSDOC_REGEX)) {
    const startLine = sourceCode.substring(0, match.index).split('\n').length;
    const endLine = startLine + match[0].split('\n').length - 1;
    const jsdoc = toJSDoc(match[1], startLine, endLine);
    if (jsdoc) comments.push(jsdoc);
  }

  return comments;
}

/**
 * Parse JSDoc comments from source code.
 * Comments are taken from the tokenizer so that JSDoc-shaped text inside
 * string or template literals is never mistaken for documentation;
 * regex-based extraction is kept only as a fallback for source that fails to
 * parse (e.g. fragments).
 * @param {string} sourceCode - JavaScript/TypeScript source code
 * @returns {Array} Array of parsed JSDoc objects
 */
function parseJSDoc(sourceCode) {
  const ast = parseSource(sourceCode);
  return ast ? collectJSDoc(ast) : scanJSDocText(sourceCode);
}

/**
 * Match JSDoc comments to code items. Each item can be documented from its own
 * line or from extra `docLines` (the line of its `export` keyword, or the first
 * line of a route chain). A comment documents the nearest item whose doc line
 * is within 2 lines below it, plus any routes declared by the same call at that
 * line. When the comment carries `nextLine` (the line of the first code token
 * after it), only items documented from that line qualify, so a comment never
 * documents code past an intervening statement. If several comments target the
 * same item, the closest one wins, and the later one on a tie.
 * @param {Array} jsdocs - Array of parsed JSDoc objects
 * @param {Array} items - Array of function/route metadata objects
 * @returns {Object} Object with jsdocMap and itemKey function
 */
function matchJSDocToItems(jsdocs, items) {
  const jsdocMap = new Map();
  const claimedDistance = new Map();

  const itemKey = (fn) =>
    fn.type === 'route'
      ? `route:${fn.method}:${fn.path}:${fn.line}`
      : fn.className
        ? `fn:${fn.className}.${fn.name}:${fn.line}`
        : `fn:${fn.name}:${fn.line}`;

  const itemsByLine = new Map();
  for (const item of items) {
    for (const line of new Set([item.line, ...(item.docLines ?? [])])) {
      if (!itemsByLine.has(line)) itemsByLine.set(line, []);
      itemsByLine.get(line).push(item);
    }
  }

  for (const jsdoc of jsdocs) {
    if (!jsdoc.loc) continue;
    const endLine = jsdoc.loc.end.line;
    const lines =
      jsdoc.nextLine !== undefined
        ? [jsdoc.nextLine]
        : [endLine, endLine + 1, endLine + 2];

    let candidates = [];
    let distance = 0;
    for (const line of lines) {
      const lineDistance = line - endLine;
      if (lineDistance < 0 || lineDistance > 2) continue;
      if (itemsByLine.has(line)) {
        candidates = itemsByLine.get(line);
        distance = lineDistance;
        break;
      }
    }
    if (candidates.length === 0) continue;

    const [best] = candidates;
    const targets =
      best.group === undefined
        ? [best]
        : candidates.filter((item) => item.group === best.group);
    for (const target of targets) {
      const key = itemKey(target);
      if (claimedDistance.has(key) && claimedDistance.get(key) < distance)
        continue;
      claimedDistance.set(key, distance);
      jsdocMap.set(key, jsdoc);
    }
  }

  return { jsdocMap, itemKey };
}

export { collectJSDoc, matchJSDocToItems, parseJSDoc };
