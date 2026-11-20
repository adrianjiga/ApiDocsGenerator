import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { program } from 'commander';
import { analyzeCoverage } from './analyzer.js';
import { formatters } from './formatters/registry.js';
import * as generator from './generator.js';
import { loadConfig } from './generator.js';
import * as parser from './parser.js';
import { DEFAULT_COVERAGE_THRESHOLD, stripControlChars } from './utils.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json');

program
  .name('api-docs-generator')
  .description(
    'Auto-generates API documentation from JavaScript/TypeScript source code',
  )
  .version(version);

/**
 * Build a resolved config by loading the config file and applying CLI overrides.
 * @param {Object} options - Parsed CLI options
 * @returns {Promise<Object>} Merged configuration
 */
async function resolveConfig(options) {
  const configPath = options.config ? path.resolve(options.config) : undefined;
  const config = await loadConfig(configPath);

  if (options.serverUrl) config.serverUrl = options.serverUrl;
  if (options.apiTitle) config.apiTitle = options.apiTitle;
  if (options.apiVersion) config.apiVersion = options.apiVersion;
  if (options.exclude) config.excludePattern = options.exclude;
  if (options.exportedOnly) config.exportedOnly = true;
  if (options.routeServers) {
    config.routeServers = options.routeServers
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);
  }

  return config;
}

program
  .command('generate')
  .alias('gen')
  .description('Generate API documentation')
  .option('-d, --dir <directory>', 'Source directory to scan', '.')
  .option(
    '-o, --output <directory>',
    'Output directory for generated docs',
    './docs',
  )
  .option(
    '-f, --formats <formats>',
    'Output formats, comma-separated: markdown, html, json, openapi',
    'markdown,html,json',
  )
  .option('-c, --config <path>', 'Path to apidocs.config.js')
  .option('--server-url <url>', 'Server URL for examples')
  .option('--api-title <title>', 'API title for documentation')
  .option('--api-version <version>', 'API version string')
  .option('--exclude <pattern>', 'Directory exclude regex pattern')
  .option(
    '--route-servers <names>',
    'Comma-separated identifiers whose calls count as routes, e.g. app,router',
  )
  .action(async (options) => {
    const sourceDir = path.resolve(options.dir);
    const outputDir = path.resolve(options.output);
    const formats = options.formats.split(',').map((f) => f.trim());
    const config = await resolveConfig(options);

    console.log('\n🚀 Starting API Documentation Generation...');
    const result = await generator.generate(
      sourceDir,
      outputDir,
      formats,
      config,
    );
    if (!result?.success) {
      process.exit(1);
    }
  });

program
  .command('scan [directory]')
  .description('Scan directory and show found APIs')
  .option('-c, --config <path>', 'Path to apidocs.config.js')
  .option('--exclude <pattern>', 'Directory exclude regex pattern')
  .option(
    '--route-servers <names>',
    'Comma-separated identifiers whose calls count as routes, e.g. app,router',
  )
  .action(async (directory, options) => {
    const dir = path.resolve(directory || '.');
    const config = await resolveConfig(options);

    console.log(`\n📂 Scanning: ${dir}\n`);
    const apiData = await parser.parseDirectory(dir, config);

    if (apiData.length === 0) {
      console.error('⚠️  No JavaScript/TypeScript files found');
      process.exit(1);
      return;
    }

    apiData.forEach((file) => {
      if (file.functions.length > 0 || file.routes.length > 0) {
        console.log(`\n📄 ${stripControlChars(file.fileName)}`);

        if (file.functions.length > 0) {
          console.log(
            `  Functions: ${stripControlChars(file.functions.map((f) => f.name).join(', '))}`,
          );
        }

        if (file.routes.length > 0) {
          console.log(
            `  Routes: ${stripControlChars(file.routes.map((r) => `${r.method} ${r.path}`).join(', '))}`,
          );
        }
      }
    });

    const filesWithItems = apiData.filter(
      (file) => file.functions.length > 0 || file.routes.length > 0,
    );

    console.log(
      `\n✅ Found ${filesWithItems.length} file(s) with ${apiData.reduce((s, f) => s + f.functions.length, 0)} function(s) and ${apiData.reduce((s, f) => s + f.routes.length, 0)} route(s)\n`,
    );
  });

