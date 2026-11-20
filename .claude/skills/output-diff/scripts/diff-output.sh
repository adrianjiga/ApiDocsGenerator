#!/usr/bin/env bash
set -euo pipefail

base="${1:-HEAD}"
shift || true
inputs=("$@")
[ ${#inputs[@]} -eq 0 ] && inputs=(examples tests)

root="$(git rev-parse --show-toplevel)"
work="$(mktemp -d)"
trap 'git -C "$root" worktree remove --force "$work/base-src" >/dev/null 2>&1 || true; rm -rf "$work"' EXIT

git -C "$root" worktree add --detach --quiet "$work/base-src" "$base"
ln -s "$root/node_modules" "$work/base-src/node_modules"

render() {
  local cli="$1" out="$2"
  for input in "${inputs[@]}"; do
    local name
    name="$(echo "$input" | tr '/' '_')"
    node "$cli" generate -d "$root/$input" -o "$out/$name" \
      -f markdown,html,json,openapi >/dev/null 2>&1 || true
    node "$cli" audit -d "$root/$input" --format json 2>/dev/null \
      >"$out/$name/audit.json" || true
  done
  find "$out" -type f -exec sed -i.bak -E \
    -e 's/[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z/<timestamp>/g' \
    -e "s#$out#<out>#g" {} +
  find "$out" -name '*.bak' -delete
}

render "$work/base-src/bin/api-docs-generator" "$work/before"
render "$root/bin/api-docs-generator" "$work/after"

if diff -ru -x GENERATION_REPORT.md "$work/before" "$work/after" | sed -e "s#$work/before#before#g" -e "s#$work/after#after#g"; then
  echo "No output differences for: ${inputs[*]} ($base vs working tree)"
else
  exit 1
fi
