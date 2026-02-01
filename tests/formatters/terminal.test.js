import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatTerminalReport } from '../../src/formatters/terminal.js';

/**
 * Creates a mock report object for testing.
 * @param {Object} overrides
 * @returns {Object} A mock report object
 */
function makeReport(overrides = {}) {
  return {
    summary: {
      totalFunctions: 3,
      documentedFunctions: 2,
      undocumentedFunctions: 1,
      partiallyDocumented: 0,
      totalRoutes: 2,
      documentedRoutes: 0,
      coveragePercentage: 40,
      functionCoverage: 66.7,
      routeCoverage: 0,
      ...overrides.summary,
    },
    files: overrides.files ?? [
      {
        fileName: 'app.js',
        filePath: '/src/app.js',
        totalItems: 5,
        documentedItems: 2,
        coveragePercentage: 40,
        gaps: [
          {
            type: 'function',
            name: 'undocFn',
            line: 10,
            severity: 'error',
            missing: ['description'],
          },
        ],
      },
    ],
    gaps: overrides.gaps ?? [
      {
        type: 'function',
        name: 'undocFn',
        line: 10,
        severity: 'error',
        missing: ['description'],
      },
    ],
  };
}

let logOutput;

beforeEach(() => {
  logOutput = [];
  vi.spyOn(console, 'log').mockImplementation((...args) => {
    logOutput.push(args.join(' '));
  });
});

describe('formatTerminalReport', () => {
  it('prints header', () => {
    formatTerminalReport(makeReport(), 80);
    const output = logOutput.join('\n');
    expect(output).toContain('Documentation Coverage Report');
  });

  it('prints coverage percentage', () => {
    formatTerminalReport(makeReport(), 80);
    const output = logOutput.join('\n');
    expect(output).toContain('40%');
  });

  it('prints function coverage stats', () => {
    formatTerminalReport(makeReport(), 80);
    const output = logOutput.join('\n');
    expect(output).toContain('Function Coverage');
    expect(output).toContain('2/3');
  });

  it('prints route coverage stats', () => {
    formatTerminalReport(makeReport(), 80);
    const output = logOutput.join('\n');
    expect(output).toContain('Route Coverage');
    expect(output).toContain('0/2');
  });

  it('prints per-file breakdown', () => {
    formatTerminalReport(makeReport(), 80);
    const output = logOutput.join('\n');
    expect(output).toContain('Per-File Breakdown');
    expect(output).toContain('app.js');
  });

  it('prints gap details with name and line', () => {
    formatTerminalReport(makeReport(), 80);
    const output = logOutput.join('\n');
    expect(output).toContain('undocFn');
    expect(output).toContain('line 10');
  });

  it('prints gap count footer when gaps exist', () => {
    formatTerminalReport(makeReport(), 80);
    const output = logOutput.join('\n');
    expect(output).toContain('1 documentation gap found');
  });

  it('prints perfect coverage message when no gaps', () => {
    const report = makeReport({
      summary: {
        coveragePercentage: 100,
        functionCoverage: 100,
        routeCoverage: 100,
      },
      files: [
        {
          fileName: 'a.js',
          filePath: '/a.js',
          totalItems: 1,
          documentedItems: 1,
          coveragePercentage: 100,
          gaps: [],
        },
      ],
      gaps: [],
    });
    formatTerminalReport(report, 80);
    const output = logOutput.join('\n');
    expect(output).toContain('Perfect documentation coverage');
  });

  it('prints "All items documented" for files with no gaps', () => {
    const report = makeReport({
      files: [
        {
          fileName: 'clean.js',
          filePath: '/clean.js',
          totalItems: 1,
          documentedItems: 1,
          coveragePercentage: 100,
          gaps: [],
        },
      ],
      gaps: [],
    });
    formatTerminalReport(report, 80);
    const output = logOutput.join('\n');
    expect(output).toContain('All items documented');
  });

  it('pluralizes gap count correctly for multiple gaps', () => {
    const report = makeReport({
      gaps: [
        {
          type: 'function',
          name: 'a',
          line: 1,
          severity: 'error',
          missing: ['description'],
        },
        {
          type: 'function',
          name: 'b',
          line: 2,
          severity: 'error',
          missing: ['description'],
        },
      ],
    });
    formatTerminalReport(report, 80);
    const output = logOutput.join('\n');
    expect(output).toContain('2 documentation gaps found');
  });

  it('shows warning icon for warning severity gaps', () => {
    const report = makeReport({
      files: [
        {
          fileName: 'a.js',
          filePath: '/a.js',
          totalItems: 1,
          documentedItems: 0,
          coveragePercentage: 0,
          gaps: [
            {
              type: 'function',
              name: 'warnFn',
              line: 5,
              severity: 'warning',
              missing: ['params'],
            },
          ],
        },
      ],
      gaps: [
        {
          type: 'function',
          name: 'warnFn',
          line: 5,
          severity: 'warning',
          missing: ['params'],
        },
      ],
    });
    formatTerminalReport(report, 80);
    const output = logOutput.join('\n');
    expect(output).toContain('⚠');
  });

  it('shows error icon for error severity gaps', () => {
    formatTerminalReport(makeReport(), 80);
    const output = logOutput.join('\n');
    expect(output).toContain('✗');
  });
});
