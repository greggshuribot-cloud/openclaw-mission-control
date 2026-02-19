#!/usr/bin/env node

import { execSync, spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const jsonMode = args.has("--json") || args.has("-j");
const quietMode = args.has("--quiet") || args.has("-q");
const tsvMode = args.has("--tsv") || args.has("-t");
const strictMode = args.has("--strict") || args.has("-s");
const helpMode = args.has("--help") || args.has("-h");

const REQUIRED_STEPS = [
  {
    key: "consistency",
    command: ["npm", "run", "hq:consistency", "--silent"],
    next: "npm run hq:consistency",
  },
  {
    key: "verify",
    command: ["npm", "run", "hq:verify", "--silent"],
    next: "npm run hq:verify",
  },
  {
    key: "handoff",
    command: ["npm", "run", "hq:handoff", "--silent"],
    next: "npm run hq:handoff",
  },
];

const STEP_TIMEOUT_MS = Number.parseInt(process.env.HQ_HEARTBEAT_STEP_TIMEOUT_MS ?? "45000", 10);

function gitShortHash() {
  try {
    return execSync("git rev-parse --short HEAD", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

function runStep(step) {
  const [cmd, ...args] = step.command;
  const timeout = Number.isFinite(STEP_TIMEOUT_MS) && STEP_TIMEOUT_MS > 0 ? STEP_TIMEOUT_MS : undefined;
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
    timeout,
    killSignal: "SIGKILL",
  });

  const passed = (result.status ?? 1) === 0 && !result.error;
  return { ...step, passed };
}

function nextInfo(results) {
  const firstFail = results.find((step) => !step.passed);
  if (!firstFail) {
    return { key: "lint_build", command: "npm run lint && npm run build" };
  }
  return { key: firstFail.key, command: firstFail.next };
}

function formatState(results) {
  const passed = results.filter((step) => step.passed).length;
  const total = results.length;
  const state = results.map((step) => `${step.key}:${step.passed ? "P" : "F"}`).join(",");
  return `${passed}/${total} (${state})`;
}

function formatStateToken(results) {
  return results.map((step) => `${step.key}:${step.passed ? "P" : "F"}`).join(",");
}

function usage() {
  console.log("Usage: node scripts/hq-heartbeat.mjs [--json|-j] [--quiet|-q] [--tsv|-t] [--strict|-s] [--help|-h]");
  console.log("Default output is one-line human heartbeat; --json emits machine-readable JSON.");
  console.log("--quiet emits a minimal, cron-safe token line with stable parseable fields.");
  console.log("--tsv emits a single tab-separated row for shell-friendly cron ingestion.");
  console.log("--strict exits non-zero when required checks fail (dry-run status gating for automation/cron).");
  console.log("Set HQ_HEARTBEAT_STEP_TIMEOUT_MS to cap each required check runtime (default: 45000ms).");
}

function hasRequiredFailures(results) {
  return results.some((step) => !step.passed);
}

function asJson(hash, results, next, strict) {
  const required = {
    passed: results.filter((step) => step.passed).length,
    total: results.length,
    state: results.reduce((acc, step) => ({ ...acc, [step.key]: step.passed }), {}),
  };

  return {
    mode: "dry-run",
    command: "hq:heartbeat",
    hash,
    required,
    next,
    strict,
    strictExitCode: strict && hasRequiredFailures(results) ? 1 : 0,
  };
}

function asQuietLine(hash, results, next, strict) {
  const requiredPassed = results.filter((step) => step.passed).length;
  const requiredTotal = results.length;
  const hasFailures = hasRequiredFailures(results);
  const strictExitCode = strict && hasFailures ? 1 : 0;
  const status = hasFailures ? "FAIL" : "PASS";

  return [
    "HQ_HEARTBEAT",
    `mode=dry-run`,
    `status=${status}`,
    `hash=${hash}`,
    `required_passed=${requiredPassed}`,
    `required_total=${requiredTotal}`,
    `state=${formatStateToken(results)}`,
    `next_key=${next.key}`,
    `strict=${strict ? 1 : 0}`,
    `strict_exit=${strictExitCode}`,
  ].join(" ");
}

function asTsvLine(hash, results, next, strict) {
  const requiredPassed = results.filter((step) => step.passed).length;
  const requiredTotal = results.length;
  const hasFailures = hasRequiredFailures(results);
  const strictExitCode = strict && hasFailures ? 1 : 0;
  const status = hasFailures ? "FAIL" : "PASS";

  return [
    "HQ_HEARTBEAT",
    "dry-run",
    status,
    hash,
    String(requiredPassed),
    String(requiredTotal),
    formatStateToken(results),
    next.key,
    next.command,
    strict ? "1" : "0",
    String(strictExitCode),
  ].join("\t");
}

function main() {
  if (helpMode) {
    usage();
    return;
  }

  const hash = gitShortHash();
  const results = REQUIRED_STEPS.map(runStep);
  const state = formatState(results);
  const next = nextInfo(results);

  const requiredFailures = hasRequiredFailures(results);

  if (jsonMode) {
    console.log(JSON.stringify(asJson(hash, results, next.command, strictMode)));
    if (strictMode && requiredFailures) {
      process.exit(1);
    }
    return;
  }

  if (quietMode) {
    console.log(asQuietLine(hash, results, next, strictMode));
    if (strictMode && requiredFailures) {
      process.exit(1);
    }
    return;
  }

  if (tsvMode) {
    console.log(asTsvLine(hash, results, next, strictMode));
    if (strictMode && requiredFailures) {
      process.exit(1);
    }
    return;
  }

  console.log(`HQ heartbeat dry-run @${hash}: required ${state}; next ${next.command}`);

  if (strictMode && requiredFailures) {
    process.exit(1);
  }
}

main();
