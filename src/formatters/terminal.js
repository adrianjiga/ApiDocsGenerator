/**
 * Format and print a documentation coverage report to the terminal
 * @param {Object} report - Coverage analysis report from analyzeCoverage()
 * @param {number} threshold - Coverage threshold percentage
 */
function formatTerminalReport(report, threshold) {
  // Disable ANSI colors when not writing to a real TTY (e.g. piped to a file
  // or CI log aggregator) or when the NO_COLOR env var is set.
  const useColor =
    !process.env.NO_COLOR &&
    process.stdout.isTTY !== false &&
    process.stdout.isTTY !== undefined;

  // Use Unicode block characters only in color-capable TTY environments to
  // avoid garbage characters in older terminals and CI log viewers.
  const useUnicode = useColor;

  const c = useColor
    ? {
        red: '\x1b[31m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m',
        cyan: '\x1b[36m',
        bold: '\x1b[1m',
        dim: '\x1b[2m',
        reset: '\x1b[0m',
      }
    : {
        red: '',
        green: '',
        yellow: '',
        blue: '',
        cyan: '',
        bold: '',
        dim: '',
        reset: '',
      };

  const { summary, files, gaps } = report;
  const coverage = summary.coveragePercentage;
  const meetsThreshold = coverage >= threshold;

  // Header
  console.log(`\n${c.bold}Documentation Coverage Report${c.reset}\n`);

  // Progress bar
  const barLength = 20;
  const filledLength = Math.round((coverage / 100) * barLength);
  const emptyLength = barLength - filledLength;
  const filledBar = useUnicode
    ? '█'.repeat(filledLength)
    : '#'.repeat(filledLength);
  const emptyBar = useUnicode
    ? '░'.repeat(emptyLength)
    : '-'.repeat(emptyLength);
  const barColor = meetsThreshold ? c.green : c.red;

  console.log(`${barColor}[${filledBar}${emptyBar}] ${coverage}%${c.reset}`);

  // Summary stats
  console.log(`\n${c.cyan}Summary${c.reset}`);
  console.log(
    `  Function Coverage:  ${summary.functionCoverage}% (${summary.documentedFunctions}/${summary.totalFunctions})`,
  );
  console.log(
    `  Route Coverage:     ${summary.routeCoverage}% (${summary.documentedRoutes}/${summary.totalRoutes})`,
  );
  console.log(
    `  Total Items:        ${summary.totalFunctions + summary.totalRoutes}`,
  );
  console.log(
    `  Documented Items:   ${summary.documentedFunctions + summary.documentedRoutes}`,
  );
  console.log(`  Documentation Gaps: ${gaps.length}`);

  // Per-file breakdown
  if (files.length > 0) {
    console.log(`\n${c.cyan}Per-File Breakdown${c.reset}`);

    files.forEach((file) => {
      const fileColor =
        file.coveragePercentage === 100
          ? c.green
          : file.coveragePercentage >= threshold
            ? c.blue
            : c.red;
      console.log(
        `\n  ${fileColor}${file.fileName}${c.reset} ${c.dim}(${file.coveragePercentage}%)${c.reset}`,
      );

      if (file.gaps.length > 0) {
        file.gaps.forEach((gap) => {
          const severityIcon =
            gap.severity === 'error'
              ? `${c.red}${useUnicode ? '✗' : 'x'}${c.reset}`
              : `${c.yellow}${useUnicode ? '⚠' : '!'}${c.reset}`;
          const missingStr = gap.missing.join(', ');
          console.log(
            `    ${severityIcon} ${gap.name} ${c.dim}(line ${gap.line})${c.reset} - missing: ${missingStr}`,
          );
        });
      } else {
        console.log(
          `    ${c.green}${useUnicode ? '✓' : 'ok'} All items documented${c.reset}`,
        );
      }
    });
  }

  // Footer
  if (gaps.length > 0) {
    console.log(
      `\n${c.yellow}${gaps.length} documentation gap${gaps.length !== 1 ? 's' : ''} found.${c.reset}\n`,
    );
  } else {
    console.log(
      `\n${c.green}${useUnicode ? '✓' : 'ok'} Perfect documentation coverage!${c.reset}\n`,
    );
  }
}

export { formatTerminalReport };
