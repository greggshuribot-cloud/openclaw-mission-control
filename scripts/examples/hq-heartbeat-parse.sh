#!/usr/bin/env bash
set -euo pipefail

# Dry-run parser helper for HQ heartbeat outputs.
# Does not mutate git state or project files.

row="$(npm run --silent hq:heartbeat -- --tsv)"
status="$(printf '%s\n' "$row" | cut -f3)"
hash="$(printf '%s\n' "$row" | cut -f4)"
next_cmd="$(printf '%s\n' "$row" | cut -f9)"
strict_exit_preview="$(printf '%s\n' "$row" | cut -f11)"

echo "[tsv] status=$status hash=$hash next=$next_cmd strict_exit_preview=$strict_exit_preview"

npm run --silent hq:heartbeat -- --tsv | awk -F '\t' '{print "[awk] required_passed=" $5 " required_total=" $6 " state=" $7}'

npm run --silent hq:heartbeat -- --json | jq -r '
  "[json] required=\(.required.passed)/\(.required.total) next=\(.next) strict_exit=\(.strictExitCode)"'

npm run --silent hq:heartbeat:validate
npm run --silent hq:heartbeat:check
npm run --silent hq:heartbeat:smoke
npm run --silent hq:heartbeat:check -- --strict || echo "[check] strict mode reports failures as non-zero (expected when required checks fail)"
npm run --silent hq:heartbeat:smoke -- --strict || echo "[smoke] strict mode reports mode failures as non-zero (expected when checks fail)"
