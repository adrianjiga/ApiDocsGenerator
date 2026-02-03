import { generateMarkdown } from './markdown.js';
import { generateHTML } from './html.js';
import { generateJSON } from './json.js';
import { generateOpenAPI } from './openapi.js';

/**
 * Registry mapping format names to their generator function and default output filename.
 * Aliases (e.g. 'md', 'swagger') point to the same generator as their canonical key.
 * @type {Object<string, {generate: Function, filename: string}>}
 */
const formatters = {
  markdown: { generate: generateMarkdown, filename: 'API.md' },
  md: { generate: generateMarkdown, filename: 'API.md' },
  html: { generate: generateHTML, filename: 'index.html' },
  json: { generate: generateJSON, filename: 'api.json' },
  openapi: { generate: generateOpenAPI, filename: 'openapi.yaml' },
  swagger: { generate: generateOpenAPI, filename: 'openapi.yaml' },
};

export { formatters };
