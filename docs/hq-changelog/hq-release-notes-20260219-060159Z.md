# HQ Release Notes Draft

_Date: 2026-02-19 · Branch: main · Draft mode (no git mutations)_

## Executive Summary
HQ currently has **7 changed file(s)** across **4 scope(s)**.
Observed diff footprint: **+33 / -2** line(s) (staged + unstaged).
Current status mix: **0 staged signal(s)**, **7 unstaged signal(s)**.

## Change Themes
- **API**: 1 file(s) updated
- **Data**: 2 file(s) updated
- **Project**: 2 file(s) updated
- **UI**: 2 file(s) updated

## File-level Notes
- **package.json** (unstaged) — +8 / -1
- **README.md** (unstaged) — +21 / -0
- **src/components/app-shell.tsx** (unstaged) — +4 / -1
- **src/components/hq-view.tsx** (new) — +0 / -0
- **src/lib/data/agents.ts** (new) — +0 / -0
- **src/lib/data/prompt-templates.ts** (new) — +0 / -0
- **src/pages/api/hq/** (new) — +0 / -0

## Founder Narrative Draft
This release tightens HQ operational readiness and founder workflow polish.
Changes concentrate on the scopes listed above and are presented as a draft summary from live git state.
No automated staging, commits, or pushes were performed.

## Founder QA Checklist
- [ ] Run `npm run hq:verify` and resolve any blockers
- [ ] Run `npm run lint && npm run build`
- [ ] Validate release summary wording against actual diff (`git diff --cached`)
- [ ] Finalize and publish notes after commit SHA is available