program
  .command('audit')
  .alias('a')
  .description('Audit documentation coverage')
  .option('-d, --dir <directory>', 'Source directory to scan', '.')
  .option(
    '-t, --threshold <number>',
    'Coverage threshold percentage',
    String(DEFAULT_COVERAGE_THRESHOLD),
  )
  .option(
    '-f, --format <format>',
    'Output format (terminal, json, or dashboard)',
    'terminal',
  )
  .option(
    '-o, --output <file>',
    'Output file for dashboard format (default: coverage-dashboard.html)',
  )
  .option(
    '--exported-only',
    'Count only exported functions (and all routes) towards coverage',
  )
  .option('-c, --config <path>', 'Path to apidocs.config.js')
  .option('--exclude <pattern>', 'Directory exclude regex pattern')
  .option(
    '--route-servers <names>',
    'Comma-separated identifiers whose calls count as routes, e.g. app,router',
  )
  .action(async (options) => {
    const sourceDir = path.resolve(options.dir);
    const threshold = parseInt(options.threshold, 10);
    if (Number.isNaN(threshold) || threshold < 0 || threshold > 100) {
      console.error('Error: --threshold must be a number between 0 and 100');
      process.exit(1);
    }
    const format = options.format.toLowerCase();
    const config = await resolveConfig(options);

    console.error(`\n📊 Auditing documentation coverage...\n`);

    const apiData = await parser.parseDirectory(sourceDir, config);

    if (apiData.length === 0) {
      console.error('Error: No JavaScript/TypeScript files found to audit');
      process.exit(1);
    }

    const result = analyzeCoverage(apiData, {
      acceptTypeScriptReturns: config.acceptTypeScriptReturns,
      exportedOnly: config.exportedOnly,
    });

    if (format === 'json') {
      const json = JSON.stringify(result, null, 2);
      if (options.output) {
        const outputPath = path.resolve(options.output);
        const outputDir = path.dirname(outputPath);
        await fs.mkdir(outputDir, { recursive: true });
        await fs.writeFile(outputPath, json);
        console.error(`✅ json written to: ${outputPath}\n`);
      } else {
        console.log(json);
      }
    } else if (formatters[format]?.type === 'report') {
      const formatter = formatters[format];
      if (formatter.filename) {
        const outputFile = options.output || formatter.filename;
        const outputPath = path.resolve(outputFile);
        const outputDir = path.dirname(outputPath);
        await fs.mkdir(outputDir, { recursive: true });
        const content = formatter.generate(result, threshold);
        await fs.writeFile(outputPath, content);
        console.error(`✅ ${format} written to: ${outputPath}\n`);
      } else {
        formatter.generate(result, threshold);
      }
    } else {
      console.error(
        `Error: Unknown audit format "${format}". Use one of: terminal, json, dashboard.`,
      );
      process.exit(1);
    }

    const coverage = result.summary.coveragePercentage;

    if (coverage < threshold) {
      process.exit(1);
    }
  });

// Default command
program.action(() => {
  if (process.argv.length === 2) {
    program.outputHelp();
  }
});

/**
 * Parse command-line arguments. Called by the bin entrypoint so the CLI runs
 * regardless of how it is invoked (installed globally, via npm exec, or by
 * running bin/api-docs-generator directly).
 * @returns {Promise<void>}
 */
async function run() {
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
  }
}

// Auto-parse when cli.js is executed directly (e.g. `node src/cli.js ...`).
// When run through the bin entrypoint, argv[1] is the bin path, so this guard
// stays false and parsing is left to the bin's `run()` call — never both.
const isMain =
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMain) {
  run();
}

export { program, resolveConfig, run };
