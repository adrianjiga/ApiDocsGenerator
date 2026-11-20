---
name: output-diff
description: Compare the docs and audit output the CLI generates at a git ref (default HEAD) with the working tree, to prove a refactor changed no output or to see exactly what a behaviour change alters. Use after refactors of src/parser, src/formatters or src/analyzer, and before committing changes that should be output-neutral.
argument-hint: "[base-ref] [input-dir ...]"
---

# Output diff

Run the bundled script from the repository root:

```bash
.claude/skills/output-diff/scripts/diff-output.sh [base-ref] [input-dir ...]
```

- `base-ref` defaults to `HEAD`. Use `main` to see everything a branch changes, or a commit hash to isolate one change.
- Input directories default to `examples tests`. Add any directory relative to the repo root, e.g. `src`.

The script checks `base-ref` out into a temporary git worktree (sharing this repo's `node_modules`), runs `generate` (markdown, html, json, openapi) and `audit --format json` with both versions against the same inputs, masks timestamps and output paths, and prints a unified diff. It removes the worktree on exit.

Exit code `0` means no differences; `1` means the diff above it is the complete change in output.

## Reading the result

- For a refactor, any difference is a regression to explain or fix before committing.
- For a behaviour change, check every hunk is intended, then mention the visible output change in `CHANGELOG.md`.
- Scanning `src` compares the tool's own source, which differs whenever `src` changes; prefer `examples` and `tests` for behaviour checks.
