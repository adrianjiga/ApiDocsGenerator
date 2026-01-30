/**
 * Generate Markdown documentation
 * @param {Array} apiData - Array of parsed API metadata
 * @returns {string} Markdown formatted documentation
 */
function generateMarkdown(apiData) {
  let md = '# API Documentation\n\n';
  md += `Generated: ${new Date().toISOString()}\n\n`;

  // Table of contents
  md += '## Table of Contents\n\n';
  
  let fileIndex = 1;
  apiData.forEach(file => {
    if (file.functions.length > 0 || file.routes.length > 0) {
      md += `${fileIndex}. [${file.fileName}](#${file.fileName.replace(/\W/g, '-').toLowerCase()})\n`;
      fileIndex++;
    }
  });

  md += '\n---\n\n';

  // Detailed documentation
  apiData.forEach(file => {
    if (file.functions.length === 0 && file.routes.length === 0) return;

    md += `## ${file.fileName}\n\n`;
    md += `**File:** \`${file.file}\`\n\n`;

    // Functions
    if (file.functions.length > 0) {
      md += '### Functions\n\n';
      
      file.functions.forEach(fn => {
        md += `#### \`${fn.name}(${fn.params.join(', ')})\`\n\n`;
        md += `**Line:** ${fn.line}\n\n`;
        
        if (fn.jsdoc) {
          md += `${fn.jsdoc.description}\n\n`;
          
          // Parameters
          if (fn.jsdoc.tags && fn.jsdoc.tags.length > 0) {
            const params = fn.jsdoc.tags.filter(t => t.tag === 'param');
            if (params.length > 0) {
              md += '**Parameters:**\n\n';
              params.forEach(param => {
                const cleanDesc = (param.description || '').replace(/^[\s\-]+/, '');
                md += `- \`${param.name}\` (\`${param.type || 'any'}\`): ${cleanDesc}\n`;
              });
              md += '\n';
            }

            // Returns
            const returns = fn.jsdoc.tags.filter(t => t.tag === 'returns' || t.tag === 'return');
            if (returns.length > 0) {
              md += '**Returns:**\n\n';
              returns.forEach(ret => {
                const cleanDesc = (ret.description || '').replace(/^[\s\-]+/, '');
                md += `- \`${ret.type || 'any'}\`: ${cleanDesc}\n`;
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
        md += `${fn.name}(${fn.params.map(p => `arg_${p}`).join(', ')});\n`;
        md += '```\n\n';
      });
    }

    // Routes
    if (file.routes.length > 0) {
      md += '### API Routes\n\n';
      
      file.routes.forEach(route => {
        md += `#### \`${route.method} ${route.path}\`\n\n`;
        md += `**Line:** ${route.line}\n\n`;
        
        if (route.params.length > 0) {
          md += `**Route Parameters:** ${route.params.join(', ')}\n\n`;
        }
        
        md += '**Example Request:**\n\n';
        md += '```bash\n';
        md += `curl -X ${route.method} http://localhost:3000${route.path}\n`;
        md += '```\n\n';
      });
    }
  });

  return md;
}

export { generateMarkdown };
