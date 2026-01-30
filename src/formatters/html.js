/**
 * Generate HTML documentation
 * @param {Array} apiData - Array of parsed API metadata
 * @returns {string} HTML formatted documentation
 */
function generateHTML(apiData) {
  const timestamp = new Date().toISOString();
  
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Documentation</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    header { background: linear-gradient(135deg, #339933 0%, #226B2B 100%); color: white; padding: 40px 20px; margin: -20px -20px 40px -20px; border-radius: 8px 8px 0 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center; }
    header h1 { font-size: 2.5em; margin-bottom: 10px; }
    header p { font-size: 1.1em; opacity: 0.9; }
    nav { background: white; padding: 20px; margin-bottom: 30px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    nav h2 { font-size: 1.3em; margin-bottom: 15px; color: #339933; }
    nav ul { list-style: none; }
    nav li { margin: 8px 0; }
    nav a { color: #3178C6; text-decoration: none; transition: color 0.3s; }
    nav a:hover { color: #339933; text-decoration: underline; }
    .file-section { background: white; padding: 30px; margin-bottom: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .file-section h2 { color: #339933; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 2px solid #e0e0e0; }
    .file-path { color: #666; font-size: 0.9em; font-family: 'Courier New', monospace; margin-bottom: 20px; }
    .subsection { margin-top: 30px; }
    .subsection h3 { color: #3178C6; margin-bottom: 15px; font-size: 1.3em; }
    .item { background: #f9f9f9; padding: 15px; margin-bottom: 15px; border-left: 4px solid #339933; border-radius: 4px; }
    .item h4 { color: #333; margin-bottom: 10px; font-family: 'Courier New', monospace; }
    .meta { color: #666; font-size: 0.9em; margin-bottom: 10px; }
    .description { margin: 10px 0; font-style: italic; color: #555; }
    .params, .returns { margin: 10px 0; }
    .params h5, .returns h5 { color: #339933; font-size: 0.95em; margin-bottom: 8px; margin-top: 10px; font-weight: 600; }
    .param-item { background: white; padding: 8px 12px; margin: 5px 0; border-radius: 4px; font-size: 0.9em; border-left: 3px solid #3178C6; }
    .param-name { color: #339933; font-weight: bold; font-family: 'Courier New', monospace; }
    .code-block { background: #2d2d2d; color: #f8f8f2; padding: 15px; border-radius: 4px; overflow-x: auto; margin: 10px 0; font-family: 'Courier New', monospace; font-size: 0.9em; }
    footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>📚 API Documentation</h1>
      <p>Auto-generated documentation • ${timestamp}</p>
    </header>`;

  // Table of contents
  const fileSections = apiData.filter(f => f.functions.length > 0 || f.routes.length > 0);
  
  if (fileSections.length > 0) {
    html += `
    <nav>
      <h2>📖 Table of Contents</h2>
      <ul>`;
    
    fileSections.forEach(file => {
      html += `<li><a href="#${sanitizeId(file.fileName)}">${file.fileName}</a></li>`;
    });
    
    html += `
      </ul>
    </nav>`;
  }

  // Detailed documentation
  fileSections.forEach(file => {
    html += `
    <div class="file-section" id="${sanitizeId(file.fileName)}">
      <h2>${file.fileName}</h2>
      <div class="file-path">📁 ${file.file}</div>`;

    // Functions
    if (file.functions.length > 0) {
      html += `<div class="subsection">
        <h3>Functions</h3>`;
      
      file.functions.forEach(fn => {
        html += `
        <div class="item">
          <h4>${fn.name}(${fn.params.join(', ')})</h4>
          <div class="meta">📍 Line ${fn.line}</div>`;
        
        if (fn.jsdoc) {
          html += `<div class="description">${fn.jsdoc.description}</div>`;
          
          if (fn.jsdoc.tags && fn.jsdoc.tags.length > 0) {
            const params = fn.jsdoc.tags.filter(t => t.tag === 'param');
            if (params.length > 0) {
              html += `<div class="params">
                <h5>📥 Parameters</h5>`;
              params.forEach(param => {
                const cleanDesc = (param.description || '').replace(/^[\s\-]+/, '');
                html += `<div class="param-item"><span class="param-name">${param.name}</span> <code>${param.type || 'any'}</code> — ${cleanDesc}</div>`;
              });
              html += `</div>`;
            }

            const returns = fn.jsdoc.tags.filter(t => t.tag === 'returns' || t.tag === 'return');
            if (returns.length > 0) {
              html += `<div class="returns">
                <h5>📤 Returns</h5>`;
              returns.forEach(ret => {
                const cleanDesc = (ret.description || '').replace(/^[\s\-]+/, '');
                html += `<div class="param-item"><code>${ret.type || 'any'}</code> — ${cleanDesc}</div>`;
              });
              html += `</div>`;
            }
          }
        } else {
          html += `<div class="description">${fn.description}</div>`;
        }

        html += `
          <h5 style="margin-top: 15px;">💡 Usage Example</h5>
          <div class="code-block">${fn.name}(${fn.params.map(p => `arg_${p}`).join(', ')});</div>
        </div>`;
      });
      
      html += `</div>`;
    }

    // Routes
    if (file.routes.length > 0) {
      html += `<div class="subsection">
        <h3>API Routes</h3>`;
      
      file.routes.forEach(route => {
        html += `
        <div class="item">
          <h4><span style="background: #667eea; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.85em;">${route.method}</span> ${route.path}</h4>
          <div class="meta">📍 Line ${route.line}</div>`;
        
        if (route.params.length > 0) {
          html += `<div class="params">
            <h5>📥 Route Parameters</h5>
            <div class="param-item">${route.params.join(', ')}</div>
          </div>`;
        }
        
        html += `
          <h5 style="margin-top: 15px;">💡 Example Request</h5>
          <div class="code-block">curl -X ${route.method} http://localhost:3000${route.path}</div>
        </div>`;
      });
      
      html += `</div>`;
    }

    html += `</div>`;
  });

  html += `
    <footer>
      <p>Generated by api-doc-gen • ${timestamp}</p>
    </footer>
  </div>
</body>
</html>`;

  return html;
}

/**
 * Sanitize filename for use as HTML id
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
function sanitizeId(str) {
  return str.replace(/\W+/g, '-').toLowerCase();
}

export { generateHTML };
