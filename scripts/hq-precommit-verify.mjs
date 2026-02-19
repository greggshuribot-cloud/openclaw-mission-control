#!/usr/bin/env node

import { execSync } from "node:child_process";

const HQ_PATH_HINTS = [
  "src/components/hq-view.tsx",
  "src/components/app-shell.tsx",
  "src/pages/api/hq/",
  "src/lib/data/agents.ts",
  "src/lib/data/prompt-templates.ts",
  "scripts/hq-readiness.mjs",
  "scripts/hq-commit-package.mjs",
  "scripts/hq-precommit-verify.mjs",
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

function toUniquePaths(records) {
  return [...new Set(records.map((record) => record.path))];
}

function printList(title, entries) {
  console.log(`\n${title}`);
  if (entries.length === 0) {
    console.log("- none");
    return;
  }

  for (const entry of entries) {
    console.log(`- ${entry}`);
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
  const lines = statusOutput
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean);

  if (lines.length === 0) {
    console.error("❌ Blocked: no changed files found. Nothing to verify for HQ commit.");
    process.exit(1);
  }

  const records = lines.map(parseStatusLine);
  const staged = records.filter((record) => record.isStaged);
  const stagedHq = staged.filter((record) => isHqRelated(record.path));
  const stagedNonHq = staged.filter((record) => !isHqRelated(record.path));

  const unstagedHq = records.filter((record) => record.isUnstaged && isHqRelated(record.path));
  const conflictRecords = records.filter((record) => record.indexStatus === "U" || record.workTreeStatus === "U");

  console.log("HQ pre-commit verification");
  console.log("=".repeat(26));
  console.log(`Staged files: ${staged.length}`);
  console.log(`Staged HQ files: ${stagedHq.length}`);
  console.log(`Staged non-HQ files: ${stagedNonHq.length}`);

  const blockers = [];

  if (staged.length === 0) {
    blockers.push("No staged files detected.");
  }

  if (stagedNonHq.length > 0) {
    blockers.push("Non-HQ files are staged. HQ commit must contain only HQ-targeted files.");
  }

  if (conflictRecords.length > 0) {
    blockers.push("Merge conflict markers in git status (resolve before commit).");
  }

  printList("Staged HQ files", toUniquePaths(stagedHq));
  printList("Staged non-HQ files", toUniquePaths(stagedNonHq));

  if (unstagedHq.length > 0) {
    printList(
      "Heads-up: HQ files not fully staged yet",
      toUniquePaths(unstagedHq),
    );
  }

  if (blockers.length > 0) {
    printList("Blockers", blockers);

    if (stagedNonHq.length > 0) {
      console.log("\nSuggested fix:");
      console.log("- Unstage non-HQ files: git restore --staged <path ...>");
      console.log("- Or split commits: commit HQ slice first, then non-HQ files separately.");
    }

    process.exit(1);
  }

  console.log("\n✅ HQ pre-commit verification passed.");
  console.log("Safe to continue with HQ commit packaging.");
}

main();
