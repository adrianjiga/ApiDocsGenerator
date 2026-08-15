export default {
  // Regex pattern for directories to skip when scanning
  excludePattern: 'node_modules|dist|build',

  // Base URL used in curl examples (Markdown & HTML output)
  serverUrl: 'http://localhost:3000',

  // Title shown in OpenAPI spec and generated docs
  apiTitle: 'API Documentation',

  // Version string used in OpenAPI spec and JSON output
  apiVersion: '1.0.0',

  // Optional: restrict route detection to these Express/Fastify instance
  // identifiers (e.g. ['app', 'router']). Leave empty for broad detection.
  // routeServers: ['app', 'router'],
};
