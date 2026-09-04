import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getDefaultConfig, loadConfig } from '../src/generator.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getDefaultConfig', () => {
  it('returns all 4 keys with expected default values', () => {
    const config = getDefaultConfig();
    expect(config.serverUrl).toBe('http://localhost:3000');
    expect(config.apiTitle).toBe('API Documentation');
    expect(config.apiVersion).toBe('1.0.0');
    // excludePattern covers node_modules and common build/cache directories
    expect(config.excludePattern).toContain('node_modules');
    expect(config.excludePattern).toContain('dist');
  });

  it('returns a fresh copy (no shared mutation)', () => {
    const a = getDefaultConfig();
    const b = getDefaultConfig();
    a.serverUrl = 'http://changed';
    expect(b.serverUrl).toBe('http://localhost:3000');
  });
});

describe('loadConfig', () => {
  it('returns defaults and warns when an explicit config path does not exist', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const config = await loadConfig('/nonexistent/path/apidocs.config.js');
    expect(config).toEqual(getDefaultConfig());
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Config file not found'),
    );
  });

  it('merges user overrides over defaults', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apidocs-'));
    const configFile = path.join(tmpDir, 'apidocs.config.js');
    fs.writeFileSync(
      configFile,
      'export default { serverUrl: "https://api.example.com" };\n',
    );
    try {
      const config = await loadConfig(configFile);
      expect(config.serverUrl).toBe('https://api.example.com');
      expect(config.excludePattern).toContain('node_modules');
      expect(config.apiTitle).toBe('API Documentation');
      expect(config.apiVersion).toBe('1.0.0');
    } finally {
      fs.unlinkSync(configFile);
      fs.rmdirSync(tmpDir);
    }
  });

  it('handles malformed config gracefully and returns defaults', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apidocs-'));
    const configFile = path.join(tmpDir, 'apidocs.config.js');
    fs.writeFileSync(configFile, '%%% not valid javascript %%%');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const config = await loadConfig(configFile);
      expect(config).toEqual(getDefaultConfig());
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load config'),
      );
    } finally {
      fs.unlinkSync(configFile);
      fs.rmdirSync(tmpDir);
    }
  });
});
