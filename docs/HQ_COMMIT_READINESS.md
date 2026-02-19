# HQ Commit / Ship Readiness Workflow

Use this before shipping HQ changes so the founder has one quick status check and copy/paste command path.

## Quick Start

```bash
npm run hq:ready
npm run hq:verify
npm run hq:commit
npm run hq:release-notes
npm run hq:changelog:snapshot
npm run hq:consistency
npm run hq:tooling-chain
npm run hq:tooling-chain:demo
npm run hq:founder-status
npm run hq:heartbeat
npm run hq:heartbeat:validate
npm run hq:heartbeat:check
npm run hq:heartbeat:smoke
npm run hq:heartbeat:regression
npm run hq:heartbeat:suite
npm run hq:heartbeat:suite:explain
npm run hq:heartbeat:suite:explain:json
npm run hq:heartbeat:suite:explain:json:line
npm run hq:heartbeat:suite:explain:validate
npm run hq:heartbeat:contracts
npm run hq:heartbeat:gates
npm run hq:heartbeat:preflight
npm run hq:heartbeat:preflight:validate
npm run hq:precommit
# or a single guided dry-run founder handoff:
npm run hq:handoff
```

`hq:ready` prints:
- changed file counts (all vs HQ-scoped)
- HQ file status (`git status --porcelain` style)
- recommended `git add` command for HQ files
- suggested review + commit commands
- a heads-up list of non-HQ unstaged files

`hq:verify` enforces founder-safe pre-commit checks:
- blocks when no files are staged
- blocks when any non-HQ file is staged
- blocks when merge-conflict status is present
- prints staged HQ and staged non-HQ lists
- highlights HQ files still unstaged (heads-up)

`hq:commit` prints:
- safe staged-file checklist before commit
- staged/unstaged HQ file rollup
- conventional commit subject/body template for current HQ paths
- copy/paste commit command scaffold (when files are staged)

`hq:handoff` prints a final founder handoff summary:
- runs `hq:ready`, `hq:verify`, and `hq:commit` in sequence
- shows PASS/FAIL + full output per step in one report
- exits non-zero when required verification fails
- dry-run only (no staging, no commit, no push)

`hq:release-notes` prints a founder-ready markdown draft from current HQ git state:
- summarizes HQ scopes + file-level status from detected changes
- includes rough line-change footprint (+/-) per file
- includes a QA checklist and narrative stub you can finalize
- dry-run only (reads git status/diff, makes no mutations)

`hq:changelog:snapshot` persists that release-notes output into a timestamped file:
- writes to `docs/hq-changelog/hq-release-notes-YYYYMMDD-HHMMSSZ.md`
- creates `docs/hq-changelog/` automatically when missing
- dry-run-safe for git operations (reads git state + file creation only)

`hq:consistency` validates HQ workflow consistency (dry-run only):
- checks shared `HQ_PATH_HINTS` parity across HQ helper scripts
- checks Scope Hints docs parity against script hints
- checks `npm run hq:*` command references in README + HQ workflow docs
- outputs concise PASS/FAIL with fix suggestions

`hq:tooling-chain` runs the full HQ dry-run sequence in one command:
- executes `hq:consistency`, `hq:ready`, `hq:verify`, `hq:release-notes`, then `hq:handoff`
- prints each step output, then an ordered dashboard with per-step PASS/FAIL
- includes next-action guidance keyed to the first failure (or ship-readiness path when all pass)
- dry-run only: never stages, commits, or pushes

`hq:tooling-chain:demo` wraps the same chain in a temporary-index stage simulation:
- builds a throwaway git index (`GIT_INDEX_FILE`) seeded from `HEAD`
- stages detected HQ-scoped changed files only into that temporary index
- runs `hq:tooling-chain` against simulated staging for guaranteed-green demos
- performs cleanup automatically (real staged files remain unchanged)

`hq:founder-status` prints a concise founder heartbeat snapshot:
- runs the HQ dry-run tooling steps and captures a compact PASS/FAIL matrix
- marks which checks are required vs optional for ship readiness
- prints one suggested next command (first failing step, or lint/build when all pass)
- intentionally concise for heartbeat updates and async founder check-ins

`hq:heartbeat` supports four dry-run output modes:
- default human mode: single-line sentence with hash, required state, and next command
- `--json` / `-j`: machine-readable JSON payload
- `--quiet` / `-q`: minimal cron-safe token line with stable parseable fields
- `--tsv` / `-t`: shell-friendly tab-separated row (`type,mode,status,hash,required_passed,required_total,state,next_key,next_command,strict,strict_exit`)

