import path from "path";
import { program } from "commander";
import * as generator from "./generator.js";
import * as parser from "./parser.js";
import { analyzeCoverage } from "./analyzer.js";

program
  .name("api-docs-generator")
  .description(
    "Auto-generates API documentation from JavaScript/TypeScript source code",
  )
  .version("1.0.0");

program
  .command("generate")
  .alias("gen")
  .description("Generate API documentation")
  .option("-d, --dir <directory>", "Source directory to scan", ".")
  .option(
    "-o, --output <directory>",
    "Output directory for generated docs",
    "./docs",
  )
  .option(
    "-f, --formats <formats>",
    "Output formats (comma-separated: markdown,html,json)",
    "markdown,html,json",
  )
  .action(async (options) => {
    const sourceDir = path.resolve(options.dir);
    const outputDir = path.resolve(options.output);
    const formats = options.formats.split(",").map((f) => f.trim());

    console.log("\n🚀 Starting API Documentation Generation...");
    await generator.generate(sourceDir, outputDir, formats);
  });

program
  .command("scan [directory]")
  .description("Scan directory and show found APIs")
  .action(async (directory) => {
    const dir = path.resolve(directory || ".");

    console.log(`\n📂 Scanning: ${dir}\n`);
    const apiData = parser.parseDirectory(dir);

    if (apiData.length === 0) {
      console.log("⚠️  No JavaScript/TypeScript files found");
      return;
    }

    apiData.forEach((file) => {
      if (file.functions.length > 0 || file.routes.length > 0) {
        console.log(`\n📄 ${file.fileName}`);

        if (file.functions.length > 0) {
          console.log(
            `  Functions: ${file.functions.map((f) => f.name).join(", ")}`,
          );
        }

        if (file.routes.length > 0) {
          console.log(
            `  Routes: ${file.routes.map((r) => `${r.method} ${r.path}`).join(", ")}`,
          );
        }
      }
    });

    console.log(
      `\n✅ Found ${apiData.length} file(s) with ${apiData.reduce((s, f) => s + f.functions.length, 0)} function(s) and ${apiData.reduce((s, f) => s + f.routes.length, 0)} route(s)\n`,
    );
  });

program
  .command("audit")
  .alias("a")
  .description("Audit documentation coverage")
  .option("-d, --dir <directory>", "Source directory to scan", ".")
  .option("-t, --threshold <number>", "Coverage threshold percentage", "80")
  .option("-f, --format <format>", "Output format (terminal or json)", "terminal")
  .action(async (options) => {
    const sourceDir = path.resolve(options.dir);
    const threshold = parseInt(options.threshold, 10);
    const format = options.format.toLowerCase();

    console.log(`\n📊 Auditing documentation coverage...\n`);

    const apiData = parser.parseDirectory(sourceDir);

    if (apiData.length === 0) {
      console.log("⚠️  No JavaScript/TypeScript files found");
      return;
    }

    const result = analyzeCoverage(apiData);

    if (format === "json") {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(result.summary);
    }

    const coverage = result.summary.coveragePercentage;

    if (coverage < threshold) {
      console.log(
        `\n❌ Coverage ${coverage}% is below threshold ${threshold}%\n`,
      );
      process.exit(1);
    } else {
      console.log(
        `\n✅ Coverage ${coverage}% meets threshold ${threshold}%\n`,
      );
    }
  });

// Default command
program.action(() => {
  if (process.argv.length === 2) {
    program.outputHelp();
  }
});

program.parse(process.argv);
