import path from 'path';
import { createRequire } from 'module';
import fs from 'fs-extra';
import { program } from 'commander';
import * as generator from './generator.js';
import * as parser from './parser.js';
import { analyzeCoverage } from './analyzer.js';
import { formatters } from './formatters/registry.js';
import { loadConfig } from './generator.js';

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
    'Output formats (comma-separated: markdown,html,json)',
    'markdown,html,json',
  )
  .option('-c, --config <path>', 'Path to apidocs.config.js')
  .option('--server-url <url>', 'Server URL for examples')
  .option('--api-title <title>', 'API title for documentation')
  .option('--api-version <version>', 'API version string')
  .option('--exclude <pattern>', 'Directory exclude regex pattern')
  .action(async (options) => {
    const sourceDir = path.resolve(options.dir);
    const outputDir = path.resolve(options.output);
    const formats = options.formats.split(',').map((f) => f.trim());
    const config = await resolveConfig(options);

    console.log('\n🚀 Starting API Documentation Generation...');
    await generator.generate(sourceDir, outputDir, formats, config);
  });

program
  .command('scan [directory]')
  .description('Scan directory and show found APIs')
  .option('-c, --config <path>', 'Path to apidocs.config.js')
  .option('--exclude <pattern>', 'Directory exclude regex pattern')
  .action(async (directory, options) => {
    const dir = path.resolve(directory || '.');
    const config = await resolveConfig(options);

    console.log(`\n📂 Scanning: ${dir}\n`);
    const apiData = await parser.parseDirectory(dir, config);

    if (apiData.length === 0) {
      console.log('⚠️  No JavaScript/TypeScript files found');
      return;
    }

    apiData.forEach((file) => {
      if (file.functions.length > 0 || file.routes.length > 0) {
        console.log(`\n📄 ${file.fileName}`);

        if (file.functions.length > 0) {
          console.log(
            `  Functions: ${file.functions.map((f) => f.name).join(', ')}`,
          );
        }

        if (file.routes.length > 0) {
          console.log(
            `  Routes: ${file.routes.map((r) => `${r.method} ${r.path}`).join(', ')}`,
          );
        }
      }
    });

    console.log(
      `\n✅ Found ${apiData.length} file(s) with ${apiData.reduce((s, f) => s + f.functions.length, 0)} function(s) and ${apiData.reduce((s, f) => s + f.routes.length, 0)} route(s)\n`,
    );
  });

program
  .command('audit')
  .alias('a')
  .description('Audit documentation coverage')
  .option('-d, --dir <directory>', 'Source directory to scan', '.')
  .option('-t, --threshold <number>', 'Coverage threshold percentage', '80')
  .option(
    '-f, --format <format>',
    'Output format (terminal, json, or dashboard)',
    'terminal',
  )
  .option(
    '-o, --output <file>',
    'Output file for dashboard format (default: coverage-dashboard.html)',
  )
  .option('-c, --config <path>', 'Path to apidocs.config.js')
  .option('--exclude <pattern>', 'Directory exclude regex pattern')
  .action(async (options) => {
    const sourceDir = path.resolve(options.dir);
    const threshold = parseInt(options.threshold, 10);
    if (isNaN(threshold) || threshold < 0 || threshold > 100) {
      console.error('Error: --threshold must be a number between 0 and 100');
      process.exit(1);
    }
    const format = options.format.toLowerCase();
    const config = await resolveConfig(options);

    console.log(`\n📊 Auditing documentation coverage...\n`);

    const apiData = await parser.parseDirectory(sourceDir, config);

    if (apiData.length === 0) {
      console.log('⚠️  No JavaScript/TypeScript files found');
      return;
    }

    const result = analyzeCoverage(apiData);

    if (format === 'json') {
      console.log(JSON.stringify(result, null, 2));
    } else if (formatters[format]?.type === 'report') {
      const formatter = formatters[format];
      if (formatter.filename) {
        const outputFile = options.output || formatter.filename;
        const outputPath = path.resolve(outputFile);
        const outputDir = path.dirname(outputPath);
        await fs.ensureDir(outputDir);
        const content = formatter.generate(result);
        await fs.writeFile(outputPath, content);
        console.log(`✅ ${format} written to: ${outputPath}\n`);
      } else {
        formatter.generate(result, threshold);
      }
    } else {
      formatters.terminal.generate(result, threshold);
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
 */
function run() {
  program.parse(process.argv);
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