In all modes:
- required HQ checks remain `consistency`, `verify`, `handoff`
- suggested next command is first failing required step, otherwise lint/build
- `--strict` / `-s` keeps output mode unchanged but exits non-zero when required checks fail

Automation/cron-friendly examples:
- status-only JSON (always exits zero unless script/runtime errors): `npm run hq:heartbeat -- --json`
- minimal parseable token line: `npm run hq:heartbeat -- --quiet`
- shell-friendly TSV row: `npm run hq:heartbeat -- --tsv`
- gate job on required checks with minimal output: `npm run hq:heartbeat -- --quiet --strict`
- gate job with TSV output for `cut/awk`: `npm run hq:heartbeat -- --tsv --strict`
- human one-liner with strict exit semantics: `npm run hq:heartbeat -- --strict`

Parser helpers (still dry-run only):

```bash
# TSV: quick field extraction (1:type 2:mode 3:status 4:hash ...)
row="$(npm run --silent hq:heartbeat -- --tsv)"
status="$(printf '%s\n' "$row" | cut -f3)"
next_cmd="$(printf '%s\n' "$row" | cut -f9)"
echo "status=$status next=$next_cmd"

# TSV: awk gate example (PASS/FAIL + strict-exit preview in col 11)
npm run --silent hq:heartbeat -- --tsv | awk -F '\t' '{print "status=" $3 " strict_exit=" $11}'

# JSON mode: jq extraction for automation
npm run --silent hq:heartbeat -- --json | jq -r '
  "status=\(.required.passed)/\(.required.total) next=\(.next) strict_exit=\(.strictExitCode)"'
```

### Heartbeat Schema Reference (compact)

All heartbeat modes are **dry-run only** and evaluate the same required checks (`consistency`, `verify`, `handoff`).

Human/default (`npm run hq:heartbeat`):
- one line: `HQ heartbeat dry-run @<hash>: required <passed>/<total> (<state>); next <command>`
- primary fields: `hash`, `required summary/state`, `next command`

JSON (`--json`):
- object fields: `mode`, `command`, `hash`, `required.{passed,total,state}`, `next`, `strict`, `strictExitCode`
- `required.state` shape: `{ consistency: boolean, verify: boolean, handoff: boolean }`

Quiet (`--quiet`):
- token prefix: `HQ_HEARTBEAT`
- stable key/value fields:
  - `mode`, `status`, `hash`, `required_passed`, `required_total`, `state`, `next_key`, `strict`, `strict_exit`

TSV (`--tsv`):
- fixed columns:
  1. `type` (`HQ_HEARTBEAT`)
  2. `mode`
  3. `status`
  4. `hash`
  5. `required_passed`
  6. `required_total`
  7. `state`
  8. `next_key`
  9. `next_command`
  10. `strict`
  11. `strict_exit`

Strict exit semantics (`--strict`):
- without `--strict`: exits `0` unless runtime/script error
- with `--strict`: exits `1` when any required check fails, else `0`
- output format stays the same in all modes; only process exit behavior changes
- `strict_exit`/`strictExitCode` preview the strict result in output payloads

Machine-readable reference: `docs/hq-heartbeat.schema.json`

Schema validation command (dry-run CI-friendly): `npm run hq:heartbeat:validate`

Combined cron-friendly summary command (dry-run only): `npm run hq:heartbeat:check`
- emits one compact token line: `HQ_HEARTBEAT_CHECK mode=dry-run status=PASS|FAIL ...`
- runs heartbeat emit (`--quiet`) plus schema validation in one step
- add `--strict` to exit non-zero when either heartbeat required checks fail or schema validation fails

Heartbeat smoke test command (dry-run only): `npm run hq:heartbeat:smoke`
- runs heartbeat modes (`human`, `json`, `quiet`, `tsv`) plus `hq:heartbeat:check`
- validates each mode's output shape and reports compact mode-level PASS/FAIL state
- local verification utility only; no git/project mutations

Heartbeat regression command (dry-run only): `npm run hq:heartbeat:regression`
- runs heartbeat output modes (`human`, `json`, `quiet`, `tsv`) and compares shared invariants
- checks token prefixes, field presence, and stable field/order contracts for quiet + JSON payloads
- verifies cross-mode consistency (`hash`, required counts/state, status, next_key, strict defaults)
- emits compact PASS/FAIL summary for cron/CI dry-run parsing (`--strict` for fail-fast exit)

