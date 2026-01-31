/**
 * Generate a self-contained HTML dashboard showing documentation coverage
 * @param {Object} report - Coverage analysis report from analyzeCoverage()
 * @returns {string} Self-contained HTML dashboard
 */
function generateDashboard(report) {
  const { summary, files, gaps } = report;
  const coverage = summary.coveragePercentage;
  
  // Determine gauge color based on coverage
  let gaugeColor = '#ff4444'; // red < 50
  if (coverage >= 80) gaugeColor = '#44bb44'; // green >= 80
  else if (coverage >= 50) gaugeColor = '#ffaa44'; // yellow 50-80

  const gapRows = gaps
    .map(gap => `
      <tr>
        <td class="gap-file">${escapeHtml(gap.fileName)}</td>
        <td class="gap-type"><span class="type-badge type-${gap.type}">${gap.type}</span></td>
        <td class="gap-name">${escapeHtml(gap.name)}</td>
        <td class="gap-line">${gap.line}</td>
        <td class="gap-severity"><span class="severity-${gap.severity}">${gap.severity}</span></td>
        <td class="gap-missing">${gap.missing.join(', ')}</td>
      </tr>
    `)
    .join('');

  const fileRows = files
    .map(file => `
      <tr>
        <td class="file-name">${escapeHtml(file.fileName)}</td>
        <td class="file-items">${file.totalItems}</td>
        <td class="file-documented">${file.documentedItems}</td>
        <td class="file-coverage">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${file.coveragePercentage}%; background-color: ${getCoverageColor(file.coveragePercentage)};"></div>
          </div>
          <span class="coverage-text">${file.coveragePercentage}%</span>
        </td>
      </tr>
    `)
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Documentation Coverage Dashboard</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background-color: #1a1a2e;
      color: #e0e0e0;
      line-height: 1.6;
      padding: 20px;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
    }

    header {
      margin-bottom: 40px;
      text-align: center;
    }

    h1 {
      font-size: 2.5rem;
      margin-bottom: 10px;
      color: #ffffff;
    }

    .subtitle {
      color: #a0a0a0;
      font-size: 1rem;
    }

    .dashboard {
      display: grid;
      grid-template-columns: 1fr 2fr;
      gap: 30px;
      margin-bottom: 40px;
    }

    .gauge-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background-color: #16213e;
      border-radius: 12px;
      padding: 30px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    }

    svg.gauge {
      width: 200px;
      height: 200px;
      margin-bottom: 20px;
    }

    .gauge-label {
      text-align: center;
    }

    .gauge-percentage {
      font-size: 3rem;
      font-weight: bold;
      color: ${gaugeColor};
      margin-bottom: 5px;
    }

    .gauge-text {
      color: #a0a0a0;
      font-size: 0.9rem;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
    }

    .stat-card {
      background-color: #16213e;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
      border-left: 4px solid #44bb44;
    }

    .stat-card.warning {
      border-left-color: #ffaa44;
    }

    .stat-card.error {
      border-left-color: #ff4444;
    }

    .stat-label {
      color: #a0a0a0;
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 10px;
    }

    .stat-value {
      font-size: 2rem;
      font-weight: bold;
      color: #ffffff;
    }

    .stat-detail {
      color: #707070;
      font-size: 0.85rem;
      margin-top: 8px;
    }

    .section {
      margin-bottom: 40px;
    }

    .section-title {
      font-size: 1.5rem;
      margin-bottom: 20px;
      color: #ffffff;
      border-bottom: 2px solid #44bb44;
      padding-bottom: 10px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      background-color: #16213e;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    }

    th {
      background-color: #0f3460;
      padding: 15px;
      text-align: left;
      font-weight: 600;
      color: #44bb44;
      text-transform: uppercase;
      font-size: 0.85rem;
      letter-spacing: 0.5px;
    }

    td {
      padding: 12px 15px;
      border-bottom: 1px solid #2a2a4e;
    }

    tr:hover {
      background-color: #1a2540;
    }

    tr:last-child td {
      border-bottom: none;
    }

    .type-badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
    }

    .type-function {
      background-color: rgba(68, 187, 68, 0.2);
      color: #44bb44;
    }

    .type-route {
      background-color: rgba(100, 150, 255, 0.2);
      color: #6496ff;
    }

    .severity-error {
      color: #ff4444;
      font-weight: bold;
    }

    .severity-warning {
      color: #ffaa44;
      font-weight: bold;
    }

    .gap-file {
      color: #44bb44;
      font-family: 'Courier New', monospace;
      font-size: 0.9rem;
    }

    .gap-name {
      font-family: 'Courier New', monospace;
    }

    .progress-bar {
      width: 100%;
      height: 8px;
      background-color: #0f3460;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 8px;
    }

    .progress-fill {
      height: 100%;
      transition: width 0.3s ease;
    }

    .coverage-text {
      font-size: 0.85rem;
      color: #a0a0a0;
    }

    .file-name {
      color: #44bb44;
      font-weight: 500;
    }

    .empty-state {
      text-align: center;
      padding: 40px;
      color: #707070;
    }

    .empty-state-icon {
      font-size: 3rem;
      margin-bottom: 15px;
    }

    footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #2a2a4e;
      color: #707070;
      font-size: 0.85rem;
      text-align: center;
    }

    @media (max-width: 768px) {
      .dashboard {
        grid-template-columns: 1fr;
      }

      h1 {
        font-size: 1.8rem;
      }

      .gauge-percentage {
        font-size: 2.5rem;
      }

      svg.gauge {
        width: 150px;
        height: 150px;
      }

      table {
        font-size: 0.85rem;
      }

      td, th {
        padding: 8px 10px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>📊 Documentation Coverage Dashboard</h1>
      <p class="subtitle">Generated: ${new Date().toLocaleString()}</p>
    </header>

    <div class="dashboard">
      <div class="gauge-container">
        <svg class="gauge" viewBox="0 0 200 200">
          <!-- Background circle -->
          <circle cx="100" cy="100" r="90" fill="none" stroke="#2a2a4e" stroke-width="8"/>
          
          <!-- Gauge arc -->
          <circle
            cx="100"
            cy="100"
            r="90"
            fill="none"
            stroke="${gaugeColor}"
            stroke-width="8"
            stroke-dasharray="${coverage * 5.65} 565"
            stroke-dashoffset="0"
            stroke-linecap="round"
            style="transform: rotate(-90deg); transform-origin: 100px 100px; transition: stroke-dasharray 0.5s ease;"
          />
          
          <!-- Center circle -->
          <circle cx="100" cy="100" r="60" fill="#16213e"/>
        </svg>
        
        <div class="gauge-label">
          <div class="gauge-percentage">${coverage}%</div>
          <div class="gauge-text">Overall Coverage</div>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card ${summary.functionCoverage >= 80 ? '' : summary.functionCoverage >= 50 ? 'warning' : 'error'}">
          <div class="stat-label">Function Coverage</div>
          <div class="stat-value">${summary.functionCoverage}%</div>
          <div class="stat-detail">${summary.documentedFunctions} of ${summary.totalFunctions}</div>
        </div>

        <div class="stat-card ${summary.routeCoverage >= 80 ? '' : summary.routeCoverage >= 50 ? 'warning' : 'error'}">
          <div class="stat-label">Route Coverage</div>
          <div class="stat-value">${summary.routeCoverage}%</div>
          <div class="stat-detail">${summary.documentedRoutes} of ${summary.totalRoutes}</div>
        </div>

        <div class="stat-card ${gaps.length === 0 ? '' : 'error'}">
          <div class="stat-label">Documentation Gaps</div>
          <div class="stat-value">${gaps.length}</div>
          <div class="stat-detail">${gaps.length === 0 ? 'Perfect coverage!' : 'items need attention'}</div>
        </div>
      </div>
    </div>

    ${gaps.length > 0 ? `
    <div class="section">
      <h2 class="section-title">Documentation Gaps</h2>
      <table>
        <thead>
          <tr>
            <th>File</th>
            <th>Type</th>
            <th>Name</th>
            <th>Line</th>
            <th>Severity</th>
            <th>Missing</th>
          </tr>
        </thead>
        <tbody>
          ${gapRows}
        </tbody>
      </table>
    </div>
    ` : `
    <div class="section">
      <h2 class="section-title">Documentation Gaps</h2>
      <div class="empty-state">
        <div class="empty-state-icon">✓</div>
        <p>Perfect documentation coverage! No gaps found.</p>
      </div>
    </div>
    `}

    ${files.length > 0 ? `
    <div class="section">
      <h2 class="section-title">Per-File Coverage</h2>
      <table>
        <thead>
          <tr>
            <th>File</th>
            <th>Total Items</th>
            <th>Documented</th>
            <th>Coverage</th>
          </tr>
        </thead>
        <tbody>
          ${fileRows}
        </tbody>
      </table>
    </div>
    ` : ''}

    <footer>
      <p>Generated by api-docs-generator</p>
    </footer>
  </div>
</body>
</html>`;
}

/**
 * Get color based on coverage percentage
 */
function getCoverageColor(percentage) {
  if (percentage >= 80) return '#44bb44'; // green
  if (percentage >= 50) return '#ffaa44'; // yellow
  return '#ff4444'; // red
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

export { generateDashboard };
