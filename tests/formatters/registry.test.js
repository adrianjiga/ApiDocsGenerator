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
    ];
    for (const key of expectedKeys) {
      expect(formatters[key]).toBeDefined();
    }
  });

  it('each entry has a generate function and a non-empty filename', () => {
    // eslint-disable-next-line no-unused-vars
    for (const [key, entry] of Object.entries(formatters)) {
      expect(typeof entry.generate).toBe('function');
      expect(typeof entry.filename).toBe('string');
      expect(entry.filename.length).toBeGreaterThan(0);
    }
  });

  it('md alias points to same generate function as markdown', () => {
    expect(formatters.md.generate).toBe(formatters.markdown.generate);
  });

  it('swagger alias points to same generate function as openapi', () => {
    expect(formatters.swagger.generate).toBe(formatters.openapi.generate);
  });
});
