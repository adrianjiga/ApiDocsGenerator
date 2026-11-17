import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { formatters } from './formatters/registry.js';
import * as parser from './parser.js';
import { DEFAULT_EXCLUDE_PATTERN } from './utils.js';

/**
 * Default configuration for the documentation generator
 * @type {Object}
 */
const defaultConfig = {
  excludePattern: DEFAULT_EXCLUDE_PATTERN,
  serverUrl: 'http://localhost:3000',
  apiTitle: 'API Documentation',
  apiVersion: '1.0.0',
  // Optional list of Express/Fastify instance identifiers (e.g. ['app',
  // 'router']) to restrict route detection to. Empty array keeps the default
  // broad detection.
  routeServers: [],
};

/**
 * Get a fresh copy of the default configuration
 * @returns {Object} Fresh copy of default configuration
 */
function getDefaultConfig() {
  return { ...defaultConfig };
}

const CONFIG_FILENAMES = [
  'apidocs.config.js',
  'apidocs.config.mjs',
  'apidocs.config.cjs',
];

/**
 * Check whether a path exists
 * @param {string} filePath - Path to check
 * @returns {Promise<boolean>} True when the path exists
 */
async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Find the first default config file present in a directory
 * @param {string} dir - Directory to search
 * @returns {Promise<string|undefined>} Path of the config file, if any
 */
async function findDefaultConfig(dir) {
  for (const name of CONFIG_FILENAMES) {
    const candidate = path.join(dir, name);
    if (await pathExists(candidate)) return candidate;
  }
  return undefined;
}

/**
 * Suggest a fix for a config file written in the wrong module format
 * @param {Error} err - Error thrown while importing the config
 * @param {string} filePath - Path of the config file
 * @returns {string} Hint text, or an empty string when none applies
 */
function configLoadHint(err, filePath) {
  if (path.extname(filePath) !== '.js') return '';
  if (err instanceof SyntaxError) {
    return ' If your project is CommonJS, rename it to apidocs.config.mjs or use module.exports.';
  }
  if (
    err instanceof ReferenceError &&
    /\b(module|exports|require) is not defined\b/.test(err.message)
  ) {
    return ' If your project is an ES module ("type": "module"), use export default or rename it to apidocs.config.cjs.';
  }
  return '';
}

/**
 * Load configuration from file and merge with defaults. Without an explicit
 * path, looks for apidocs.config.js, .mjs or .cjs in the working directory.
 * @param {string} [configPath] - Path to the configuration file
 * @returns {Promise<Object>} Merged configuration object
 */
async function loadConfig(configPath) {
  const defaults = getDefaultConfig();
  const filePath = configPath || (await findDefaultConfig(process.cwd()));

  if (!filePath) return defaults;

  if (!(await pathExists(filePath))) {
    console.warn(
      `Warning: Config file not found: ${filePath}. Using defaults.`,
    );
    return defaults;
  }

  try {
    const fileUrl = pathToFileURL(path.resolve(filePath));
    const mod = await import(fileUrl.href);
    const userConfig = mod.default || mod;
    return { ...defaults, ...userConfig };
  } catch (err) {
    const message = String(err?.message ?? err).replace(/\.$/, '');
    console.warn(
      `Warning: Failed to load config from ${filePath}: ${message}. Using defaults.${configLoadHint(err, filePath)}`,
    );
    return defaults;
  }
}

/**
 * Build a Markdown summary report for the generation run
 * @param {Array} apiData - Array of parsed file metadata
 * @param {Array} formats - Array of output format names
 * @param {Object} results - Generation results containing generated file entries and outputDir
 * @returns {string} Markdown-formatted summary report
 */
function buildSummaryReport(apiData, formats, results) {
  const functionCount = apiData.reduce((sum, f) => sum + f.functions.length, 0);
  const routeCount = apiData.reduce((sum, f) => sum + f.routes.length, 0);

  return `# Documentation Generation Summary

Generated: ${new Date().toISOString()}

## Statistics
- Files Scanned: ${apiData.length}
- Functions Documented: ${functionCount}
- API Routes Found: ${routeCount}
- Output Formats: ${formats.join(', ')}

## Generated Files
${results.generated.map((g) => `- ${g.format.toUpperCase()}: \`${g.file}\``).join('\n')}

