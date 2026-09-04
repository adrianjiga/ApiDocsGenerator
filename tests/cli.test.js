import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';

vi.mock('../src/generator.js', async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    generate: vi.fn().mockResolvedValue({ success: true }),
  };
});

vi.mock('../src/parser.js', () => ({
  parseDirectory: vi.fn().mockResolvedValue([]),
}));

vi.mock('../src/analyzer.js', () => ({
  analyzeCoverage: vi.fn().mockReturnValue({
    summary: { coveragePercentage: 100 },
  }),
}));

vi.mock('../src/formatters/terminal.js', () => ({
  formatTerminalReport: vi.fn(),
}));

vi.mock('../src/formatters/dashboard.js', () => ({
  generateDashboard: vi.fn().mockReturnValue('<html></html>'),
}));

const { program, resolveConfig } = await import('../src/cli.js');
const generator = await import('../src/generator.js');
const parser = await import('../src/parser.js');
const { analyzeCoverage } = await import('../src/analyzer.js');
const { formatTerminalReport } = await import('../src/formatters/terminal.js');
const { generateDashboard } = await import('../src/formatters/dashboard.js');

beforeEach(() => {
  vi.restoreAllMocks();
  // Re-apply default mock implementations after restoreAllMocks clears them
  generator.generate.mockResolvedValue({ success: true });
  parser.parseDirectory.mockResolvedValue([]);
  analyzeCoverage.mockReturnValue({
    summary: { coveragePercentage: 100 },
  });
  formatTerminalReport.mockImplementation(() => {});
  generateDashboard.mockReturnValue('<html></html>');
});

describe('resolveConfig', () => {
  it('returns defaults when no options are provided', async () => {
    const config = await resolveConfig({});
    expect(config.serverUrl).toBe('http://localhost:3000');
    expect(config.apiTitle).toBe('API Documentation');
    expect(config.apiVersion).toBe('1.0.0');
    expect(config.excludePattern).toBe('node_modules|dist|build');
  });

  it('applies CLI overrides for serverUrl, apiTitle, apiVersion, exclude', async () => {
    const config = await resolveConfig({
      serverUrl: 'https://custom.api',
      apiTitle: 'My API',
      apiVersion: '2.0.0',
      exclude: 'vendor|tmp',
    });
    expect(config.serverUrl).toBe('https://custom.api');
    expect(config.apiTitle).toBe('My API');
    expect(config.apiVersion).toBe('2.0.0');
    expect(config.excludePattern).toBe('vendor|tmp');
  });

  it('loads from a custom config path', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-test-'));
    const configFile = path.join(tmpDir, 'apidocs.config.js');
    fs.writeFileSync(
      configFile,
      'export default { apiTitle: "Custom Title" };\n',
    );
    try {
      const config = await resolveConfig({ config: configFile });
      expect(config.apiTitle).toBe('Custom Title');
      expect(config.serverUrl).toBe('http://localhost:3000');
    } finally {
      fs.unlinkSync(configFile);
      fs.rmdirSync(tmpDir);
    }
  });
});

describe('generate command', () => {
  it('calls generator.generate with resolved arguments', async () => {
    await program.parseAsync([
      'node',
      'cli.js',
      'generate',
      '-d',
      '/tmp/src',
      '-o',
      '/tmp/out',
      '-f',
      'markdown,json',
    ]);

    expect(generator.generate).toHaveBeenCalledWith(
      path.resolve('/tmp/src'),
      path.resolve('/tmp/out'),
      ['markdown', 'json'],
      expect.objectContaining({
        serverUrl: 'http://localhost:3000',
      }),
    );
  });

  it('parses comma-separated formats correctly', async () => {
    await program.parseAsync([
      'node',
      'cli.js',
      'gen',
      '-f',
      'html, json, markdown',
    ]);

    expect(generator.generate).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      ['html', 'json', 'markdown'],
      expect.any(Object),
    );
  });
});

