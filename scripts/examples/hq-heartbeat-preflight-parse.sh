#!/usr/bin/env bash
set -euo pipefail

# Dry-run parser helper for HQ preflight output.
# Reads one HQ_HEARTBEAT_PREFLIGHT token line and demonstrates
# shell + jq extraction paths for cron/CI operators.

output="$(npm run --silent hq:heartbeat:preflight 2>&1 || true)"
line="$(printf '%s\n' "$output" | grep '^HQ_HEARTBEAT_PREFLIGHT ' | tail -n1)"

if [[ -z "$line" ]]; then
  echo "[error] expected HQ_HEARTBEAT_PREFLIGHT line, got: $output" >&2
  exit 1
fi

# bash token parsing (key=value pairs)
declare -A fields=()
for token in $line; do
  [[ "$token" == *=* ]] || continue
  key="${token%%=*}"
  value="${token#*=}"
  fields["$key"]="$value"
done

echo "[bash] status=${fields[status]:-unknown} contracts=${fields[contracts]:-unknown} suite=${fields[suite]:-unknown} founder=${fields[founder]:-unknown}"
echo "[bash] suite_passed=${fields[suite_passed]:-unknown}/${fields[suite_total]:-unknown} founder_required_failures=${fields[founder_required_failures]:-unknown} founder_next_key=${fields[founder_next_key]:-unknown}"

# jq path: convert token line -> JSON object for stable downstream extraction
json="$({
  printf '%s\n' "$line" \
  | tr ' ' '\n' \
  | awk -F'=' '/=/{printf "%s\t%s\n", $1, substr($0, index($0, "=")+1)}' \
  | jq -Rn '
      [inputs
       | split("\t")
       | select(length == 2)
       | {(.[0]): .[1]}] | add
    '
} )"

echo "$json" | jq -r '"[jq] status=\(.status // "unknown") contracts=\(.contracts // "unknown") suite=\(.suite // "unknown") founder=\(.founder // "unknown")"'
echo "$json" | jq -r '"[jq] suite=\(.suite_passed // "unknown")/\(.suite_total // "unknown") founder_required_failures=\(.founder_required_failures // "unknown") founder_next_key=\(.founder_next_key // "unknown")"'

# strict mode preview (non-zero on failed required preflight checks)
npm run --silent hq:heartbeat:preflight >/dev/null || echo "[preflight] non-zero exit indicates FAIL status (expected when any subcheck fails)"