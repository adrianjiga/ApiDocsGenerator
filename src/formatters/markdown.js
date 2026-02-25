import {
  getParamTags,
  getReturnTags,
  cleanTagDescription,
  sanitizeHtmlId,
} from '../utils.js';

/**
 * Generate Markdown documentation
 * @param {Array} apiData - Array of parsed API metadata
 * @returns {string} Markdown formatted documentation
 */
function generateMarkdown(apiData, config = {}) {
  const docTitle = config.apiTitle || 'API Documentation';
  let md = `# ${docTitle}\n\n`;
  md += `Generated: ${new Date().toISOString()}\n\n`;

  // Table of contents
  md += '## Table of Contents\n\n';

  let fileIndex = 1;
  apiData.forEach((file) => {
    if (file.functions.length > 0 || file.routes.length > 0) {
      md += `${fileIndex}. [${file.fileName}](#${sanitizeHtmlId(file.fileName)})\n`;
      fileIndex++;
    }
  });

  md += '\n---\n\n';

  // Detailed documentation
  apiData.forEach((file) => {
    if (file.functions.length === 0 && file.routes.length === 0) return;

    md += `## ${file.fileName}\n\n`;
    md += `**File:** \`${file.file}\`\n\n`;

    // Functions
    if (file.functions.length > 0) {
      md += '### Functions\n\n';

      file.functions.forEach((fn) => {
        md += `#### \`${fn.name}(${fn.params.join(', ')})\`\n\n`;
        md += `**Line:** ${fn.line}\n\n`;

        if (fn.jsdoc) {
          md += `${fn.jsdoc.description}\n\n`;

          // Parameters
          if (fn.jsdoc.tags && fn.jsdoc.tags.length > 0) {
            const params = getParamTags(fn.jsdoc.tags);
            if (params.length > 0) {
              md += '**Parameters:**\n\n';
              params.forEach((param) => {
                md += `- \`${param.name}\` (\`${param.type || 'any'}\`): ${cleanTagDescription(param.description)}\n`;
              });
              md += '\n';
            }

            // Returns
            const returns = getReturnTags(fn.jsdoc.tags);
            if (returns.length > 0) {
              md += '**Returns:**\n\n';
              returns.forEach((ret) => {
                md += `- \`${ret.type || 'any'}\`: ${cleanTagDescription(ret.description)}\n`;
              });
              md += '\n';
            }
          }
        } else {
          md += `**Description:** ${fn.description}\n\n`;
          md += `**Parameters:** ${fn.params.join(', ') || 'none'}\n\n`;
        }

        md += '**Usage Example:**\n\n';
        md += '```javascript\n';
        md += `${fn.name}(${fn.params.join(', ')});\n`;
        md += '```\n\n';
      });
    }

    // Routes
    if (file.routes.length > 0) {
      md += '### API Routes\n\n';

      file.routes.forEach((route) => {
        md += `#### \`${route.method} ${route.path}\`\n\n`;
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

  return md;
}

export { generateMarkdown };