describe('scan command', () => {
  it('calls parser.parseDirectory with resolved dir', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'cli.js', 'scan', '/tmp/src']);
    expect(parser.parseDirectory).toHaveBeenCalledWith(
      path.resolve('/tmp/src'),
      expect.any(Object),
    );
  });

  it('handles empty results gracefully', async () => {
    parser.parseDirectory.mockResolvedValue([]);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'cli.js', 'scan', '/tmp/empty']);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('No JavaScript/TypeScript files found'),
    );
  });

  it('prints file, route, and function counts', async () => {
    parser.parseDirectory.mockResolvedValue([
      {
        fileName: 'app.js',
        functions: [{ name: 'foo' }],
        routes: [{ method: 'GET', path: '/api' }],
      },
      {
        fileName: 'utils.js',
        functions: [{ name: 'bar' }, { name: 'baz' }],
        routes: [],
      },
    ]);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'cli.js', 'scan', '/tmp/project']);

    const summaryCall = logSpy.mock.calls.find(
      (call) =>
        typeof call[0] === 'string' &&
        call[0].includes('Found') &&
        call[0].includes('file(s)'),
    );
    expect(summaryCall).toBeDefined();
    expect(summaryCall[0]).toContain('2 file(s)');
    expect(summaryCall[0]).toContain('3 function(s)');
    expect(summaryCall[0]).toContain('1 route(s)');
  });

  it('only counts files that contain functions or routes', async () => {
    parser.parseDirectory.mockResolvedValue([
      {
        fileName: 'app.js',
        functions: [{ name: 'foo' }],
        routes: [],
      },
      {
        fileName: 'empty.js',
        functions: [],
        routes: [],
      },
    ]);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'cli.js', 'scan', '/tmp/project']);

    const summaryCall = logSpy.mock.calls.find(
      (call) =>
        typeof call[0] === 'string' &&
        call[0].includes('Found') &&
        call[0].includes('file(s)'),
    );
    expect(summaryCall[0]).toContain('1 file(s)');
    expect(summaryCall[0]).toContain('1 function(s)');
  });
});

describe('audit command', () => {
  it('calls analyzeCoverage with parsed API data', async () => {
    const mockData = [
      { fileName: 'a.js', functions: [{ name: 'fn' }], routes: [] },
    ];
    parser.parseDirectory.mockResolvedValue(mockData);
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync(['node', 'cli.js', 'audit', '-d', '/tmp/src']);
    expect(analyzeCoverage).toHaveBeenCalledWith(mockData);
  });

  it('uses terminal format by default', async () => {
    parser.parseDirectory.mockResolvedValue([
      { fileName: 'a.js', functions: [{ name: 'fn' }], routes: [] },
    ]);
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync(['node', 'cli.js', 'audit']);
    expect(formatTerminalReport).toHaveBeenCalled();
  });

  it('outputs JSON when format is json', async () => {
    parser.parseDirectory.mockResolvedValue([
      { fileName: 'a.js', functions: [{ name: 'fn' }], routes: [] },
    ]);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync(['node', 'cli.js', 'audit', '-f', 'json']);

    const jsonCall = logSpy.mock.calls.find((call) => {
      try {
        JSON.parse(call[0]);
        return true;
      } catch {
        return false;
      }
    });
    expect(jsonCall).toBeDefined();
  });

  it('writes json to a file when --output is provided', async () => {
    parser.parseDirectory.mockResolvedValue([
      { fileName: 'a.js', functions: [{ name: 'fn' }], routes: [] },
    ]);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'json-out-'));
    const outputFile = path.join(tmpDir, 'coverage.json');

    await program.parseAsync([
      'node',
      'cli.js',
      'audit',
      '-f',
      'json',
      '-o',
      outputFile,
    ]);

    expect(fs.existsSync(outputFile)).toBe(true);
    expect(() => JSON.parse(fs.readFileSync(outputFile, 'utf8'))).not.toThrow();
    // Should not print the JSON to stdout when writing to a file.
    const jsonPrinted = logSpy.mock.calls.some((call) => {
      try {
        JSON.parse(call[0]);
        return true;
      } catch {
        return false;
      }
    });
    expect(jsonPrinted).toBe(false);

    fs.unlinkSync(outputFile);
    fs.rmdirSync(tmpDir);
  });

  it('generates dashboard when format is dashboard', async () => {
    parser.parseDirectory.mockResolvedValue([
      { fileName: 'a.js', functions: [{ name: 'fn' }], routes: [] },
    ]);
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-'));
    const outputFile = path.join(tmpDir, 'dashboard.html');

    await program.parseAsync([
      'node',
      'cli.js',
      'audit',
      '-f',
      'dashboard',
      '-o',
      outputFile,
    ]);

    expect(generateDashboard).toHaveBeenCalled();
    expect(fs.existsSync(outputFile)).toBe(true);

    fs.unlinkSync(outputFile);
    fs.rmdirSync(tmpDir);
  });

  it('exits with code 1 when coverage is below threshold', async () => {
    parser.parseDirectory.mockResolvedValue([
      { fileName: 'a.js', functions: [{ name: 'fn' }], routes: [] },
    ]);
    analyzeCoverage.mockReturnValue({
      summary: { coveragePercentage: 50 },
    });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});

    await program.parseAsync(['node', 'cli.js', 'audit', '-t', '80']);

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('errors on an unknown audit format instead of falling back to terminal', async () => {
    parser.parseDirectory.mockResolvedValue([
      { fileName: 'a.js', functions: [{ name: 'fn' }], routes: [] },
    ]);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
    formatTerminalReport.mockClear();

    await program.parseAsync(['node', 'cli.js', 'audit', '-f', 'markdown']);

    expect(errorSpy).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(formatTerminalReport).not.toHaveBeenCalled();
  });
});
