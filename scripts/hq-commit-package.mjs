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
  return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trimEnd();
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
  };
}

function isHqRelated(path) {
  return HQ_PATH_HINTS.some((hint) => (hint.endsWith("/") ? path.startsWith(hint) : path === hint));
}

function scopeForPath(path) {
  if (path.startsWith("src/pages/api/hq/")) return "api";
  if (path.startsWith("src/components/")) return "ui";
  if (path.startsWith("src/lib/data/")) return "data";
  if (path.startsWith("scripts/")) return "tooling";
  if (path.startsWith("docs/")) return "docs";
  return "hq";
}

function summarizePaths(paths) {
  const byScope = new Map();

  for (const path of paths) {
    const scope = scopeForPath(path);
    byScope.set(scope, (byScope.get(scope) ?? 0) + 1);
  }

  const scopes = [...byScope.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([scope, count]) => `${scope}:${count}`)
    .join(", ");

  return scopes || "hq updates";
}

function printChecklist(stagedHq, unstagedHq) {
  console.log("Safe staged-file checklist");
  console.log("- [ ] `git status --short` shows only intended HQ files in staged area");
  console.log("- [ ] `git diff --cached` reviewed for secrets/tokens/debug noise");
  console.log("- [ ] Non-HQ changes are unstaged or committed separately");
  console.log("- [ ] Lint and build pass before commit");

  if (unstagedHq.length > 0) {
    console.log(`- [ ] Stage remaining HQ files (${unstagedHq.length}) before commit`);
  }

  if (stagedHq.length === 0) {
    console.log("- [ ] Stage at least one HQ file before creating commit");
  }
}

function printTemplate(stagedHq) {
  const summary = summarizePaths(stagedHq);

  console.log("\nConventional commit template");
  console.log("Subject:");
  console.log("feat(hq): package founder-ready commit workflow");

  console.log("\nBody:");
  console.log("- add HQ commit packaging helper for staged-file safety checks");
  console.log("- include conventional commit scaffolding for current HQ slice");
  console.log(`- touch areas: ${summary}`);

  console.log("\nFooter (optional):");
  console.log("Refs: HQ readiness tooling");

  if (stagedHq.length > 0) {
    console.log("\nSuggested command:");
    console.log("git commit \\");
    console.log("  -m \"feat(hq): package founder-ready commit workflow\" \\");
    console.log("  -m \"- add HQ commit packaging helper for staged-file safety checks\\n- include conventional commit scaffolding for current HQ slice\\n- touch areas: " + summary + "\"");
  }
}

function main() {
  try {
    run("git rev-parse --is-inside-work-tree");
  } catch {
    console.error("Not inside a git repository.");
    process.exit(1);
  }

  const statusOutput = run("git status --porcelain");

  if (!statusOutput.trim()) {
    console.log("No local changes detected.");
    process.exit(0);
  }

  const records = statusOutput
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map(parseStatusLine);

  const hqRecords = records.filter((record) => isHqRelated(record.path));
  const stagedHq = [...new Set(hqRecords.filter((record) => record.isStaged).map((record) => record.path))];
  const unstagedHq = [...new Set(hqRecords.filter((record) => record.isUnstaged).map((record) => record.path))];

  console.log("HQ Founder Commit Packaging");
  console.log("=".repeat(27));
  console.log(`HQ files changed: ${hqRecords.length}`);
  console.log(`HQ files staged: ${stagedHq.length}`);
  console.log(`HQ files unstaged/untracked: ${unstagedHq.length}`);

  if (hqRecords.length === 0) {
    console.log("\nNo HQ-scoped changes were detected.");
    process.exit(0);
  }

  if (stagedHq.length > 0) {
    console.log("\nStaged HQ files:");
    stagedHq.forEach((path) => console.log(`- ${path}`));
  }

  if (unstagedHq.length > 0) {
    console.log("\nHQ files not fully staged yet:");
    unstagedHq.forEach((path) => console.log(`- ${path}`));
    console.log("\nStage command:");
    console.log("git add " + unstagedHq.map((path) => `'${path.replaceAll("'", "'\\''")}'`).join(" "));
  }

  console.log("");
  printChecklist(stagedHq, unstagedHq);
  printTemplate(stagedHq);
}

main();
