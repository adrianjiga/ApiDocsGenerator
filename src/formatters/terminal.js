/**
 * Format and print a documentation coverage report to the terminal
 * @param {Object} report - Coverage analysis report from analyzeCoverage()
 * @param {number} threshold - Coverage threshold percentage
 */
function formatTerminalReport(report, threshold) {
  const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    reset: '\x1b[0m',
  };

  const { summary, files, gaps } = report;
  const coverage = summary.coveragePercentage;
  const meetsThreshold = coverage >= threshold;

  // Header
  console.log(`\n${colors.bold}Documentation Coverage Report${colors.reset}\n`);

  // Progress bar
  const barLength = 20;
  const filledLength = Math.round((coverage / 100) * barLength);
  const emptyLength = barLength - filledLength;
  const filledBar = '█'.repeat(filledLength);
  const emptyBar = '░'.repeat(emptyLength);
  const barColor = meetsThreshold ? colors.green : colors.red;

  console.log(
    `${barColor}[${filledBar}${emptyBar}] ${coverage}%${colors.reset}`,
  );

  // Summary stats
  console.log(`\n${colors.cyan}Summary${colors.reset}`);
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
    console.log(`\n${colors.cyan}Per-File Breakdown${colors.reset}`);

    files.forEach((file) => {
      const fileColor =
        file.coveragePercentage === 100
          ? colors.green
          : file.coveragePercentage >= threshold
            ? colors.blue
            : colors.red;
      console.log(
        `\n  ${fileColor}${file.fileName}${colors.reset} ${colors.dim}(${file.coveragePercentage}%)${colors.reset}`,
      );

      if (file.gaps.length > 0) {
        file.gaps.forEach((gap) => {
          const severityIcon =
            gap.severity === 'error'
              ? `${colors.red}✗${colors.reset}`
              : `${colors.yellow}⚠${colors.reset}`;
          const missingStr = gap.missing.join(', ');
          console.log(
            `    ${severityIcon} ${gap.name} ${colors.dim}(line ${gap.line})${colors.reset} - missing: ${missingStr}`,
          );
        });
      } else {
        console.log(`    ${colors.green}✓ All items documented${colors.reset}`);
      }
    });
  }

  // Footer
  if (gaps.length > 0) {
    console.log(
      `\n${colors.yellow}${gaps.length} documentation gap${gaps.length !== 1 ? 's' : ''} found.${colors.reset}`,
    );
    console.log(
      `${colors.dim}(Auto-documentation feature coming soon)${colors.reset}\n`,
    );
  } else {
    console.log(
      `\n${colors.green}✓ Perfect documentation coverage!${colors.reset}\n`,
    );
  }
}

export { formatTerminalReport };
