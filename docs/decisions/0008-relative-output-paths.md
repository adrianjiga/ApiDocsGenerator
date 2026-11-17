# 0008 — Write paths relative to the scanned directory

**Status**: Accepted

## Context

Generated files are often committed or published (a docs site, a CI artifact).
Several outputs embedded absolute paths from the machine that ran the tool:

- `file` in `api.json`, e.g. `/Users/<name>/Projects/app/src/users.js`;
- `filePath` for each file and gap in the audit JSON;
- the output location in `GENERATION_REPORT.md`.

That leaks the local username and directory layout, and makes output differ
between machines for the same code.

## Decision

`parseDirectory` (`src/parser.js`) adds `relativePath` to each parsed file: the
path relative to the scanned directory, with `/` separators on every platform.
Output uses it:

- `generateJSON` writes `file: relativePath` (falling back to the absolute
  path for data that did not come from `parseDirectory`);
- `analyzeCoverage` uses it for `filePath`;
- `GENERATION_REPORT.md` shows the output directory relative to the working
  directory.

Internally the absolute `file` path is kept, since file labels and anchors are
derived from it.

## Consequences

- Output is the same on every machine and contains no usernames or home
  directories.
- Consumers of `api.json` that expected absolute paths must join `file` with
  the directory they scanned.
- Terminal messages (warnings, `Output directory:`) still show absolute paths,
  since they are not saved anywhere.
