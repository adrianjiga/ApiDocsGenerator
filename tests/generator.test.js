import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { generate } from '../src/generator.js';

const outputDir = path.resolve('tests/.tmp-generator-output');
const examplesDir = path.resolve('examples');

beforeEach(async () => {
  await fs.remove(outputDir);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
  await fs.remove(outputDir);
  vi.restoreAllMocks();
});

describe('generate', () => {
  it('generates all three formats and a report', async () => {
    const result = await generate(examplesDir, outputDir, [
      'markdown',
      'html',
      'json',
    ]);
    expect(result.success).toBe(true);
    expect(result.generated).toHaveLength(3);
    expect(await fs.pathExists(path.join(outputDir, 'API.md'))).toBe(true);
    expect(await fs.pathExists(path.join(outputDir, 'index.html'))).toBe(true);
    expect(await fs.pathExists(path.join(outputDir, 'api.json'))).toBe(true);
    expect(
      await fs.pathExists(path.join(outputDir, 'GENERATION_REPORT.md')),
    ).toBe(true);
  });

  it('generates only markdown when requested', async () => {
    const result = await generate(examplesDir, outputDir, ['markdown']);
    expect(result.success).toBe(true);
    expect(result.generated).toHaveLength(1);
    expect(result.generated[0].format).toBe('markdown');
    expect(await fs.pathExists(path.join(outputDir, 'API.md'))).toBe(true);
    expect(await fs.pathExists(path.join(outputDir, 'index.html'))).toBe(false);
  });

  it('accepts "md" as alias for markdown', async () => {
    const result = await generate(examplesDir, outputDir, ['md']);
    expect(result.success).toBe(true);
    expect(result.generated[0].file).toBe('API.md');
  });

  it('skips unknown formats without failing', async () => {
    const result = await generate(examplesDir, outputDir, ['json', 'xml']);
    expect(result.success).toBe(true);
    expect(result.generated).toHaveLength(1);
    expect(result.generated[0].format).toBe('json');
  });

  it('returns filesProcessed count', async () => {
    const result = await generate(examplesDir, outputDir, ['json']);
    expect(result.filesProcessed).toBeGreaterThan(0);
  });

  it('returns failure for empty directory', async () => {
    const emptyDir = path.join(outputDir, 'empty-src');
    await fs.ensureDir(emptyDir);
    const result = await generate(emptyDir, outputDir, ['json']);
    expect(result.success).toBe(false);
  });

  it('creates output directory if it does not exist', async () => {
    const nested = path.join(outputDir, 'deep', 'nested');
    await generate(examplesDir, nested, ['json']);
    expect(await fs.pathExists(nested)).toBe(true);
  });

  it('writes valid JSON to api.json', async () => {
    await generate(examplesDir, outputDir, ['json']);
    const content = await fs.readFile(path.join(outputDir, 'api.json'), 'utf8');
    expect(() => JSON.parse(content)).not.toThrow();
  });

  it('writes generation report with stats', async () => {
    await generate(examplesDir, outputDir, ['markdown']);
    const report = await fs.readFile(
      path.join(outputDir, 'GENERATION_REPORT.md'),
      'utf8',
    );
    expect(report).toContain('Files Scanned');
    expect(report).toContain('Functions Documented');
    expect(report).toContain('API Routes Found');
  });

  it('returns failure for nonexistent source directory', async () => {
    const result = await generate('/nonexistent/path/xyz', outputDir, ['json']);
    expect(result.success).toBe(false);
  });

  it('succeeds with empty formats array', async () => {
    const result = await generate(examplesDir, outputDir, []);
    expect(result.success).toBe(true);
    expect(result.generated).toHaveLength(0);
  });

  it('normalizes format names with different casing and whitespace', async () => {
    const result = await generate(examplesDir, outputDir, [' HTML ', 'JSON']);
    expect(result.success).toBe(true);
    expect(result.generated).toHaveLength(2);
    expect(result.generated[0].file).toBe('index.html');
    expect(result.generated[1].file).toBe('api.json');
  });
});
