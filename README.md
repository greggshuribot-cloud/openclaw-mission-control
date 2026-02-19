# OpenClaw Mission Control

Founder Mode operating system for orchestrating a multi-agent AI startup team in a persistent virtual office.

## Stack
- Next.js 16 (App Router)
- Tailwind CSS
- Zustand state
- React Flow (dependency map)
- Prisma + PostgreSQL

## Local Setup
```bash
npm install
cp .env.example .env   # if needed
npm run dev
```

## Database (Prisma + Postgres)
1. Set `DATABASE_URL` in `.env`
2. Create migration:
```bash
npx prisma migrate dev --name init
```
3. Generate client:
```bash
npx prisma generate
```

## Auth Setup (Milestone 1)
Set these env vars in `.env`:
- `SESSION_SECRET` (long random string, at least 32 chars)
- `FOUNDER_EMAIL`
- `FOUNDER_PASSWORD`

Example:
```env
SESSION_SECRET="replace-with-a-long-random-secret"
FOUNDER_EMAIL="founder@openclaw.com"
FOUNDER_PASSWORD="replace-with-a-strong-password"
MONTHLY_CAP_UNITS="10000"
CURRENT_USED_UNITS="2500"
```

First login behavior:
- On the first successful login attempt using `FOUNDER_EMAIL`, the app auto-creates the founder row in `users` if it does not exist yet.
- Passwords are stored as `scrypt` hashes in `password_hash`.

Auth routes:
- `POST /api/auth/login`
- `POST /api/auth/logout`

Route protection:
- `/` requires a valid session cookie and redirects to `/login` when unauthenticated.

## Current Scope (v0 Scaffold)
- Main navigation tabs
- Office Home view with zones + live agent state
- Company Meeting toggle (state freeze/teleport)
- Dispatch tab stubs
- Current Sprint dependency graph (React Flow)
- Prisma schema from PRD base tables

