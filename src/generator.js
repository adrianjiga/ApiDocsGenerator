import fs from 'fs-extra';
import path from 'path';
import * as parser from './parser.js';
import { generateMarkdown } from './formatters/markdown.js';
import { generateHTML } from './formatters/html.js';
import { generateJSON } from './formatters/json.js';
import { generateOpenAPI } from './formatters/openapi.js';

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
) {
  try {
    console.log(`\n📂 Scanning directory: ${sourceDir}`);

    // Parse all files in directory
    const apiData = parser.parseDirectory(sourceDir);

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
    };

    // Generate each format
    for (const format of formats) {
      const lowerFormat = format.toLowerCase().trim();
      let content;
      let filename;

      switch (lowerFormat) {
        case 'markdown':
        case 'md':
          content = generateMarkdown(apiData);
          filename = 'API.md';
          break;
        case 'html':
          content = generateHTML(apiData);
          filename = 'index.html';
          break;
        case 'json':
          content = generateJSON(apiData);
          filename = 'api.json';
          break;
        case 'openapi':
        case 'swagger':
          content = generateOpenAPI(apiData);
          filename = 'openapi.yaml';
          break;
        default:
          console.warn(`⚠️  Unknown format: ${format}`);
          continue;
      }

      const outputPath = path.join(outputDir, filename);
      await fs.writeFile(outputPath, content, 'utf8');
      results.generated.push({
        format: lowerFormat,
        file: filename,
        path: outputPath,
      });
      console.log(`✅ Generated: ${filename}`);
    }

    // Generate summary report
    const functionCount = apiData.reduce(
      (sum, f) => sum + f.functions.length,
      0,
    );
    const routeCount = apiData.reduce((sum, f) => sum + f.routes.length, 0);

    const summary = `# Documentation Generation Summary

      Generated: ${new Date().toISOString()}

      ## Statistics
      - Files Scanned: ${apiData.length}
      - Functions Documented: ${functionCount}
      - API Routes Found: ${routeCount}
      - Output Formats: ${formats.join(', ')}

      ## Generated Files
      ${results.generated.map((g) => `- ${g.format.toUpperCase()}: \`${g.file}\``).join('\n')}

      ## Location
      All files generated in: \`${outputDir}\`
      `;

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

export { generate };
