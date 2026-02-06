import { describe, it, expect } from 'vitest';
import { formatters } from '../../src/formatters/registry.js';

describe('formatters registry', () => {
  it('has all expected keys', () => {
    const expectedKeys = [
      'markdown',
      'md',
      'html',
      'json',
      'openapi',
      'swagger',
      'terminal',
      'dashboard',
    ];
    for (const key of expectedKeys) {
      expect(formatters[key]).toBeDefined();
    }
  });

  it('each entry has a generate function and a type', () => {
    for (const [, entry] of Object.entries(formatters)) {
      expect(typeof entry.generate).toBe('function');
      expect(['doc', 'report']).toContain(entry.type);
    }
  });

  it('doc formatters have a non-empty filename', () => {
    for (const [, entry] of Object.entries(formatters)) {
      if (entry.type === 'doc') {
        expect(typeof entry.filename).toBe('string');
        expect(entry.filename.length).toBeGreaterThan(0);
      }
    }
  });

  it('md alias points to same generate function as markdown', () => {
    expect(formatters.md.generate).toBe(formatters.markdown.generate);
  });

  it('swagger alias points to same generate function as openapi', () => {
    expect(formatters.swagger.generate).toBe(formatters.openapi.generate);
  });

  it('terminal formatter has null filename (prints to stdout)', () => {
    expect(formatters.terminal.filename).toBeNull();
    expect(formatters.terminal.type).toBe('report');
  });

  it('dashboard formatter has a filename and report type', () => {
    expect(formatters.dashboard.filename).toBe('coverage-dashboard.html');
    expect(formatters.dashboard.type).toBe('report');
  });
});
