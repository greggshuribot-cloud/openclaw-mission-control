#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = resolve(fileURLToPath(new URL(".", import.meta.url)));
const repoRoot = resolve(__dirname, "..");

const args = new Set(process.argv.slice(2));
const strictMode = args.has("--strict") || args.has("-s");
const explainMode = args.has("--explain") || args.has("-e");
const explainJsonMode = args.has("--explain-json");
const explainJsonLineMode = args.has("--explain-json-line") || args.has("--explain-json-aggregate");
const helpMode = args.has("--help") || args.has("-h");

const SUBCHECKS = [
  {
    key: "check",
    command: ["npm", ["run", "--silent", "hq:heartbeat:check"]],
    prefix: "HQ_HEARTBEAT_CHECK",
  },
  {
    key: "smoke",
    command: ["npm", ["run", "--silent", "hq:heartbeat:smoke"]],
    prefix: "HQ_HEARTBEAT_SMOKE",
  },
  {
    key: "regression",
    command: ["npm", ["run", "--silent", "hq:heartbeat:regression"]],
    prefix: "HQ_HEARTBEAT_REGRESSION",
  },
];

function usage() {
  console.log("Usage: node scripts/hq-heartbeat-suite.mjs [--strict|-s] [--explain|-e] [--explain-json] [--explain-json-line|--explain-json-aggregate] [--help|-h]");
  console.log("Runs heartbeat check + smoke + regression in dry-run mode and prints one final compact cron/CI summary line.");
  console.log("--explain prints one concise per-subcheck reason line (pass/fail rationale, no verbose logs).");
  console.log("--explain-json prints one compact machine-readable JSON reason object per subcheck.");
  console.log("--explain-json-line prints one compact machine-readable aggregate JSON line for all subcheck reasons.");
  console.log("--strict exits non-zero when any subcheck execution or status fails.");
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

function parseFields(line, expectedPrefix) {
  const parts = line.trim().split(/\s+/);
  if (parts[0] !== expectedPrefix) return null;

  const fields = {};
  for (const part of parts.slice(1)) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx);
    const value = part.slice(idx + 1);
    fields[key] = value;
  }

  return fields;
}

function explainFor(result) {
  if (!result.runOk) {
    const stderrPreview = result.stderr ? result.stderr.split("\n")[0] : "subcommand exited non-zero";
    return {
      code: "exec-fail",
      reason: `exec-fail (${stderrPreview})`,
      stderrPreview,
    };
  }

  if (!result.fields) {
    return {
      code: "parse-fail-missing-summary",
      reason: `parse-fail (missing ${result.prefix} summary line)`,
    };
  }

  if (result.status === "PASS") {
    const passed = result.fields.passed;
    const total = result.fields.total;
    const ratio = passed && total ? `${passed}/${total}` : "ok";
    return {
      code: "reported-pass",
      reason: `reported PASS (${ratio})`,
      passed: passed ?? null,
      total: total ?? null,
    };
  }

  if (result.status === "FAIL") {
    const state = result.fields.state ?? null;
    const stateSuffix = state ? ` state=${state}` : "";
    return {
      code: "reported-fail",
      reason: `reported FAIL${stateSuffix}`,
      state,
    };
  }

  return {
    code: "parse-fail-status",
    reason: `parse-fail (status=${result.status ?? "missing"})`,
    status: result.status ?? null,
  };
}

function main() {
  if (helpMode) {
    usage();
    return;
  }

  const results = SUBCHECKS.map((subcheck) => {
    const [command, commandArgs] = subcheck.command;
    const run = runCommand(command, commandArgs);
    const fields = parseFields(run.output, subcheck.prefix);
    const status = fields?.status;
    const pass = run.ok && status === "PASS";
    return {
      key: subcheck.key,
      prefix: subcheck.prefix,
      pass,
      runOk: run.ok,
      status,
      fields,
      stderr: run.stderr,
    };
  });

  const failed = results.filter((result) => !result.pass);
  const overallStatus = failed.length === 0 ? "PASS" : "FAIL";
  const state = results.map((result) => `${result.key}:${result.pass ? "P" : "F"}`).join(",");
  const strictExitCode = strictMode && failed.length > 0 ? 1 : 0;

  const explainRows = results.map((result) => {
    const reason = explainFor(result);
    return {
      subcheck: result.key,
      status: result.pass ? "PASS" : "FAIL",
      reason,
    };
  });

  if (explainMode || explainJsonMode) {
    for (const row of explainRows) {
      if (explainMode) {
        console.log(
          [
            "HQ_HEARTBEAT_SUITE_EXPLAIN",
            `subcheck=${row.subcheck}`,
            `status=${row.status}`,
            `reason=${JSON.stringify(row.reason.reason)}`,
          ].join(" "),
        );
      }

      if (explainJsonMode) {
        console.log(["HQ_HEARTBEAT_SUITE_EXPLAIN_JSON", JSON.stringify(row)].join(" "));
      }
    }
  }

  if (explainJsonLineMode) {
    console.log(
      [
        "HQ_HEARTBEAT_SUITE_EXPLAIN_JSON_LINE",
        JSON.stringify({
          mode: "dry-run",
          status: overallStatus,
          passed: results.length - failed.length,
          total: results.length,
          state,
          checks: explainRows,
        }),
      ].join(" "),
    );
  }

  console.log(
    [
      "HQ_HEARTBEAT_SUITE",
      "mode=dry-run",
      `status=${overallStatus}`,
      `passed=${results.length - failed.length}`,
      `total=${results.length}`,
      `state=${state}`,
      `strict=${strictMode ? 1 : 0}`,
      `strict_exit=${strictExitCode}`,
    ].join(" "),
  );

  if (strictMode && failed.length > 0) {
    process.exit(1);
  }
}

main();
