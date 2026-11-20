---
name: release-prep
description: Prepare a release of @adrianjiga/api-docs-generator on the current branch - bump the version, date the CHANGELOG, update version examples in the docs and verify - following the Releasing section of CONTRIBUTING.md. Does not tag or publish.
argument-hint: "<version, e.g. 0.3.0>"
disable-model-invocation: true
---

# Release prep

Prepare version `$ARGUMENTS` in the pull request that ships it. Tagging and publishing happen after merge and are not part of this skill.

1. **Choose the version** if `$ARGUMENTS` is empty: read the `[Unreleased]` section of `CHANGELOG.md` and propose one under semver (below 1.0, new features or behaviour changes are a minor bump, fixes only a patch). Confirm it with the user before continuing.
2. **Bump** with `npm version <version> --no-git-tag-version`. This updates `package.json` and `package-lock.json` and creates no tag.
3. **Date the CHANGELOG**: rename `## [Unreleased]` to `## [<version>] - <today, YYYY-MM-DD>` and add `[<version>]: https://github.com/adrianjiga/ApiDocsGenerator/releases/tag/v<version>` above the previous link at the bottom.
4. **Update version examples**: `grep -rn "<previous version>" README.md docs AGENTS.md CONTRIBUTING.md SECURITY.md`. Update examples such as `"toolVersion"` in `docs/output-reference.md`. Leave `docs/decisions/` alone: ADRs are history.
5. **Verify** in CI order: `npm run check`, `npm test`, `npm run audit:self`, then `node bin/api-docs-generator --version` must print the new version.
6. **Commit** as `chore(release): bump version to <version> and date the changelog`, single line, 60 to 80 characters.
7. **Hand off**: tell the user that after the PR merges, publishing a GitHub release tagged `v<version>` runs `publish.yml`, which stages the package on npm for their two-factor approval (`npm stage list @adrianjiga/api-docs-generator`, then `npm stage approve <stage-id>`).

Never create the tag, push, or publish yourself.
