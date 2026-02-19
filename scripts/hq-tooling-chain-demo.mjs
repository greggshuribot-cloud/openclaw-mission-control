#!/usr/bin/env node

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync, spawnSync } from "node:child_process";

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

function run(command, env = process.env) {
  return execSync(command, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env,
  }).trimEnd();
}

function parseStatusLine(line) {
  const rest = line.slice(3).trim();
  const path = rest.includes(" -> ") ? rest.split(" -> ").at(-1) ?? rest : rest;
  return { path };
}

function isHqRelated(path) {
  return HQ_PATH_HINTS.some((hint) => (hint.endsWith("/") ? path.startsWith(hint) : path === hint));
}

function quote(path) {
  if (/^[a-zA-Z0-9_./-]+$/.test(path)) {
    return path;
  }

  return `'${path.replaceAll("'", "'\\''")}'`;
}

function main() {
  try {
    run("git rev-parse --is-inside-work-tree");
  } catch {
    console.error("Not inside a git repository.");
    process.exit(1);
  }

  const statusOutput = run("git status --porcelain");
  const records = statusOutput
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map(parseStatusLine);

  const hqPaths = [...new Set(records.map((record) => record.path).filter(isHqRelated))];

  if (hqPaths.length === 0) {
    console.error("❌ HQ demo-mode blocked: no HQ-scoped changed files found to stage in a temporary index.");
    console.error("Add or edit at least one HQ file, then rerun demo mode.");
    process.exit(1);
  }

  const tempDir = mkdtempSync(join(tmpdir(), "hq-demo-index-"));
  const tempIndexPath = join(tempDir, "index");
  const demoEnv = { ...process.env, GIT_INDEX_FILE: tempIndexPath };

  console.log("HQ Tooling Chain Demo Mode");
  console.log("=".repeat(26));
  console.log("Using a temporary git index so real staging stays untouched.");
  console.log(`Temporary index: ${tempIndexPath}`);

  try {
    run("git read-tree HEAD", demoEnv);
    run(`git add -- ${hqPaths.map(quote).join(" ")}`, demoEnv);

    console.log("\nSimulated staged HQ paths:");
    hqPaths.forEach((path) => console.log(`- ${path}`));

    const result = spawnSync("npm", ["run", "hq:tooling-chain", "--silent"], {
      encoding: "utf8",
      stdio: "inherit",
      env: demoEnv,
      shell: process.platform === "win32",
    });

    const exitCode = result.status ?? 1;
    console.log("\nCleanup");
    console.log("- Temporary index discarded.");
    console.log("- Real git staging area was never modified.");

    if (exitCode !== 0) {
      process.exit(exitCode);
    }

    console.log("\n✅ Demo mode complete.");
    console.log("If you want to perform a real commit next, stage manually and rerun the normal HQ flow.");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

main();
