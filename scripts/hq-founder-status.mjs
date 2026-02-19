#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const STEPS = [
  {
    key: "consistency",
    title: "Consistency",
    command: ["npm", "run", "hq:consistency", "--silent"],
    required: true,
  },
  {
    key: "readiness",
    title: "Readiness",
    command: ["npm", "run", "hq:ready", "--silent"],
    required: false,
  },
  {
    key: "verify",
    title: "Verify",
    command: ["npm", "run", "hq:verify", "--silent"],
    required: true,
  },
  {
    key: "releaseNotes",
    title: "Release Notes",
    command: ["npm", "run", "hq:release-notes", "--silent"],
    required: false,
  },
  {
    key: "handoff",
    title: "Handoff",
    command: ["npm", "run", "hq:handoff", "--silent"],
    required: true,
  },
];

function runStep(step) {
  const [cmd, ...args] = step.command;
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });

  const exitCode = result.status ?? 1;
  const output = [(result.stdout ?? "").trim(), (result.stderr ?? "").trim()].filter(Boolean).join("\n");

  return {
    ...step,
    exitCode,
    passed: exitCode === 0,
    output,
  };
}

function utcTimestamp() {
  return new Date().toISOString().replace(".000", "");
}

function suggestion(results) {
  const firstFail = results.find((step) => !step.passed);

  if (!firstFail) {
    return "npm run lint && npm run build";
  }

  if (firstFail.key === "consistency") return "npm run hq:consistency";
  if (firstFail.key === "verify") return "npm run hq:verify";
  if (firstFail.key === "handoff") return "npm run hq:handoff";
  if (firstFail.key === "readiness") return "npm run hq:ready";
  if (firstFail.key === "releaseNotes") return "npm run hq:release-notes";

  return firstFail.command.join(" ");
}

function printMatrix(results) {
  const statusWidth = 6;
  const stepWidth = 14;
  const reqWidth = 8;

  console.log("HQ Founder Status Snapshot (Dry Run)");
  console.log(`Timestamp: ${utcTimestamp()}`);
  console.log("Scope: latest HQ tooling checks only; no staging/commit/push");
  console.log("");
  console.log(`${"STATUS".padEnd(statusWidth)}  ${"STEP".padEnd(stepWidth)}  ${"REQUIRED".padEnd(reqWidth)}  COMMAND`);
  console.log(`${"-".repeat(statusWidth)}  ${"-".repeat(stepWidth)}  ${"-".repeat(reqWidth)}  ${"-".repeat(28)}`);

  for (const step of results) {
    const status = step.passed ? "PASS" : "FAIL";
    const required = step.required ? "yes" : "no";
    console.log(`${status.padEnd(statusWidth)}  ${step.title.padEnd(stepWidth)}  ${required.padEnd(reqWidth)}  ${step.command.join(" ")}`);
  }

  const requiredFailures = results.filter((step) => step.required && !step.passed).length;
  const passed = results.filter((step) => step.passed).length;

  console.log("");
  console.log(`Summary: ${passed}/${results.length} passed; required failures: ${requiredFailures}`);
  console.log(`Suggested next command: ${suggestion(results)}`);
}

function main() {
  const results = STEPS.map(runStep);
  printMatrix(results);

  const blocked = results.some((step) => step.required && !step.passed);
  if (blocked) {
    process.exit(1);
  }
}

main();
