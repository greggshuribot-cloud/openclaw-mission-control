#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = resolve(fileURLToPath(new URL(".", import.meta.url)));
const repoRoot = resolve(__dirname, "..");

const args = new Set(process.argv.slice(2));
const strictMode = args.has("--strict") || args.has("-s");
const helpMode = args.has("--help") || args.has("-h");

function usage() {
  console.log("Usage: node scripts/hq-heartbeat-check.mjs [--strict|-s] [--help|-h]");
  console.log("Runs hq:heartbeat emit + hq:heartbeat:validate together (dry-run only) and prints a compact cron-safe summary.");
  console.log("--strict exits non-zero when heartbeat required checks fail or schema validation fails.");
}

function parseHeartbeatQuiet(line) {
  const parts = line.trim().split(/\s+/);
  const values = {};

  for (const part of parts.slice(1)) {
    const [key, value] = part.split("=");
    if (key && value !== undefined) values[key] = value;
  }

  return {
    status: values.status === "PASS" ? "PASS" : "FAIL",
    hash: values.hash ?? "unknown",
    nextKey: values.next_key ?? "unknown",
    state: values.state ?? "unknown",
  };
}

function runCommand(command, commandArgs) {
  try {
    const output = execFileSync(command, commandArgs, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    return { ok: true, output };
  } catch (error) {
    const output = String(error.stdout ?? "").trim();
    const stderr = String(error.stderr ?? "").trim();
    return { ok: false, output, stderr };
  }
}

function main() {
  if (helpMode) {
    usage();
    return;
  }

  const heartbeatRun = runCommand("npm", ["run", "--silent", "hq:heartbeat", "--", "--quiet"]);
  const heartbeat = parseHeartbeatQuiet(heartbeatRun.output || "HQ_HEARTBEAT status=FAIL");

  const validateRun = runCommand("npm", ["run", "--silent", "hq:heartbeat:validate"]);
  const heartbeatPass = heartbeatRun.ok && heartbeat.status === "PASS";
  const schemaPass = validateRun.ok;
  const overallPass = heartbeatPass && schemaPass;
  const strictExitCode = strictMode && !overallPass ? 1 : 0;

  console.log(
    [
      "HQ_HEARTBEAT_CHECK",
      "mode=dry-run",
      `status=${overallPass ? "PASS" : "FAIL"}`,
      `heartbeat=${heartbeatPass ? "PASS" : "FAIL"}`,
      `schema=${schemaPass ? "PASS" : "FAIL"}`,
      `hash=${heartbeat.hash}`,
      `next_key=${heartbeat.nextKey}`,
      `state=${heartbeat.state}`,
      `strict=${strictMode ? 1 : 0}`,
      `strict_exit=${strictExitCode}`,
    ].join(" "),
  );

  if (strictMode && !overallPass) {
    process.exit(1);
  }
}

main();
