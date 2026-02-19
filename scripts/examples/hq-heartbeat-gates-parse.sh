#!/usr/bin/env bash
set -euo pipefail

# Dry-run parser helper for HQ gates output.
# Reads one HQ_HEARTBEAT_GATES token line and demonstrates
# bash + awk + jq extraction paths for cron/CI operators.

output="$(npm run --silent hq:heartbeat:gates -- --no-strict 2>&1 || true)"
line="$(printf '%s\n' "$output" | grep '^HQ_HEARTBEAT_GATES ' | tail -n1)"

if [[ -z "$line" ]]; then
  echo "[error] expected HQ_HEARTBEAT_GATES line, got: $output" >&2
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

echo "[bash] status=${fields[status]:-unknown} strict=${fields[strict]:-unknown} strict_exit=${fields[strict_exit]:-unknown}"
echo "[bash] contracts=${fields[contracts]:-unknown} preflight_validate=${fields[preflight_validate]:-unknown} suite_explain_validate=${fields[suite_explain_validate]:-unknown}"

# awk extraction from token line
printf '%s\n' "$line" \
  | awk '{
      for (i=1; i<=NF; i++) {
        split($i, kv, "=");
        if (kv[1] ~ /^(status|strict|strict_exit|contracts|preflight_validate|suite_explain_validate)$/) {
          printf "%s=%s ", kv[1], kv[2];
        }
      }
      print "";
    }'

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

echo "$json" | jq -r '"[jq] status=\(.status // "unknown") strict=\(.strict // "unknown") strict_exit=\(.strict_exit // "unknown")"'
echo "$json" | jq -r '"[jq] contracts=\(.contracts // "unknown") preflight_validate=\(.preflight_validate // "unknown") suite_explain_validate=\(.suite_explain_validate // "unknown")"'

# strict mode preview (default): non-zero on any failing gate
npm run --silent hq:heartbeat:gates >/dev/null || echo "[gates] non-zero exit indicates FAIL status in strict mode (expected when any gate fails)"
