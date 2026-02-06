import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { generate } from '../src/generator.js';
import { parseDirectory } from '../src/parser.js';
import { analyzeCoverage } from '../src/analyzer.js';

const examplesDir = path.resolve('examples');
const outputDir = path.resolve('tests/.tmp-integration-output');

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

describe('full pipeline: parse → analyze → generate', () => {
  it('parses real example files and finds functions and routes', async () => {
    const apiData = await parseDirectory(examplesDir);

    expect(apiData.length).toBeGreaterThan(0);

    const totalFunctions = apiData.reduce(
      (sum, f) => sum + f.functions.length,
      0,
    );
    const totalRoutes = apiData.reduce((sum, f) => sum + f.routes.length, 0);

    expect(totalFunctions).toBeGreaterThan(0);
    expect(totalRoutes).toBeGreaterThan(0);
  });

  it('analyzeCoverage produces valid report from parsed data', async () => {
    const apiData = await parseDirectory(examplesDir);
    const report = analyzeCoverage(apiData);

    expect(report).toHaveProperty('summary');
    expect(report).toHaveProperty('files');
    expect(report).toHaveProperty('gaps');
    expect(report.summary.coveragePercentage).toBeGreaterThanOrEqual(0);
    expect(report.summary.coveragePercentage).toBeLessThanOrEqual(100);
    expect(report.summary.totalFunctions).toBeGreaterThan(0);
  });

  it('generate produces all formats and creates real files', async () => {
    const result = await generate(examplesDir, outputDir, [
      'markdown',
      'html',
      'json',
      'openapi',
    ]);

    expect(result.success).toBe(true);
    expect(result.generated).toHaveLength(4);
    expect(result.failed).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);

    // Verify files actually exist on disk
    for (const entry of result.generated) {
      const exists = await fs.pathExists(entry.path);
      expect(exists).toBe(true);
    }

    // Verify report file was created
    const reportExists = await fs.pathExists(
      path.join(outputDir, 'GENERATION_REPORT.md'),
    );
    expect(reportExists).toBe(true);
  });

  it('generated markdown contains function names from source', async () => {
    await generate(examplesDir, outputDir, ['markdown']);
    const md = await fs.readFile(path.join(outputDir, 'API.md'), 'utf8');

    expect(md).toContain('sum');
    expect(md).toContain('getUserById');
    expect(md).toContain('greet');
  });

  it('generated HTML is valid and contains route info', async () => {
    await generate(examplesDir, outputDir, ['html']);
    const html = await fs.readFile(
      path.join(outputDir, 'index.html'),
      'utf8',
    );

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
    expect(html).toContain('/users/:id');
    expect(html).toContain('GET');
  });

  it('generated JSON is valid and contains file metadata', async () => {
    await generate(examplesDir, outputDir, ['json']);
    const raw = await fs.readFile(path.join(outputDir, 'api.json'), 'utf8');
    const json = JSON.parse(raw);

    expect(json).toHaveProperty('meta');
    expect(json).toHaveProperty('files');
    expect(json.files.length).toBeGreaterThan(0);
  });

  it('generated OpenAPI YAML contains paths', async () => {
    await generate(examplesDir, outputDir, ['openapi']);
    const yaml = await fs.readFile(
      path.join(outputDir, 'openapi.yaml'),
      'utf8',
    );

    expect(yaml).toContain('openapi:');
    expect(yaml).toContain('paths:');
    expect(yaml).toContain('/users/{id}');
  });

  it('analyze → coverage percentages match manual count', async () => {
    const apiData = await parseDirectory(examplesDir);
    const report = analyzeCoverage(apiData);

    const manualTotal =
      report.summary.totalFunctions + report.summary.totalRoutes;
    const manualDocumented =
      report.summary.documentedFunctions + report.summary.documentedRoutes;

    // Coverage should match the ratio
    if (manualTotal > 0) {
      const expectedCoverage = parseFloat(
        ((manualDocumented / manualTotal) * 100).toFixed(1),
      );
      expect(report.summary.coveragePercentage).toBe(expectedCoverage);
    }
  });
});