Heartbeat umbrella command (dry-run only): `npm run hq:heartbeat:suite`
- runs `hq:heartbeat:check`, `hq:heartbeat:smoke`, and `hq:heartbeat:regression` in one sequence
- emits exactly one final compact summary line (`HQ_HEARTBEAT_SUITE ...`) with per-subcheck state + overall status
- supports `--strict` for fail-fast cron/CI exit semantics while preserving output format
- add `--explain` (or run `npm run hq:heartbeat:suite:explain`) to prepend concise one-line reasons per subcheck (`PASS/FAIL + why`) without verbose child logs
- add `--explain-json` (or run `npm run hq:heartbeat:suite:explain:json`) for compact machine-readable reason objects per subcheck (`HQ_HEARTBEAT_SUITE_EXPLAIN_JSON { ... }`)
- add `--explain-json-line` (or run `npm run hq:heartbeat:suite:explain:json:line`) for a compact machine-readable aggregate reason line (`HQ_HEARTBEAT_SUITE_EXPLAIN_JSON_LINE { ... }`) that summarizes all subchecks in one JSON object
- use `npm run hq:heartbeat:suite:explain:validate` to dry-run validate suite explain contracts (schema + stable field-order checks) for parser-safe automation
- use `npm run hq:heartbeat:contracts` to run `hq:heartbeat:validate` + `hq:heartbeat:suite:explain:validate` together and emit one compact `HQ_HEARTBEAT_CONTRACTS ...` PASS/FAIL summary line for cron/CI
- use `npm run hq:heartbeat:gates` to run `hq:heartbeat:contracts` + `hq:heartbeat:preflight:validate` + `hq:heartbeat:suite:explain:validate` and emit one compact `HQ_HEARTBEAT_GATES ...` PASS/FAIL summary line with strict exit semantics by default (`--no-strict` for report-only)
- use `npm run hq:heartbeat:preflight` to run `hq:heartbeat:contracts` + `hq:heartbeat:suite` + `hq:founder-status` and emit one compact `HQ_HEARTBEAT_PREFLIGHT ...` overall PASS/FAIL line with key sub-status fields for operators/cron
- use `npm run hq:heartbeat:preflight:validate` to dry-run validate `HQ_HEARTBEAT_PREFLIGHT` contracts (required fields, stable field order, and key status/count invariants) against `docs/hq-heartbeat-preflight.schema.json`

Preflight parser helpers (cron/operator dry-run):

```bash
# token line -> pick key fields with awk
npm run --silent hq:heartbeat:preflight \
  | awk '{
      for (i=1; i<=NF; i++) {
        split($i, kv, "=");
        if (kv[1] == "status" || kv[1] == "contracts" || kv[1] == "suite" || kv[1] == "founder" || kv[1] == "founder_next_key") {
          printf "%s=%s ", kv[1], kv[2];
        }
      }
      print "";
    }'

# token line -> JSON object -> jq selectors
npm run --silent hq:heartbeat:preflight \
  | tr ' ' '\n' \
  | awk -F'=' '/=/{printf "%s\t%s\n", $1, substr($0, index($0, "=")+1)}' \
  | jq -Rn '[inputs | split("\t") | select(length == 2) | {(.[0]): .[1]}] | add' \
  | jq -r '"status=\(.status) suite=\(.suite_passed)/\(.suite_total) founder_next_key=\(.founder_next_key)"'

# Node.js-only parser/helper path (no awk/jq)
node scripts/examples/hq-heartbeat-preflight-parse-node.mjs
```

Optional helper scripts:
- bash + jq: `scripts/examples/hq-heartbeat-preflight-parse.sh`
- Node.js-only (no awk/jq required): `scripts/examples/hq-heartbeat-preflight-parse-node.mjs`

Gates parser helpers (cron/CI operator dry-run):

