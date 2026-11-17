import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const pkg = createRequire(import.meta.url)('../package.json');

const binPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../bin/api-docs-generator',
);

describe('bin entrypoint', () => {
  it('runs and prints the version', () => {
    const result = spawnSync(process.execPath, [binPath, '--version'], {
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(pkg.version);
  });

  it('runs the scan command against real examples', () => {
    const examplesDir = path.resolve('examples');
    const result = spawnSync(process.execPath, [binPath, 'scan', examplesDir], {
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Found 2 file(s)');
  });
});
