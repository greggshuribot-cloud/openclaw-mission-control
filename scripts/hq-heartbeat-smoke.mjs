#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = resolve(fileURLToPath(new URL(".", import.meta.url)));
const repoRoot = resolve(__dirname, "..");

const args = new Set(process.argv.slice(2));
const strictMode = args.has("--strict") || args.has("-s");
const helpMode = args.has("--help") || args.has("-h");

const MODES = [
  {
    key: "human",
    command: ["npm", ["run", "--silent", "hq:heartbeat"]],
    validate(output) {
      return /^HQ heartbeat dry-run @[^:]+: required \d+\/\d+ \(.+\); next .+$/.test(output.trim());
    },
  },
  {
    key: "json",
    command: ["npm", ["run", "--silent", "hq:heartbeat", "--", "--json"]],
    validate(output) {
      try {
        const parsed = JSON.parse(output);
        return (
          parsed?.mode === "dry-run" &&
          parsed?.command === "hq:heartbeat" &&
          typeof parsed?.hash === "string" &&
          typeof parsed?.required?.passed === "number" &&
          typeof parsed?.required?.total === "number" &&
          typeof parsed?.required?.state?.consistency === "boolean" &&
          typeof parsed?.required?.state?.verify === "boolean" &&
          typeof parsed?.required?.state?.handoff === "boolean" &&
          typeof parsed?.next === "string" &&
          typeof parsed?.strict === "boolean" &&
          typeof parsed?.strictExitCode === "number"
        );
      } catch {
        return false;
      }
    },
  },
  {
    key: "quiet",
    command: ["npm", ["run", "--silent", "hq:heartbeat", "--", "--quiet"]],
    validate(output) {
      const line = output.trim();
      return line.startsWith("HQ_HEARTBEAT ") && line.includes(" mode=dry-run ") && line.includes(" status=") && line.includes(" state=") && line.includes(" strict_exit=");
    },
  },
  {
    key: "tsv",
    command: ["npm", ["run", "--silent", "hq:heartbeat", "--", "--tsv"]],
    validate(output) {
      const cols = output.trim().split("\t");
      return cols.length === 11 && cols[0] === "HQ_HEARTBEAT" && cols[1] === "dry-run";
    },
  },
  {
    key: "check",
    command: ["npm", ["run", "--silent", "hq:heartbeat:check"]],
    validate(output) {
      const line = output.trim();
      return line.startsWith("HQ_HEARTBEAT_CHECK ") && line.includes(" mode=dry-run ") && line.includes(" heartbeat=") && line.includes(" schema=") && line.includes(" strict_exit=");
    },
  },
];

function usage() {
  console.log("Usage: node scripts/hq-heartbeat-smoke.mjs [--strict|-s] [--help|-h]");
  console.log("Runs dry-run heartbeat modes (human/json/quiet/tsv/check) and prints compact mode-level PASS/FAIL summary.");
  console.log("--strict exits non-zero when any mode fails execution or output-shape validation.");
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

  const results = MODES.map((mode) => {
    const [command, commandArgs] = mode.command;
    const run = runCommand(command, commandArgs);
    const shapePass = run.ok ? mode.validate(run.output) : false;
    const pass = run.ok && shapePass;
    return { key: mode.key, pass, runOk: run.ok, shapePass };
  });

  const failed = results.filter((result) => !result.pass);
  const status = failed.length === 0 ? "PASS" : "FAIL";
  const state = results.map((result) => `${result.key}:${result.pass ? "P" : "F"}`).join(",");
  const strictExitCode = strictMode && failed.length > 0 ? 1 : 0;

  console.log(
    [
      "HQ_HEARTBEAT_SMOKE",
      "mode=dry-run",
      `status=${status}`,
      `passed=${results.length - failed.length}`,
      `total=${results.length}`,
      `state=${state}`,
      `strict=${strictMode ? 1 : 0}`,
      `strict_exit=${strictExitCode}`,
    ].join(" "),
  );

  if (failed.length > 0) {
    for (const result of failed) {
      const reason = !result.runOk ? "exec" : "shape";
      console.log(`- [FAIL] ${result.key} (${reason})`);
    }
  }

  if (strictMode && failed.length > 0) {
    process.exit(1);
  }
}

main();
