import {
  curlCommand,
  describeExtras,
  describeParams,
  describeReturns,
  githubSlug,
  inlineLinks,
  uniqueFileLabels,
} from '../utils.js';

/**
 * Inline code span that survives backticks in the text, using a backtick run
 * longer than any inside it and padding with spaces when the text starts or
 * ends with a backtick
 * @param {string} text - Text to show as code
 * @returns {string} Markdown code span
 */
function inlineCode(text) {
  const longestRun = Math.max(
    0,
    ...Array.from(text.matchAll(/`+/g), (m) => m[0].length),
  );
  const fence = '`'.repeat(longestRun + 1);
  const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
  return `${fence}${pad}${text}${pad}${fence}`;
}

/**
 * Link text with the characters that would end it early escaped
 * @param {string} text - Link label
 * @returns {string} Escaped label
 */
function escapeLinkLabel(text) {
  return text.replace(/[\\[\]]/g, '\\$&');
}

/**
 * Render tag text with its inline {@link} references as Markdown links, or
 * as code when the target is not a URL
 * @param {string} text - Tag text
 * @returns {string} Markdown text
 */
function linkText(text) {
  return inlineLinks(text)
    .map((segment) => {
      if ('text' in segment) return segment.text;
      return segment.url
        ? `[${escapeLinkLabel(segment.label)}](${segment.target.replace(/[()]/g, (c) => (c === '(' ? '%28' : '%29'))})`
        : inlineCode(segment.label);
    })
    .join('');
}

/**
 * Fenced code block whose fence is longer than any backtick run in the code
 * @param {string} code - Code to fence
 * @param {string} language - Info string after the opening fence
 * @returns {string} Markdown code block
 */
function codeBlock(code, language) {
  const longestRun = Math.max(
    0,
    ...Array.from(code.matchAll(/`+/g), (m) => m[0].length),
  );
  const fence = '`'.repeat(Math.max(3, longestRun + 1));
  return `${fence}${language}\n${code}\n${fence}\n\n`;
}

/**
 * Deprecation notice for an item, or nothing when it is not deprecated
 * @param {Object} extras - Result of describeExtras
 * @returns {string} Markdown blockquote
 */
function deprecatedNotice(extras) {
  if (extras.deprecated === undefined) return '';
  return extras.deprecated
    ? `> **Deprecated:** ${linkText(extras.deprecated)}\n\n`
    : '> **Deprecated**\n\n';
}

/**
 * Throws and See also sections of an item
 * @param {Object} extras - Result of describeExtras
 * @returns {string} Markdown sections, empty when there is nothing to show
 */
function throwsAndSee(extras) {
  let md = '';
  if (extras.throws.length > 0) {
    md += '**Throws:**\n\n';
    for (const t of extras.throws) {
      const type = t.type ? inlineCode(t.type) : '';
      const separator = type && t.description ? ': ' : '';
      md += `- ${type}${separator}${linkText(t.description)}\n`;
    }
    md += '\n';
  }
  if (extras.see.length > 0) {
    md += '**See:**\n\n';
    for (const see of extras.see) md += `- ${linkText(see)}\n`;
    md += '\n';
  }
  return md;
}

/**
 * The item's own @example blocks
 * @param {Object} extras - Result of describeExtras
 * @param {string} language - Info string for the code fences
 * @returns {string} Markdown section, empty when there are no examples
 */
function examplesSection(extras, language) {
  if (extras.examples.length === 0) return '';
  let md =
    extras.examples.length > 1 ? '**Examples:**\n\n' : '**Example:**\n\n';
  for (const example of extras.examples) {
    if (example.caption) md += `_${example.caption}_\n\n`;
    md += codeBlock(example.code, language);
  }
  return md;
}

/**
 * Type, optionality and default of a parameter, as shown after its name
 * @param {Object} param - Parameter from describeParams
 * @returns {string} e.g. "`number`, optional, default `1`"
 */
function paramMeta(param) {
  const parts = [inlineCode(param.type || 'any')];
  if (param.optional) parts.push('optional');
  if (param.defaultValue !== undefined) {
    parts.push(`default ${inlineCode(param.defaultValue)}`);
  }
  return parts.join(', ');
}

/**
 * Compute the anchors GitHub gives a document's headings, in order. Repeated
 * slugs get -1, -2… suffixes across all headings, whatever their level.
 * @param {string[]} headings - Heading texts in document order
 * @returns {string[]} Anchor for each heading
 */
function githubAnchors(headings) {
  const counts = new Map();
  return headings.map((text) => {
    const slug = githubSlug(text);
    const seen = counts.get(slug) || 0;
    counts.set(slug, seen + 1);
    return seen === 0 ? slug : `${slug}-${seen}`;
  });
}

/**
 * Generate Markdown documentation
 * @param {Array} apiData - Array of parsed API metadata
 * @param {Object} [config] - Configuration; reads apiTitle and serverUrl
 * @returns {string} Markdown formatted documentation
 */
function generateMarkdown(apiData, config = {}) {
  const docTitle = config.apiTitle || 'API Documentation';
  const labels = uniqueFileLabels(apiData);
  const headings = [docTitle, 'Table of Contents'];
  const fileHeadingIndex = new Map();
  const heading = (level, text) => {
    headings.push(text);
    return `${'#'.repeat(level)} ${text}\n\n`;
  };

  let md = '';

  // Detailed documentation
  apiData.forEach((file) => {
    if (file.functions.length === 0 && file.routes.length === 0) return;

    const label = labels.get(file.file);
    fileHeadingIndex.set(file.file, headings.length);
    md += heading(2, label);
    md += `**File:** \`${file.relativePath ?? file.fileName}\`\n\n`;

    // Functions
    if (file.functions.length > 0) {
      md += heading(3, 'Functions');

      file.functions.forEach((fn) => {
        md += heading(4, `\`${fn.name}(${fn.params.join(', ')})\``);
        md += `**Line:** ${fn.line}\n\n`;

        const extras = describeExtras(fn);
        md += deprecatedNotice(extras);

        if (fn.jsdoc) {
          md += `${fn.jsdoc.description}\n\n`;
        } else {
          md += `**Description:** ${fn.description}\n\n`;
        }

        const params = describeParams(fn);
        if (params.length > 0) {
          md += '**Parameters:**\n\n';
          params.forEach((param) => {
            md += `- ${inlineCode(param.name)} (${paramMeta(param)})`;
            md += param.description ? `: ${param.description}\n` : '\n';
          });
          md += '\n';
        } else if (!fn.jsdoc) {
          md += '**Parameters:** none\n\n';
        }

        const returns = describeReturns(fn);
        if (returns.length > 0) {
          md += '**Returns:**\n\n';
          returns.forEach((ret) => {
            md += `- ${inlineCode(ret.type || 'any')}`;
            md += ret.description ? `: ${ret.description}\n` : '\n';
          });
          md += '\n';
        }

        md += throwsAndSee(extras);

        const examples = examplesSection(extras, 'javascript');
        if (examples) {
          md += examples;
        } else {
          md += '**Usage Example:**\n\n';
          md += codeBlock(`${fn.name}(${fn.params.join(', ')});`, 'javascript');
        }
      });
    }

    // Routes
    if (file.routes.length > 0) {
      md += heading(3, 'API Routes');

      file.routes.forEach((route) => {
        md += heading(4, `\`${route.method} ${route.path}\``);
        md += `**Line:** ${route.line}\n\n`;

        const extras = describeExtras(route);
        md += deprecatedNotice(extras);

        if (route.jsdoc?.description) {
          md += `${route.jsdoc.description}\n\n`;
        }

        if (route.params.length > 0) {
          md += `**Route Parameters:** ${route.params.join(', ')}\n\n`;
        }

        md += throwsAndSee(extras);

        const examples = examplesSection(extras, '');
        if (examples) {
          md += examples;
        } else {
          md += '**Example Request:**\n\n';
          md += codeBlock(
            curlCommand(
              route.method,
              `${config.serverUrl || 'http://localhost:3000'}${route.path}`,
            ),
            'bash',
          );
        }
      });
    }
  });

  const anchors = githubAnchors(headings);
  let toc = '';
  let fileIndex = 1;
  for (const [filePath, index] of fileHeadingIndex) {
    toc += `${fileIndex}. [${labels.get(filePath)}](#${anchors[index]})\n`;
    fileIndex++;
  }

  return `# ${docTitle}

Generated: ${new Date().toISOString()}

## Table of Contents

${toc}
---

${md}`;
}

export { generateMarkdown };
