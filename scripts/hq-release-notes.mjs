#!/usr/bin/env node

import { execSync } from "node:child_process";

const HQ_PATH_HINTS = [
  "src/components/hq-view.tsx",
  "src/components/app-shell.tsx",
  "src/pages/api/hq/",
  "src/lib/data/agents.ts",
  "src/lib/data/prompt-templates.ts",
  "scripts/hq-readiness.mjs",
  "scripts/hq-precommit-verify.mjs",
  "scripts/hq-commit-package.mjs",
  "scripts/hq-founder-handoff.mjs",
  "scripts/hq-release-notes.mjs",
  "scripts/hq-changelog-snapshot.mjs",
  "scripts/hq-workflow-consistency.mjs",
  "scripts/hq-tooling-chain.mjs",
  "scripts/hq-tooling-chain-demo.mjs",
  "scripts/hq-founder-status.mjs",
  "scripts/hq-heartbeat.mjs",
  "docs/HQ_COMMIT_READINESS.md",
  "docs/hq-changelog/",
  "README.md",
  "package.json",
];

function run(command) {
  return execSync(command, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trimEnd();
}

function runOptional(command) {
  try {
    return run(command);
  } catch {
    return "";
  }
}

function parseStatusLine(line) {
  const indexStatus = line[0] ?? " ";
  const workTreeStatus = line[1] ?? " ";
  const rest = line.slice(3).trim();
  const path = rest.includes(" -> ") ? rest.split(" -> ").at(-1) ?? rest : rest;

  return {
    line,
    path,
    indexStatus,
    workTreeStatus,
    isStaged: indexStatus !== " " && indexStatus !== "?",
    isUnstaged: workTreeStatus !== " " || line.startsWith("??"),
    isUntracked: line.startsWith("??"),
  };
}

function isHqRelated(path) {
  return HQ_PATH_HINTS.some((hint) => (hint.endsWith("/") ? path.startsWith(hint) : path === hint));
}

function scopeForPath(path) {
  if (path.startsWith("src/pages/api/hq/")) return "API";
  if (path.startsWith("src/components/")) return "UI";
  if (path.startsWith("src/lib/data/")) return "Data";
  if (path.startsWith("scripts/")) return "Tooling";
  if (path.startsWith("docs/")) return "Docs";
  if (path === "README.md" || path === "package.json") return "Project";
  return "HQ";
}

function statusLabel(record) {
  if (record.isUntracked) return "new";
  if (record.isStaged && record.isUnstaged) return "staged + unstaged";
  if (record.isStaged) return "staged";
  if (record.isUnstaged) return "unstaged";
  return "changed";
}

function aggregateNumstat(path) {
  const staged = runOptional(`git diff --cached --numstat -- ${shellQuote(path)}`);
  const unstaged = runOptional(`git diff --numstat -- ${shellQuote(path)}`);
  const totals = { added: 0, removed: 0 };

  for (const block of [staged, unstaged]) {
    if (!block) continue;
    for (const line of block.split("\n")) {
      const [add, remove] = line.split("\t");
      if (!add || !remove) continue;
      if (add !== "-" && /^\d+$/.test(add)) totals.added += Number(add);
      if (remove !== "-" && /^\d+$/.test(remove)) totals.removed += Number(remove);
    }
  }

  return totals;
}

function shellQuote(value) {
  if (/^[a-zA-Z0-9_./-]+$/.test(value)) return value;
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function main() {
  try {
    run("git rev-parse --is-inside-work-tree");
  } catch {
    console.error("Not inside a git repository.");
    process.exit(1);
  }

  const isoDate = new Date().toISOString().slice(0, 10);
  const branch = runOptional("git branch --show-current") || "(detached)";
  const statusOutput = runOptional("git status --porcelain");
  const records = statusOutput
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map(parseStatusLine);

  const hqRecords = records.filter((record) => isHqRelated(record.path));

  if (hqRecords.length === 0) {
    console.log("# HQ Release Notes Draft");
    console.log("");
    console.log(`_Date: ${isoDate} · Branch: ${branch} · Draft mode (no git mutations)_`);
    console.log("");
    console.log("## Executive Summary");
    console.log("No HQ-scoped changes are currently detected in the working tree.");
    console.log("");
    console.log("## Founder QA Checklist");
    console.log("- [ ] Confirm no pending HQ edits are expected");
    console.log("- [ ] Run `npm run hq:ready` if this is unexpected");
    process.exit(0);
  }

  const uniquePaths = [...new Set(hqRecords.map((record) => record.path))].sort((a, b) => a.localeCompare(b));

  const byScope = new Map();
  for (const path of uniquePaths) {
    const scope = scopeForPath(path);
    const current = byScope.get(scope) ?? [];
    current.push(path);
    byScope.set(scope, current);
  }

  const impact = uniquePaths.map((path) => ({ path, ...aggregateNumstat(path) }));
  const totalAdded = impact.reduce((sum, item) => sum + item.added, 0);
  const totalRemoved = impact.reduce((sum, item) => sum + item.removed, 0);
  const stagedCount = hqRecords.filter((record) => record.isStaged).length;
  const unstagedCount = hqRecords.filter((record) => record.isUnstaged).length;

  console.log("# HQ Release Notes Draft");
  console.log("");
  console.log(`_Date: ${isoDate} · Branch: ${branch} · Draft mode (no git mutations)_`);
  console.log("");
  console.log("## Executive Summary");
  console.log(`HQ currently has **${uniquePaths.length} changed file(s)** across **${byScope.size} scope(s)**.`);
  console.log(`Observed diff footprint: **+${totalAdded} / -${totalRemoved}** line(s) (staged + unstaged).`);
  console.log(`Current status mix: **${stagedCount} staged signal(s)**, **${unstagedCount} unstaged signal(s)**.`);
  console.log("");

  console.log("## Change Themes");
  for (const [scope, paths] of [...byScope.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`- **${scope}**: ${paths.length} file(s) updated`);
  }
  console.log("");

  console.log("## File-level Notes");
  for (const path of uniquePaths) {
    const record = hqRecords.find((item) => item.path === path);
    const nums = impact.find((item) => item.path === path) ?? { added: 0, removed: 0 };
    console.log(`- **${path}** (${statusLabel(record)}) — +${nums.added} / -${nums.removed}`);
  }
  console.log("");

  console.log("## Founder Narrative Draft");
  console.log("This release tightens HQ operational readiness and founder workflow polish.");
  console.log("Changes concentrate on the scopes listed above and are presented as a draft summary from live git state.");
  console.log("No automated staging, commits, or pushes were performed.");
  console.log("");

  console.log("## Founder QA Checklist");
  console.log("- [ ] Run `npm run hq:verify` and resolve any blockers");
  console.log("- [ ] Run `npm run lint && npm run build`");
  console.log("- [ ] Validate release summary wording against actual diff (`git diff --cached`)");
  console.log("- [ ] Finalize and publish notes after commit SHA is available");
}

main();
