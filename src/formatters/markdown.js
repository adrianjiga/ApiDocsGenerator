import {
  describeParams,
  describeReturns,
  githubSlug,
  uniqueFileLabels,
} from '../utils.js';

/**
 * Type, optionality and default of a parameter, as shown after its name
 * @param {Object} param - Parameter from describeParams
 * @returns {string} e.g. "`number`, optional, default `1`"
 */
function paramMeta(param) {
  const parts = [`\`${param.type || 'any'}\``];
  if (param.optional) parts.push('optional');
  if (param.defaultValue !== undefined) {
    parts.push(`default \`${param.defaultValue}\``);
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
    md += `**File:** \`${file.fileName}\`\n\n`;

    // Functions
    if (file.functions.length > 0) {
      md += heading(3, 'Functions');

      file.functions.forEach((fn) => {
        md += heading(4, `\`${fn.name}(${fn.params.join(', ')})\``);
        md += `**Line:** ${fn.line}\n\n`;

        if (fn.jsdoc) {
          md += `${fn.jsdoc.description}\n\n`;
        } else {
          md += `**Description:** ${fn.description}\n\n`;
        }

        const params = describeParams(fn);
        if (params.length > 0) {
          md += '**Parameters:**\n\n';
          params.forEach((param) => {
            md += `- \`${param.name}\` (${paramMeta(param)})`;
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
            md += `- \`${ret.type || 'any'}\``;
            md += ret.description ? `: ${ret.description}\n` : '\n';
          });
          md += '\n';
        }

        md += '**Usage Example:**\n\n';
        md += '```javascript\n';
        md += `${fn.name}(${fn.params.join(', ')});\n`;
        md += '```\n\n';
      });
    }

    // Routes
    if (file.routes.length > 0) {
      md += heading(3, 'API Routes');

      file.routes.forEach((route) => {
        md += heading(4, `\`${route.method} ${route.path}\``);
        md += `**Line:** ${route.line}\n\n`;

        if (route.jsdoc?.description) {
          md += `${route.jsdoc.description}\n\n`;
        }

        if (route.params.length > 0) {
          md += `**Route Parameters:** ${route.params.join(', ')}\n\n`;
        }

        md += '**Example Request:**\n\n';
        md += '```bash\n';
        md += `curl -X ${route.method} ${config.serverUrl || 'http://localhost:3000'}${route.path}\n`;
        md += '```\n\n';
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
