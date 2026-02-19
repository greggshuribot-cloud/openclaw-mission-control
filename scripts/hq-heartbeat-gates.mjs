#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = resolve(fileURLToPath(new URL(".", import.meta.url)));
const repoRoot = resolve(__dirname, "..");

const args = new Set(process.argv.slice(2));
const helpMode = args.has("--help") || args.has("-h");
const strictMode = !args.has("--no-strict");

const CHECKS = [
  { key: "contracts", script: "hq:heartbeat:contracts" },
  { key: "preflight_validate", script: "hq:heartbeat:preflight:validate" },
  { key: "suite_explain_validate", script: "hq:heartbeat:suite:explain:validate" },
];

function usage() {
  console.log("Usage: node scripts/hq-heartbeat-gates.mjs [--help|-h] [--no-strict]");
  console.log("Runs heartbeat contract gates (contracts + preflight validate + suite explain validate) and emits one compact dry-run summary line for cron/CI.");
  console.log("Default exit mode is strict (non-zero when any gate fails). Use --no-strict for report-only mode.");
}

function runScript(scriptName) {
  try {
    execFileSync("npm", ["run", "--silent", scriptName], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

function main() {
  if (helpMode) {
    usage();
    return;
  }

  const results = CHECKS.map((check) => ({ ...check, ...runScript(check.script) }));
  const overallPass = results.every((result) => result.ok);
  const strictExit = strictMode && !overallPass ? 1 : 0;

  console.log(
    [
      "HQ_HEARTBEAT_GATES",
      "mode=dry-run",
      `status=${overallPass ? "PASS" : "FAIL"}`,
      `strict=${strictMode ? "true" : "false"}`,
      `strict_exit=${strictExit}`,
      ...results.map((result) => `${result.key}=${result.ok ? "PASS" : "FAIL"}`),
    ].join(" "),
  );

  if (strictExit !== 0) {
    process.exit(strictExit);
  }
}

main();
