import { generateMarkdown } from './markdown.js';
import { generateHTML } from './html.js';
import { generateJSON } from './json.js';
import { generateOpenAPI } from './openapi.js';
import { formatTerminalReport } from './terminal.js';
import { generateDashboard } from './dashboard.js';

/**
 * Registry mapping format names to their generator function and default output filename.
 * Aliases (e.g. 'md', 'swagger') point to the same generator as their canonical key.
 *
 * type: 'doc' — generate(apiData, config) → string written to filename
 * type: 'report' — generate(report, threshold?) → string or void (terminal prints to stdout)
 *
 * @type {Object<string, {generate: Function, filename: string|null, type: string}>}
 */
const formatters = {
  markdown: { generate: generateMarkdown, filename: 'API.md', type: 'doc' },
  md: { generate: generateMarkdown, filename: 'API.md', type: 'doc' },
  html: { generate: generateHTML, filename: 'index.html', type: 'doc' },
  json: { generate: generateJSON, filename: 'api.json', type: 'doc' },
  openapi: { generate: generateOpenAPI, filename: 'openapi.yaml', type: 'doc' },
  swagger: { generate: generateOpenAPI, filename: 'openapi.yaml', type: 'doc' },
  terminal: { generate: formatTerminalReport, filename: null, type: 'report' },
  dashboard: {
    generate: generateDashboard,
    filename: 'coverage-dashboard.html',
    type: 'report',
  },
};

export { formatters };
