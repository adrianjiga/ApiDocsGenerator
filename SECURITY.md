# Security Policy

## Supported versions

Only the latest published release is actively supported with security fixes.

## Reporting a vulnerability

Please report security issues privately using GitHub's private vulnerability
reporting on the [Security tab](https://github.com/adrianjiga/ApiDocsGenerator/security):
**Security → Report a vulnerability**. Do not open a public issue for a
security problem.

We ask that reporters keep disclosures private until a fix is released, and we
aim to acknowledge reports within 48 hours and ship a patch within 14 days.

## Scope

api-docs-generator reads source files and writes documentation. Things worth
reporting include generated HTML that executes script from scanned source,
output written outside the chosen output directory, or terminal output that
can be hijacked through scanned file contents.

The configuration file (`apidocs.config.js`, `.mjs` or `.cjs`) is JavaScript
that runs when it is loaded, by design, like ESLint or Vite configs. Code
running from a config file in a project you chose to scan is not a
vulnerability.