## Location
All files generated in: \`${path.relative(process.cwd(), results.outputDir) || '.'}\`
`;
}

/**
 * Names of formats that `generate` can write
 * @returns {string[]} Document format names, including aliases
 */
function docFormatNames() {
  return Object.keys(formatters).filter(
    (name) => formatters[name].type === 'doc',
  );
}

/**
 * Generate documentation in specified formats
 * @param {string} sourceDir - Source directory to parse
 * @param {string} outputDir - Output directory for generated docs
 * @param {Array} formats - Array of formats: ['markdown', 'html', 'json']
 * @returns {Promise<Object>} Generation result; success is false when nothing was generated or any format failed
 */
async function generate(
  sourceDir,
  outputDir,
  formats = ['markdown', 'html', 'json'],
  userConfig = null,
) {
  try {
    const config = userConfig || (await loadConfig());

    console.log(`\n📂 Scanning directory: ${sourceDir}`);

    // Parse all files in directory
    const apiData = await parser.parseDirectory(sourceDir, config);

    if (apiData.length === 0) {
      console.warn(
        '⚠️  No JavaScript/TypeScript files found or no API documentation detected.',
      );
      return { success: false, message: 'No files processed' };
    }

    console.log(`✅ Parsed ${apiData.length} file(s)`);

    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    const results = {
      success: true,
      filesProcessed: apiData.length,
      outputDir: path.resolve(outputDir),
      generated: [],
      failed: [],
      skipped: [],
    };

    // Generate each format
    for (const format of formats) {
      const lowerFormat = format.toLowerCase().trim();
      const formatter = formatters[lowerFormat];

      if (!formatter) {
        console.warn(`⚠️  Unknown format: ${format}`);
        results.skipped.push({ format: lowerFormat, reason: 'Unknown format' });
        continue;
      }

      if (formatter.type !== 'doc') {
        console.warn(
          `⚠️  "${format}" is a coverage report format; use the audit command`,
        );
        results.skipped.push({
          format: lowerFormat,
          reason: 'Report format; use audit',
        });
        continue;
      }

      try {
        const content = formatter.generate(apiData, config);
        const filename = formatter.filename;

        const outputPath = path.join(outputDir, filename);
        await fs.writeFile(outputPath, content, 'utf8');
        results.generated.push({
          format: lowerFormat,
          file: filename,
          path: outputPath,
        });
        console.log(`✅ Generated: ${filename}`);
      } catch (err) {
        console.warn(`⚠️  Failed to generate ${format}: ${err.message}`);
        results.failed.push({ format: lowerFormat, error: err.message });
      }
    }

    results.success =
      results.generated.length > 0 && results.failed.length === 0;

    // Generate summary report
    const summary = buildSummaryReport(apiData, formats, results);
    await fs.writeFile(
      path.join(outputDir, 'GENERATION_REPORT.md'),
      summary,
      'utf8',
    );
    console.log(`\n📊 Generation Report: GENERATION_REPORT.md`);

    if (results.success) {
      console.log(`\n✨ Documentation generated successfully!`);
    } else if (results.failed.length > 0) {
      const failedFormats = results.failed.map((f) => f.format).join(', ');
      console.error(
        results.generated.length > 0
          ? `\n❌ Documentation generated with errors: ${failedFormats} failed`
          : `\n❌ No documentation was generated: ${failedFormats} failed`,
      );
    } else {
      console.error(
        `\n❌ No documentation was generated. Valid formats: ${docFormatNames().join(', ')}`,
      );
    }
    console.log(`📁 Output directory: ${path.resolve(outputDir)}`);

    return results;
  } catch (err) {
    console.error(`❌ Error generating documentation: ${err.message}`);
    return { success: false, error: err.message };
  }
}

export {
  buildSummaryReport,
  defaultConfig,
  generate,
  getDefaultConfig,
  loadConfig,
};
