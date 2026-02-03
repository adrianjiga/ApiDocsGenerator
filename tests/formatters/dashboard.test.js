import { describe, it, expect } from 'vitest';
import { generateDashboard } from '../../src/formatters/dashboard.js';

/**
 * Creates a mock report object for testing.
 * @param {Object} overrides
 * @returns {Object} A mock report object
 */
function makeReport(overrides = {}) {
  return {
    summary: {
      totalFunctions: 4,
      documentedFunctions: 2,
      undocumentedFunctions: 2,
      partiallyDocumented: 1,
      totalRoutes: 2,
      documentedRoutes: 0,
      coveragePercentage: 33.3,
      functionCoverage: 50,
      routeCoverage: 0,
      ...overrides.summary,
    },
    files: overrides.files ?? [
      {
        fileName: 'app.js',
        filePath: '/src/app.js',
        totalItems: 6,
        documentedItems: 2,
        coveragePercentage: 33.3,
        gaps: [],
      },
    ],
    gaps: overrides.gaps ?? [
      {
        type: 'function',
        name: 'undocFn',
        fileName: 'app.js',
        filePath: '/src/app.js',
        line: 5,
        severity: 'error',
        missing: ['description', 'params', 'returns'],
        existing: { description: null, params: [], returns: false },
        functionSignature: 'undocFn()',
      },
      {
        type: 'route',
        name: 'GET /users',
        fileName: 'app.js',
        filePath: '/src/app.js',
        line: 20,
        severity: 'error',
        missing: ['description'],
        existing: { description: null, params: [], returns: false },
        functionSignature: 'GET /users',
      },
    ],
  };
}

describe('generateDashboard', () => {
  it('returns valid HTML document', () => {
    const html = generateDashboard(makeReport());
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
  });

  it('includes dashboard title', () => {
    const html = generateDashboard(makeReport());
    expect(html).toContain('Documentation Coverage Dashboard');
  });

  it('displays coverage percentage', () => {
    const html = generateDashboard(makeReport());
    expect(html).toContain('33.3%');
  });

  it('displays function coverage stat', () => {
    const html = generateDashboard(makeReport());
    expect(html).toContain('Function Coverage');
    expect(html).toContain('50%');
  });

  it('displays route coverage stat', () => {
    const html = generateDashboard(makeReport());
    expect(html).toContain('Route Coverage');
    expect(html).toContain('0%');
  });

  it('displays gaps count', () => {
    const html = generateDashboard(makeReport());
    expect(html).toContain('Documentation Gaps');
  });

  it('renders gap rows with correct details', () => {
    const html = generateDashboard(makeReport());
    expect(html).toContain('undocFn');
    expect(html).toContain('GET /users');
    expect(html).toContain('type-function');
    expect(html).toContain('type-route');
  });

  it('renders per-file coverage table', () => {
    const html = generateDashboard(makeReport());
    expect(html).toContain('Per-File Coverage');
    expect(html).toContain('app.js');
    expect(html).toContain('progress-bar');
  });

  it('uses green gauge color for high coverage', () => {
    const report = makeReport({
      summary: {
        coveragePercentage: 90,
        functionCoverage: 90,
        routeCoverage: 90,
      },
      gaps: [],
    });
    const html = generateDashboard(report);
    expect(html).toContain('#44bb44');
  });

  it('uses yellow gauge color for medium coverage', () => {
    const report = makeReport({
      summary: {
        coveragePercentage: 65,
        functionCoverage: 65,
        routeCoverage: 65,
      },
    });
    const html = generateDashboard(report);
    expect(html).toContain('#ffaa44');
  });

  it('uses red gauge color for low coverage', () => {
    const report = makeReport({
      summary: {
        coveragePercentage: 30,
        functionCoverage: 30,
        routeCoverage: 30,
      },
    });
    const html = generateDashboard(report);
    expect(html).toContain('#ff4444');
  });

  it('shows empty state when no gaps exist', () => {
    const report = makeReport({
      summary: {
        coveragePercentage: 100,
        functionCoverage: 100,
        routeCoverage: 100,
      },
      gaps: [],
    });
    const html = generateDashboard(report);
    expect(html).toContain('Perfect documentation coverage');
  });

  it('escapes HTML in gap names', () => {
    const report = makeReport({
      gaps: [
        {
          type: 'function',
          name: '<script>alert("xss")</script>',
          fileName: 'a.js',
          filePath: '/a.js',
          line: 1,
          severity: 'error',
          missing: ['description'],
          existing: { description: null, params: [], returns: false },
          functionSignature: 'fn()',
        },
      ],
    });
    const html = generateDashboard(report);
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
  });

  it('includes SVG gauge element', () => {
    const html = generateDashboard(makeReport());
    expect(html).toContain('<svg class="gauge"');
    expect(html).toContain('stroke-dasharray');
  });

  it('includes embedded CSS', () => {
    const html = generateDashboard(makeReport());
    expect(html).toContain('<style>');
  });

  it('uses yellow color for exactly 50% coverage', () => {
    const report = makeReport({
      summary: {
        coveragePercentage: 50,
        functionCoverage: 50,
        routeCoverage: 50,
      },
    });
    const html = generateDashboard(report);
    expect(html).toContain('#ffaa44');
  });

  it('uses green color for exactly 80% coverage', () => {
    const report = makeReport({
      summary: {
        coveragePercentage: 80,
        functionCoverage: 80,
        routeCoverage: 80,
      },
      gaps: [],
    });
    const html = generateDashboard(report);
    expect(html).toContain('#44bb44');
  });

  it('uses red color for 49% coverage', () => {
    const report = makeReport({
      summary: {
        coveragePercentage: 49,
        functionCoverage: 49,
        routeCoverage: 49,
      },
    });
    const html = generateDashboard(report);
    expect(html).toContain('#ff4444');
  });

  it('omits per-file section when files array is empty', () => {
    const report = makeReport({ files: [], gaps: [] });
    const html = generateDashboard(report);
    expect(html).not.toContain('Per-File Coverage');
  });

  it('uses correct per-file progress bar colors at boundaries', () => {
    const report = makeReport({
      files: [
        {
          fileName: 'low.js',
          totalItems: 10,
          documentedItems: 4,
          coveragePercentage: 40,
        },
        {
          fileName: 'mid.js',
          totalItems: 10,
          documentedItems: 5,
          coveragePercentage: 50,
        },
        {
          fileName: 'high.js',
          totalItems: 10,
          documentedItems: 8,
          coveragePercentage: 80,
        },
      ],
      gaps: [],
    });
    const html = generateDashboard(report);
    expect(html).toContain('background-color: #ff4444;');
    expect(html).toContain('background-color: #ffaa44;');
    expect(html).toContain('background-color: #44bb44;');
  });
});
