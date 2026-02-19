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

function quote(path) {
  if (/^[a-zA-Z0-9_./-]+$/.test(path)) {
    return path;
  }

  return `'${path.replaceAll("'", "'\\''")}'`;
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

function printSection(title, entries) {
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

  if (!statusOutput.trim()) {
    console.log("✅ Working tree clean. No changes detected.");
    process.exit(0);
  }

  const records = statusOutput
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map(parseStatusLine);

  const hqRecords = records.filter((record) => isHqRelated(record.path));
  const stagedHq = hqRecords.filter((record) => record.isStaged).map((record) => record.path);
  const unstagedHq = hqRecords.filter((record) => record.isUnstaged).map((record) => record.path);

  console.log("HQ Commit / Ship Readiness");
  console.log("=".repeat(28));
  console.log(`Changed files (all): ${records.length}`);
  console.log(`Changed files (HQ-related): ${hqRecords.length}`);

  printSection(
    "HQ-related file status",
    hqRecords.map((record) => `${record.line}  ${record.path}`),
  );

  console.log("\nRecommended next commands");

  if (hqRecords.length === 0) {
    console.log("- No HQ-scoped changes detected from known paths.");
    console.log("- If this is unexpected, update HQ_PATH_HINTS in scripts/hq-readiness.mjs.");
    process.exit(0);
  }

  if (unstagedHq.length > 0) {
    const uniqueUnstaged = [...new Set(unstagedHq)];
    console.log(`- Stage HQ updates:\n  git add ${uniqueUnstaged.map(quote).join(" ")}`);
  } else {
    console.log("- All HQ files are staged.");
  }

  if (stagedHq.length > 0 || unstagedHq.length > 0) {
    console.log("- Review staged diff:\n  git diff --cached -- src/components/hq-view.tsx src/pages/api/hq src/lib/data/agents.ts src/lib/data/prompt-templates.ts");
    console.log("- Suggested commit:\n  git commit -m \"feat(hq): add founder commit readiness workflow\"");
    console.log("- Optional push:\n  git push origin $(git branch --show-current)");
  }

  const unstagedNonHq = records.filter((record) => !isHqRelated(record.path) && record.isUnstaged);

  if (unstagedNonHq.length > 0) {
    printSection(
      "Heads-up: non-HQ unstaged files",
      unstagedNonHq.map((record) => `${record.line}  ${record.path}`),
    );
  }
}

main();
