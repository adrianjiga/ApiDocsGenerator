import { escapeHtml } from '../utils.js';
import { BASE_CSS } from './shared-styles.js';

/**
 * Get color based on coverage percentage
 * @param {number} percentage - Coverage percentage
 * @returns {string} Hex color code
 */
function getCoverageColor(percentage) {
  if (percentage >= 80) return '#44bb44'; // green
  if (percentage >= 50) return '#ffaa44'; // yellow
  return '#ff4444'; // red
}

/**
 * Generate a self-contained HTML dashboard showing documentation coverage
 * @param {Object} report - Coverage analysis report from analyzeCoverage()
 * @returns {string} Self-contained HTML dashboard
 */
/** SVG gauge circle radius. The circumference is 2 * PI * GAUGE_RADIUS. */
const GAUGE_RADIUS = 90;
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS;

function generateDashboard(report) {
  const { summary, files, gaps } = report;
  const coverage = summary.coveragePercentage;

  const gaugeColor = getCoverageColor(coverage);

  /**
   * Generate documentation gap rows
   * @returns {string} HTML rows for documentation gaps
   */
  const gapRows = gaps
    .map(
      (gap) => `
      <tr>
        <td class="gap-file">${escapeHtml(gap.fileName)}</td>
        <td class="gap-type"><span class="type-badge type-${gap.type}">${gap.type}</span></td>
        <td class="gap-name">${escapeHtml(gap.name)}</td>
        <td class="gap-line">${gap.line}</td>
        <td class="gap-severity"><span class="severity-${gap.severity}">${gap.severity}</span></td>
        <td class="gap-missing">${escapeHtml(gap.missing.join(', '))}</td>
      </tr>
    `,
    )
    .join('');

  /**
   * Generate per-file coverage rows
   * @returns {string} HTML rows for per-file coverage
   */
  const fileRows = files
    .map(
      (file) => `
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
    `,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Documentation Coverage Dashboard</title>
  <style>
    ${BASE_CSS}

    body { padding: 2rem; }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      position: relative;
      z-index: 1;
    }

    header {
      margin-bottom: 3rem;
      text-align: center;
      animation: fadeInDown 0.6s ease;
    }

    h1 {
      font-size: 2.618rem;
      margin-bottom: 0.75rem;
      color: #f8fafc;
      font-weight: 700;
      letter-spacing: -0.5px;
    }

    .subtitle {
      color: #94a3b8;
      font-size: 0.875rem;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    .dashboard {
      display: grid;
      grid-template-columns: 1fr 2fr;
      gap: 2rem;
      margin-bottom: 3rem;
    }

    .gauge-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #13131a 0%, #1a1a24 100%);
      border: 1px solid rgba(99, 102, 241, 0.1);
      border-radius: 1rem;
      padding: 2rem;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(10px);
      transition: all 0.3s ease;
      position: relative;
      overflow: hidden;
    }

    .gauge-container::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, transparent 100%);
      pointer-events: none;
    }

    .gauge-container:hover {
      border-color: rgba(99, 102, 241, 0.2);
      box-shadow: 0 12px 48px rgba(99, 102, 241, 0.15);
      transform: translateY(-2px);
    }

    svg.gauge {
      width: 200px;
      height: 200px;
      margin-bottom: 1.25rem;
      filter: drop-shadow(0 4px 12px rgba(99, 102, 241, 0.1));
    }

    .gauge-label {
      text-align: center;
      position: relative;
      z-index: 1;
    }

    .gauge-percentage {
      font-size: 4.236rem;
      font-weight: 700;
      color: ${gaugeColor};
      margin-bottom: 0.375rem;
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    }

    .gauge-text {
      color: #94a3b8;
      font-size: 0.875rem;
      letter-spacing: 0.5px;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1.5rem;
    }

    .stat-card {
      background: linear-gradient(135deg, #13131a 0%, #1a1a24 100%);
      border: 1px solid rgba(99, 102, 241, 0.1);
      border-radius: 0.875rem;
      padding: 1.5rem;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
    }

    .stat-card::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, transparent 100%);
      opacity: 0;
      transition: opacity 0.3s ease;
      pointer-events: none;
    }

    .stat-card:hover {
      border-color: rgba(99, 102, 241, 0.3);
      box-shadow: 0 12px 32px rgba(99, 102, 241, 0.15);
      transform: translateY(-4px);
    }

    .stat-card:hover::before {
      opacity: 1;
    }

    .stat-card.warning {
      --accent-color: #f59e0b;
    }

    .stat-card.warning:hover {
      border-color: rgba(245, 158, 11, 0.3);
      box-shadow: 0 12px 32px rgba(245, 158, 11, 0.15);
    }

    .stat-card.error {
      --accent-color: #ef4444;
    }

    .stat-card.error:hover {
      border-color: rgba(239, 68, 68, 0.3);
      box-shadow: 0 12px 32px rgba(239, 68, 68, 0.15);
    }

    .stat-label {
      color: #94a3b8;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 0.75rem;
      font-weight: 600;
    }

    .stat-value {
      font-size: 2.618rem;
      font-weight: 700;
      color: #f8fafc;
      position: relative;
      z-index: 1;
    }

    .stat-detail {
      color: #64748b;
      font-size: 0.8125rem;
      margin-top: 0.5rem;
      font-weight: 500;
    }

    .section {
      margin-bottom: 3rem;
      animation: fadeInUp 0.6s ease;
    }

    .section-title {
      font-size: 1.618rem;
      margin-bottom: 1.5rem;
      color: #f8fafc;
      padding-bottom: 0.75rem;
      border-bottom: 2px solid;
      border-image: linear-gradient(90deg, #6366f1, #8b5cf6) 1;
      font-weight: 700;
      letter-spacing: -0.3px;
    }

    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      background: linear-gradient(135deg, #13131a 0%, #1a1a24 100%);
      border: 1px solid rgba(99, 102, 241, 0.1);
      border-radius: 0.875rem;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    }

    th {
      background: linear-gradient(90deg, #1a1a24 0%, #202535 100%);
      padding: 1rem;
      text-align: left;
      font-weight: 600;
      color: #6366f1;
      text-transform: uppercase;
      font-size: 0.75rem;
      letter-spacing: 0.5px;
      border-bottom: 1px solid rgba(99, 102, 241, 0.15);
    }

    td {
      padding: 1rem;
      border-bottom: 1px solid rgba(99, 102, 241, 0.05);
      transition: background-color 0.2s ease;
    }

    tr:hover td {
      background-color: rgba(99, 102, 241, 0.05);
    }

    tr:last-child td {
      border-bottom: none;
    }

    .type-badge {
      display: inline-block;
      padding: 0.375rem 0.75rem;
      border-radius: 0.375rem;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      backdrop-filter: blur(10px);
      transition: all 0.2s ease;
    }

    .type-function {
      background-color: rgba(16, 185, 129, 0.15);
      color: #10b981;
      border: 1px solid rgba(16, 185, 129, 0.2);
    }

    .type-function:hover {
      background-color: rgba(16, 185, 129, 0.25);
      box-shadow: 0 0 12px rgba(16, 185, 129, 0.2);
    }

    .type-route {
      background-color: rgba(99, 102, 241, 0.15);
      color: #6366f1;
      border: 1px solid rgba(99, 102, 241, 0.2);
    }

    .type-route:hover {
      background-color: rgba(99, 102, 241, 0.25);
      box-shadow: 0 0 12px rgba(99, 102, 241, 0.2);
    }

    .severity-error {
      color: #ef4444;
      font-weight: bold;
    }

    .severity-warning {
      color: #f59e0b;
      font-weight: bold;
    }

    .gap-file {
      color: #10b981;
      font-family: 'Courier New', monospace;
      font-size: 0.875rem;
    }

    .gap-name {
      font-family: 'Courier New', monospace;
      color: #f8fafc;
    }

    .progress-bar {
      width: 100%;
      height: 0.5rem;
      background-color: rgba(99, 102, 241, 0.1);
      border-radius: 0.25rem;
      overflow: hidden;
      margin-bottom: 0.5rem;
      border: 1px solid rgba(99, 102, 241, 0.15);
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%);
      transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 0 12px rgba(99, 102, 241, 0.4);
    }

    .coverage-text {
      font-size: 0.8125rem;
      color: #94a3b8;
      font-weight: 500;
    }

    .file-name {
      color: #10b981;
      font-weight: 600;
    }

    .empty-state {
      text-align: center;
      padding: 3rem;
      color: #64748b;
    }

    .empty-state-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
      animation: scaleIn 0.5s ease;
    }

    @keyframes scaleIn {
      from { opacity: 0; transform: scale(0.8); }
      to { opacity: 1; transform: scale(1); }
    }

    footer {
      margin-top: 3rem;
      padding-top: 1.5rem;
      border-top: 1px solid rgba(99, 102, 241, 0.1);
      color: #64748b;
      font-size: 0.8125rem;
      text-align: center;
    }

    @media (max-width: 768px) {
      .dashboard {
        grid-template-columns: 1fr;
        gap: 1.5rem;
      }

      h1 {
        font-size: 1.618rem;
      }

      .gauge-percentage {
        font-size: 2.618rem;
      }

      svg.gauge {
        width: 150px;
        height: 150px;
      }

      table {
        font-size: 0.8125rem;
      }

      td, th {
        padding: 0.75rem;
      }

      .stats-grid {
        grid-template-columns: 1fr;
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
            stroke-dasharray="${((coverage / 100) * GAUGE_CIRCUMFERENCE).toFixed(2)} ${GAUGE_CIRCUMFERENCE.toFixed(2)}"
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

    ${
      gaps.length > 0
        ? `
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
    `
        : `
    <div class="section">
      <h2 class="section-title">Documentation Gaps</h2>
      <div class="empty-state">
        <div class="empty-state-icon">✓</div>
        <p>Perfect documentation coverage! No gaps found.</p>
      </div>
    </div>
    `
    }

    ${
      files.length > 0
        ? `
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
    `
        : ''
    }

    <footer>
      <p>Generated by api-docs-generator</p>
    </footer>
  </div>
</body>
</html>`;
}

export { generateDashboard };
