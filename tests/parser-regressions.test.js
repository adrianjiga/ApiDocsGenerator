import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { scanDirectory } from '../src/parser.js';

let tmpDir;

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parser-regressions-'));
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeFile(relativePath, content) {
  const fullPath = path.join(tmpDir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
  return fullPath;
}

describe('scanDirectory exclusion is relative to the scan root', () => {
  it('scans nested directories when an ancestor matches the exclude pattern', async () => {
    const root = path.join(tmpDir, 'build', 'project');
    writeFile('build/project/top.js', 'function top() {}');
    writeFile('build/project/src/lib/nested.js', 'function nested() {}');

    const files = await scanDirectory(root);
    expect(files.map((f) => path.basename(f)).sort()).toEqual([
      'nested.js',
      'top.js',
    ]);
  });

  it('still excludes matching directories inside the scan root', async () => {
    writeFile('src/app.js', 'function app() {}');
    writeFile('dist/bundle.js', 'function bundle() {}');

    const files = await scanDirectory(tmpDir);
    expect(files.map((f) => path.basename(f))).toEqual(['app.js']);
  });
});