## Founder Commit / Ship Readiness (HQ)
Run this before shipping HQ changes:

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
# or one guided dry-run handoff:
npm run hq:handoff
```

`hq:ready` prints HQ-specific changed file status and recommended stage/commit commands.
`hq:verify` is a founder-safe pre-commit guard: it blocks when non-HQ files are staged and surfaces commit blockers early.
`hq:commit` prints a safe staged-file checklist plus a conventional commit subject/body template for the current HQ slice.
`hq:handoff` runs readiness + verify + commit packaging in one founder handoff output (dry-run only; never auto-commits).
`hq:release-notes` generates a founder-ready markdown release-notes draft from currently detected HQ changes (dry-run; no git mutations).
`hq:changelog:snapshot` writes that draft to `docs/hq-changelog/` as a timestamped markdown snapshot (file creation only).
`hq:consistency` validates HQ helper-script/docs consistency (shared HQ path hints + command references) and emits a concise PASS/FAIL report with fix suggestions (dry-run only).
`hq:tooling-chain` runs the full HQ dry-run chain in order (`consistency → readiness → verify → release-notes → handoff`) and prints an ordered PASS/FAIL dashboard with next-action guidance.
`hq:tooling-chain:demo` runs that same chain against a temporary git index that stages only HQ-scoped changed files, then cleans up automatically (real staging area remains untouched).
`hq:founder-status` prints a concise heartbeat-friendly founder snapshot with the latest HQ tooling PASS/FAIL matrix and one suggested next command.
`hq:heartbeat` emits a single compact dry-run status sentence (`hash + required-check state + next command`) in default human mode.
Use `npm run hq:heartbeat -- --json` (or `node scripts/hq-heartbeat.mjs --json`) for machine-readable JSON output.
Use `npm run hq:heartbeat -- --quiet` for a minimal cron-safe token line with stable parseable fields.
Use `npm run hq:heartbeat -- --tsv` for a shell-friendly tab-separated row (`type,mode,status,hash,required_passed,required_total,state,next_key,next_command,strict,strict_exit`).
Add `--strict` (or `-s`) to make automation/cron fail fast when required checks are failing, e.g. `npm run hq:heartbeat -- --quiet --strict`.
Use `npm run hq:heartbeat:validate` for CI-friendly dry-run schema validation of `hq:heartbeat --json` against `docs/hq-heartbeat.schema.json`.
Use `npm run hq:heartbeat:check` for a single compact cron-safe line that runs heartbeat emit + schema validation together (`--strict` for fail-fast exit semantics).
Use `npm run hq:heartbeat:smoke` for a compact local dry-run summary that verifies heartbeat mode outputs (`human/json/quiet/tsv/check`) with mode-level PASS/FAIL.
Use `npm run hq:heartbeat:regression` for cross-mode dry-run regression checks (field presence/order/token-prefix invariants) with compact pass/fail output for cron/CI parsing.
Use `npm run hq:heartbeat:suite` for a single umbrella dry-run command that runs `hq:heartbeat:check` + `hq:heartbeat:smoke` + `hq:heartbeat:regression` and emits one final compact cron/CI summary line with per-subcheck state and overall status.
Add `--explain` (or use `npm run hq:heartbeat:suite:explain`) to print one concise per-subcheck reason line (`PASS/FAIL + why`) before the final suite summary, without verbose logs.
Add `--explain-json` (or use `npm run hq:heartbeat:suite:explain:json`) to print one compact machine-readable JSON reason object per subcheck (`HQ_HEARTBEAT_SUITE_EXPLAIN_JSON { ... }`) before the same final suite summary line.
Add `--explain-json-line` (or use `npm run hq:heartbeat:suite:explain:json:line`) to print one compact machine-readable aggregate JSON line summarizing all subcheck reasons (`HQ_HEARTBEAT_SUITE_EXPLAIN_JSON_LINE { ... }`).
Use `npm run hq:heartbeat:suite:explain:validate` for dry-run contract validation of both suite explain JSON surfaces (per-subcheck JSON lines + aggregate JSON line) against `docs/hq-heartbeat-suite-explain.schema.json`, including stable field-order checks for consumers.
Use `npm run hq:heartbeat:contracts` for one compact cron/CI dry-run summary line that combines `hq:heartbeat:validate` + `hq:heartbeat:suite:explain:validate` into a single PASS/FAIL contract gate.
Use `npm run hq:heartbeat:gates` for one compact cron/CI dry-run summary line that runs `hq:heartbeat:contracts` + `hq:heartbeat:preflight:validate` + `hq:heartbeat:suite:explain:validate` and emits strict pass/fail exit semantics by default.
Use `npm run hq:heartbeat:preflight` for one compact operator/cron dry-run preflight summary line that combines `hq:heartbeat:contracts` + `hq:heartbeat:suite` + `hq:founder-status` into one overall PASS/FAIL signal with sub-status fields.
Use `npm run hq:heartbeat:preflight:validate` for dry-run contract validation of `HQ_HEARTBEAT_PREFLIGHT` output (required fields, stable field order, and key status/count invariants) against `docs/hq-heartbeat-preflight.schema.json`.

Quick parser examples:
```bash
# TSV -> status + next command
row="$(npm run --silent hq:heartbeat -- --tsv)"
printf 'status=%s next=%s\n' "$(printf '%s\n' "$row" | cut -f3)" "$(printf '%s\n' "$row" | cut -f9)"

# JSON -> jq summary
npm run --silent hq:heartbeat -- --json | jq -r '"required=\(.required.passed)/\(.required.total) next=\(.next)"'

# PREFLIGHT token line -> key fields (cron-safe)
npm run --silent hq:heartbeat:preflight | awk '{for (i=1; i<=NF; i++) {split($i, kv, "="); if (kv[1] ~ /^(status|contracts|suite|founder|founder_next_key)$/) printf "%s=%s ", kv[1], kv[2];} print ""}'

# PREFLIGHT token line -> Node.js helper (no awk/jq)
node scripts/examples/hq-heartbeat-preflight-parse-node.mjs

# GATES token line -> key fields (cron/CI-safe)
npm run --silent hq:heartbeat:gates -- --no-strict | awk '{for (i=1; i<=NF; i++) {split($i, kv, "="); if (kv[1] ~ /^(status|strict|strict_exit|contracts|preflight_validate|suite_explain_validate)$/) printf "%s=%s ", kv[1], kv[2];} print ""}'
```

Preflight helper scripts for cron/CI operators:
- bash + jq: `scripts/examples/hq-heartbeat-preflight-parse.sh`
- Node.js-only (no awk/jq required): `scripts/examples/hq-heartbeat-preflight-parse-node.mjs`

Gates helper scripts for cron/CI operators:
- bash + awk + jq: `scripts/examples/hq-heartbeat-gates-parse.sh`
- Node.js-only (no awk/jq required): `scripts/examples/hq-heartbeat-gates-parse-node.mjs`

Detailed guide: `docs/HQ_COMMIT_READINESS.md`.

## Next Milestones
1. Auth + founder session
2. Real task/proposal CRUD backed by Postgres
3. PM gatekeeper flow (Approve/Reject)
4. PixiJS rendering upgrade for office canvas
5. Treasury burn-rate calculations + alerts
