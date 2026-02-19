#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

function utcTimestamp() {
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const min = String(now.getUTCMinutes()).padStart(2, "0");
  const ss = String(now.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${min}${ss}Z`;
}

function main() {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(scriptDir, "..");
  const releaseNotesScript = join(scriptDir, "hq-release-notes.mjs");

  const result = spawnSync(process.execPath, [releaseNotesScript], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    cwd: repoRoot,
  });

  if ((result.status ?? 1) !== 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }

  const output = (result.stdout ?? "").trimEnd();
  if (!output) {
    console.error("Unable to create changelog snapshot: release notes output was empty.");
    process.exit(1);
  }

  const changelogDir = join(repoRoot, "docs", "hq-changelog");
  mkdirSync(changelogDir, { recursive: true });

  const filename = `hq-release-notes-${utcTimestamp()}.md`;
  const filePath = join(changelogDir, filename);
  writeFileSync(filePath, `${output}\n`, "utf8");

  console.log(`HQ changelog snapshot written: ${filePath}`);
  console.log("Dry-run safe: this command only reads git state and writes a markdown file.");
}

main();
