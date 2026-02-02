import { escapeHtml, sanitizeHtmlId } from '../utils.js';

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

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
      }
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #f8fafc;
      background: linear-gradient(135deg, #0a0a0f 0%, #13131a 50%, #0f1419 100%);
      position: relative;
      overflow-x: hidden;
    }

    body::before {
      content: '';
      position: fixed;
      top: -40%;
      right: -20%;
      width: 600px;
      height: 600px;
      background: radial-gradient(circle, #6366f1 0%, rgba(99, 102, 241, 0) 70%);
      border-radius: 50%;
      opacity: 0.08;
      filter: blur(80px);
      pointer-events: none;
      z-index: 0;
      animation: float-orb 8s ease-in-out infinite;
    }

    body::after {
      content: '';
      position: fixed;
      bottom: -30%;
      left: -15%;
      width: 500px;
      height: 500px;
      background: radial-gradient(circle, #8b5cf6 0%, rgba(139, 92, 246, 0) 70%);
      border-radius: 50%;
      opacity: 0.06;
      filter: blur(80px);
      pointer-events: none;
      z-index: 0;
      animation: float-orb-alt 10s ease-in-out infinite;
    }

    @keyframes float-orb {
      0%, 100% { transform: translate(0, 0); }
      50% { transform: translate(40px, -40px); }
    }

    @keyframes float-orb-alt {
      0%, 100% { transform: translate(0, 0); }
      50% { transform: translate(-30px, 30px); }
    }

    @keyframes fadeInDown {
      from { opacity: 0; transform: translateY(-20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes stagger-1 { animation-delay: 0ms; }
    @keyframes stagger-2 { animation-delay: 100ms; }
    @keyframes stagger-3 { animation-delay: 200ms; }

    .container { max-width: 1200px; margin: 0 auto; padding: 2rem; position: relative; z-index: 1; }

    header {
      background: linear-gradient(135deg, #1a1a24 0%, #202535 100%);
      color: white;
      padding: 3rem 2rem;
      margin: -2rem -2rem 3rem -2rem;
      border-radius: 0;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
      text-align: center;
      border-bottom: 1px solid rgba(99, 102, 241, 0.2);
      animation: fadeInDown 0.6s ease;
    }

    header h1 {
      font-size: 2.618rem;
      margin-bottom: 0.75rem;
      font-weight: 700;
      letter-spacing: -0.5px;
    }

    header p {
      font-size: 0.875rem;
      opacity: 0.75;
      letter-spacing: 0.5px;
    }

    nav {
      background: linear-gradient(135deg, #13131a 0%, #1a1a24 100%);
      padding: 1.5rem;
      margin-bottom: 2rem;
      border-radius: 0.875rem;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(99, 102, 241, 0.1);
      backdrop-filter: blur(10px);
      animation: fadeInUp 0.6s ease;
    }

    nav h2 {
      font-size: 1.25rem;
      margin-bottom: 1rem;
      color: #6366f1;
      font-weight: 700;
    }

    nav ul { list-style: none; }

    nav li { margin: 0.5rem 0; }

    nav a {
      color: #a5f3fc;
      text-decoration: none;
      transition: all 0.2s ease;
      font-weight: 500;
      display: inline-block;
      padding: 0.375rem 0;
      border-bottom: 2px solid transparent;
    }

    nav a:hover {
      color: #6366f1;
      border-bottom-color: #6366f1;
    }

    .file-section {
      background: linear-gradient(135deg, #13131a 0%, #1a1a24 100%);
      padding: 2rem;
      margin-bottom: 1.5rem;
      border-radius: 0.875rem;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(99, 102, 241, 0.1);
      transition: all 0.3s ease;
      animation: fadeInUp 0.6s ease;
    }

    .file-section:hover {
      border-color: rgba(99, 102, 241, 0.2);
      box-shadow: 0 12px 48px rgba(99, 102, 241, 0.15);
      transform: translateY(-2px);
    }

    .file-section h2 {
      color: #f8fafc;
      margin-bottom: 0.75rem;
      padding-bottom: 0.75rem;
      border-bottom: 2px solid rgba(99, 102, 241, 0.2);
      font-size: 1.618rem;
      font-weight: 700;
    }

    .file-path {
      color: #94a3b8;
      font-size: 0.8125rem;
      font-family: 'Courier New', monospace;
      margin-bottom: 1.5rem;
      font-weight: 500;
      letter-spacing: 0.5px;
    }

    .subsection { margin-top: 2rem; }

    .subsection h3 {
      color: #6366f1;
      margin-bottom: 1rem;
      font-size: 1.25rem;
      font-weight: 700;
      letter-spacing: -0.3px;
    }

    .item {
      background: rgba(99, 102, 241, 0.05);
      padding: 1.5rem;
      margin-bottom: 1rem;
      border-left: 4px solid #6366f1;
      border-radius: 0.5rem;
      transition: all 0.3s ease;
      border: 1px solid rgba(99, 102, 241, 0.1);
      border-left: 4px solid #6366f1;
    }

    .item:hover {
      background: rgba(99, 102, 241, 0.1);
      border-color: rgba(99, 102, 241, 0.2);
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.1);
      transform: translateX(4px);
    }

    .item h4 {
      color: #f8fafc;
      margin-bottom: 0.75rem;
      font-family: 'Courier New', monospace;
      font-weight: 600;
    }

    .meta {
      color: #94a3b8;
      font-size: 0.8125rem;
      margin-bottom: 0.75rem;
      font-weight: 500;
    }

    .description {
      margin: 0.75rem 0;
      font-style: italic;
      color: #cbd5e1;
    }

    .params, .returns { margin: 0.75rem 0; }

    .params h5, .returns h5 {
      color: #10b981;
      font-size: 0.875rem;
      margin-bottom: 0.75rem;
      margin-top: 1rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .param-item {
      background: rgba(16, 185, 129, 0.05);
      padding: 0.75rem 1rem;
      margin: 0.375rem 0;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      border-left: 3px solid #10b981;
      border: 1px solid rgba(16, 185, 129, 0.15);
      border-left: 3px solid #10b981;
      transition: all 0.2s ease;
    }

    .param-item:hover {
      background: rgba(16, 185, 129, 0.1);
      border-color: rgba(16, 185, 129, 0.3);
    }

    .param-name {
      color: #10b981;
      font-weight: bold;
      font-family: 'Courier New', monospace;
    }

    .method-badge {
      display: inline-block;
      padding: 0.375rem 0.75rem;
      border-radius: 0.375rem;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: white;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
      transition: all 0.2s ease;
    }

    .method-badge:hover {
      box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4);
      transform: translateY(-2px);
    }

    .code-block {
      background: linear-gradient(135deg, #0a0a0f 0%, #13131a 100%);
      color: #a5f3fc;
      padding: 1.5rem;
      border-radius: 0.5rem;
      overflow-x: auto;
      margin: 0.75rem 0;
      font-family: 'Courier New', monospace;
      font-size: 0.875rem;
      border: 1px solid rgba(99, 102, 241, 0.1);
      box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.3);
    }

    footer {
      text-align: center;
      padding: 1.5rem;
      color: #64748b;
      font-size: 0.8125rem;
      margin-top: 3rem;
      border-top: 1px solid rgba(99, 102, 241, 0.1);
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>📚 API Documentation</h1>
      <p>Auto-generated documentation • ${timestamp}</p>
    </header>`;

  // Table of contents
  const fileSections = apiData.filter(
    (f) => f.functions.length > 0 || f.routes.length > 0,
  );

  if (fileSections.length > 0) {
    html += `
    <nav>
      <h2>📖 Table of Contents</h2>
      <ul>`;

    fileSections.forEach((file) => {
      html += `<li><a href="#${sanitizeHtmlId(file.fileName)}">${escapeHtml(file.fileName)}</a></li>`;
    });

    html += `
      </ul>
    </nav>`;
  }

  // Detailed documentation
  fileSections.forEach((file) => {
    html += `
    <div class="file-section" id="${sanitizeHtmlId(file.fileName)}">
      <h2>${escapeHtml(file.fileName)}</h2>
      <div class="file-path">📁 ${escapeHtml(file.file)}</div>`;

    // Functions
    if (file.functions.length > 0) {
      html += `<div class="subsection">
        <h3>Functions</h3>`;

      file.functions.forEach((fn) => {
        html += `
        <div class="item">
          <h4>${escapeHtml(fn.name)}(${fn.params.map((p) => escapeHtml(p)).join(', ')})</h4>
          <div class="meta">📍 Line ${fn.line}</div>`;

        if (fn.jsdoc) {
          html += `<div class="description">${escapeHtml(fn.jsdoc.description)}</div>`;

          if (fn.jsdoc.tags && fn.jsdoc.tags.length > 0) {
            const params = fn.jsdoc.tags.filter((t) => t.tag === 'param');
            if (params.length > 0) {
              html += `<div class="params">
                <h5>📥 Parameters</h5>`;
              params.forEach((param) => {
                const cleanDesc = (param.description || '').replace(
                  /^[\s-]+/,
                  '',
                );
                html += `<div class="param-item"><span class="param-name">${escapeHtml(param.name)}</span> <code>${escapeHtml(param.type || 'any')}</code> — ${escapeHtml(cleanDesc)}</div>`;
              });
              html += `</div>`;
            }

            const returns = fn.jsdoc.tags.filter(
              (t) => t.tag === 'returns' || t.tag === 'return',
            );
            if (returns.length > 0) {
              html += `<div class="returns">
                <h5>📤 Returns</h5>`;
              returns.forEach((ret) => {
                const cleanDesc = (ret.description || '').replace(
                  /^[\s-]+/,
                  '',
                );
                html += `<div class="param-item"><code>${escapeHtml(ret.type || 'any')}</code> — ${escapeHtml(cleanDesc)}</div>`;
              });
              html += `</div>`;
            }
          }
        } else {
          html += `<div class="description">${escapeHtml(fn.description)}</div>`;
        }

        html += `
          <h5 style="margin-top: 15px;">💡 Usage Example</h5>
          <div class="code-block">${escapeHtml(fn.name)}(${fn.params.map((p) => `arg_${escapeHtml(p)}`).join(', ')});</div>
        </div>`;
      });

      html += `</div>`;
    }

    // Routes
    if (file.routes.length > 0) {
      html += `<div class="subsection">
        <h3>API Routes</h3>`;

      file.routes.forEach((route) => {
        html += `
        <div class="item">
          <h4><span class="method-badge">${escapeHtml(route.method)}</span> ${escapeHtml(route.path)}</h4>
          <div class="meta">📍 Line ${route.line}</div>`;

        if (route.params.length > 0) {
          html += `<div class="params">
            <h5>📥 Route Parameters</h5>
            <div class="param-item">${route.params.map((p) => escapeHtml(p)).join(', ')}</div>
          </div>`;
        }

        html += `
          <h5 style="margin-top: 15px;">💡 Example Request</h5>
          <div class="code-block">curl -X ${escapeHtml(route.method)} http://localhost:3000${escapeHtml(route.path)}</div>
        </div>`;
      });

      html += `</div>`;
    }

    html += `</div>`;
  });

  html += `
    <footer>
      <p>Generated by api-docs-generator • ${timestamp}</p>
    </footer>
  </div>
</body>
</html>`;

  return html;
}

export { generateHTML };