```bash
# token line -> pick key fields with awk
npm run --silent hq:heartbeat:gates -- --no-strict \
  | awk '{
      for (i=1; i<=NF; i++) {
        split($i, kv, "=");
        if (kv[1] == "status" || kv[1] == "strict" || kv[1] == "strict_exit" || kv[1] == "contracts" || kv[1] == "preflight_validate" || kv[1] == "suite_explain_validate") {
          printf "%s=%s ", kv[1], kv[2];
        }
      }
      print "";
    }'

# token line -> JSON object -> jq selectors
npm run --silent hq:heartbeat:gates -- --no-strict \
  | tr ' ' '\n' \
  | awk -F'=' '/=/{printf "%s\t%s\n", $1, substr($0, index($0, "=")+1)}' \
  | jq -Rn '[inputs | split("\t") | select(length == 2) | {(.[0]): .[1]}] | add' \
  | jq -r '"status=\(.status) strict_exit=\(.strict_exit) contracts=\(.contracts) preflight_validate=\(.preflight_validate) suite_explain_validate=\(.suite_explain_validate)"'
```

Optional helper scripts:
- bash + awk + jq: `scripts/examples/hq-heartbeat-gates-parse.sh`
- Node.js-only (no awk/jq required): `scripts/examples/hq-heartbeat-gates-parse-node.mjs`

Contract validator (cron/CI-friendly, dry-run only): `npm run hq:heartbeat:preflight:validate`

Suite explain JSON contract (consumer reference):
- per-subcheck line prefix: `HQ_HEARTBEAT_SUITE_EXPLAIN_JSON`
  - top-level field order: `subcheck`, `status`, `reason`
  - `subcheck` enum/order in stream: `check`, `smoke`, `regression`
  - `status`: `PASS | FAIL`
  - `reason` object starts with `code`, `reason`; may include optional diagnostic fields (`stderrPreview`, `passed`, `total`, `state`, `status`)
- aggregate line prefix: `HQ_HEARTBEAT_SUITE_EXPLAIN_JSON_LINE`
  - top-level field order: `mode`, `status`, `passed`, `total`, `state`, `checks`
  - `mode` is always `dry-run`
  - `state` token order: `check:<P|F>,smoke:<P|F>,regression:<P|F>`
  - `checks` array order matches subcheck execution order (`check`, `smoke`, `regression`)
- reference schema: `docs/hq-heartbeat-suite-explain.schema.json`

Reference snippets:
- `scripts/examples/hq-heartbeat-parse.sh`
- `scripts/examples/hq-heartbeat-preflight-parse.sh`
- `scripts/examples/hq-heartbeat-preflight-parse-node.mjs`
- `scripts/examples/hq-heartbeat-gates-parse.sh`
- `scripts/examples/hq-heartbeat-gates-parse-node.mjs`

`hq:precommit` is a convenience alias:
- runs `hq:verify` then `hq:commit` in sequence
- exits non-zero if verification fails

## Typical Flow

1. Make HQ edits
2. Run `npm run hq:ready`
3. Stage suggested files
4. Run `npm run hq:verify` (must pass before commit)
5. Run lint/build
6. Commit and push

Example:

```bash
# demo-only (safe):
npm run hq:tooling-chain:demo

# real commit prep:
npm run hq:handoff
npm run lint
npm run build
git commit -m "feat(hq): package founder-ready commit workflow"
git push origin $(git branch --show-current)
```

## Scope Hints

The script treats these paths as HQ-related by default:
- `src/components/hq-view.tsx`
- `src/components/app-shell.tsx`
- `src/pages/api/hq/**`
- `src/lib/data/agents.ts`
- `src/lib/data/prompt-templates.ts`
- `scripts/hq-readiness.mjs`
- `scripts/hq-precommit-verify.mjs`
- `scripts/hq-commit-package.mjs`
- `scripts/hq-founder-handoff.mjs`
- `scripts/hq-release-notes.mjs`
- `scripts/hq-changelog-snapshot.mjs`
- `scripts/hq-workflow-consistency.mjs`
- `scripts/hq-tooling-chain.mjs`
- `scripts/hq-tooling-chain-demo.mjs`
- `scripts/hq-founder-status.mjs`
- `scripts/hq-heartbeat.mjs`
- `docs/HQ_COMMIT_READINESS.md`
- `docs/hq-changelog/**`
- `README.md`
- `package.json`

If HQ surface area grows, update `HQ_PATH_HINTS` in the HQ scripts under `scripts/`.

## Optional Local Hook (Founder Workflow)

If you want a local pre-commit guard for HQ work:

```bash
cat > .git/hooks/pre-commit <<'EOF'
#!/usr/bin/env bash
npm run hq:verify
EOF
chmod +x .git/hooks/pre-commit
```

This hook is local-only (not committed) and will stop commits until `hq:verify` passes.
