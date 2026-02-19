#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = resolve(fileURLToPath(new URL(".", import.meta.url)));
const repoRoot = resolve(__dirname, "..");

const args = new Set(process.argv.slice(2));
const helpMode = args.has("--help") || args.has("-h");

function usage() {
  console.log("Usage: node scripts/hq-heartbeat-contracts.mjs [--help|-h]");
  console.log("Runs heartbeat contract checks (hq:heartbeat:validate + hq:heartbeat:suite:explain:validate) and prints one compact dry-run summary line for cron/CI.");
}

function runCommand(command, commandArgs) {
  try {
    execFileSync(command, commandArgs, {
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

  const heartbeatSchema = runCommand("npm", ["run", "--silent", "hq:heartbeat:validate"]);
  const suiteExplainContract = runCommand("npm", ["run", "--silent", "hq:heartbeat:suite:explain:validate"]);

  const overallPass = heartbeatSchema.ok && suiteExplainContract.ok;

  console.log(
    [
      "HQ_HEARTBEAT_CONTRACTS",
      "mode=dry-run",
      `status=${overallPass ? "PASS" : "FAIL"}`,
      `heartbeat_schema=${heartbeatSchema.ok ? "PASS" : "FAIL"}`,
      `suite_explain_contract=${suiteExplainContract.ok ? "PASS" : "FAIL"}`,
    ].join(" "),
  );

  if (!overallPass) {
    process.exit(1);
  }
}

main();
