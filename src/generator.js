import fs from 'fs-extra';
import fsStd from 'fs/promises';
import path from 'path';
import * as parser from './parser.js';
import { formatters } from './formatters/registry.js';

/**
 * Default configuration for the documentation generator
 * @type {Object}
 */
const defaultConfig = {
  excludePattern: 'node_modules|dist|build',
  serverUrl: 'http://localhost:3000',
  apiTitle: 'API Documentation',
  apiVersion: '1.0.0',
};

/**
 * Get a fresh copy of the default configuration
 * @returns {Object} Fresh copy of default configuration
 */
function getDefaultConfig() {
  return { ...defaultConfig };
}

/**
 * Load configuration from file and merge with defaults
 * @param {string} configPath - Path to the configuration file
 * @returns {Object} Merged configuration object
 */
async function loadConfig(configPath) {
  const defaults = getDefaultConfig();
  const filePath = configPath || path.join(process.cwd(), 'apidocs.config.js');

  try {
    await fsStd.access(filePath);
  } catch {
    return defaults;
  }

  try {
    const fileUrl = new URL(`file://${path.resolve(filePath)}`);
    const mod = await import(fileUrl.href);
    const userConfig = mod.default || mod;
    return { ...defaults, ...userConfig };
  } catch (err) {
    console.warn(
      `Warning: Failed to load config from ${filePath}: ${err.message}`,
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
All files generated in: \`${results.outputDir}\`
`;
}

/**
 * Generate documentation in specified formats
 * @param {string} sourceDir - Source directory to parse
 * @param {string} outputDir - Output directory for generated docs
 * @param {Array} formats - Array of formats: ['markdown', 'html', 'json']
 * @returns {Object} Generation result with summary
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
    await fs.ensureDir(outputDir);

    const results = {
      success: true,
      filesProcessed: apiData.length,
      outputDir: path.resolve(outputDir),
      generated: [],
      failed: [],
    };

    // Generate each format
    for (const format of formats) {
      const lowerFormat = format.toLowerCase().trim();
      const formatter = formatters[lowerFormat];

      if (!formatter) {
        console.warn(`⚠️  Unknown format: ${format}`);
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
        continue;
      }
    }

    // Generate summary report
    const summary = buildSummaryReport(apiData, formats, results);
    await fs.writeFile(
      path.join(outputDir, 'GENERATION_REPORT.md'),
      summary,
      'utf8',
    );
    console.log(`\n📊 Generation Report: GENERATION_REPORT.md`);

    console.log(`\n✨ Documentation generated successfully!`);
    console.log(`📁 Output directory: ${path.resolve(outputDir)}`);

    return results;
  } catch (err) {
    console.error(`❌ Error generating documentation: ${err.message}`);
    return { success: false, error: err.message };
  }
}

export { defaultConfig, getDefaultConfig, loadConfig, generate };
