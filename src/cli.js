import path from 'path';
import { program } from 'commander';
import * as generator from './generator.js';

program
  .name('api-doc-gen')
  .description('Auto-generates API documentation from JavaScript/TypeScript source code')
  .version('1.0.0');

program
  .command('generate')
  .alias('gen')
  .description('Generate API documentation')
  .option('-d, --dir <directory>', 'Source directory to scan', '.')
  .option('-o, --output <directory>', 'Output directory for generated docs', './docs')
  .option('-f, --formats <formats>', 'Output formats (comma-separated: markdown,html,json)', 'markdown,html,json')
  .action(async (options) => {
    const sourceDir = path.resolve(options.dir);
    const outputDir = path.resolve(options.output);
    const formats = options.formats.split(',').map(f => f.trim());

    console.log('\n🚀 Starting API Documentation Generation...');
    await generator.generate(sourceDir, outputDir, formats);
  });

program
  .command('scan [directory]')
  .description('Scan directory and show found APIs')
  .action(async (directory) => {
    const dir = path.resolve(directory || '.');
    
    console.log(`\n📂 Scanning: ${dir}\n`);
    const apiData = parser.parseDirectory(dir);
    
    if (apiData.length === 0) {
      console.log('⚠️  No JavaScript/TypeScript files found');
      return;
    }

    apiData.forEach(file => {
      if (file.functions.length > 0 || file.routes.length > 0) {
        console.log(`\n📄 ${file.fileName}`);
        
        if (file.functions.length > 0) {
          console.log(`  Functions: ${file.functions.map(f => f.name).join(', ')}`);
        }
        
        if (file.routes.length > 0) {
          console.log(`  Routes: ${file.routes.map(r => `${r.method} ${r.path}`).join(', ')}`);
        }
      }
    });

    console.log(`\n✅ Found ${apiData.length} file(s) with ${apiData.reduce((s, f) => s + f.functions.length, 0)} function(s) and ${apiData.reduce((s, f) => s + f.routes.length, 0)} route(s)\n`);
  });

// Default command
program
  .action(() => {
    if (process.argv.length === 2) {
      program.outputHelp();
    }
  });

program.parse(process.argv);
