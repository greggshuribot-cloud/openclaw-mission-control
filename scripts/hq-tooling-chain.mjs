#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const STEPS = [
  {
    key: "consistency",
    title: "HQ workflow consistency",
    command: ["npm", "run", "hq:consistency", "--silent"],
    required: true,
    onFail: "Fix consistency drift first (docs/commands/hints), then rerun.",
  },
  {
    key: "readiness",
    title: "HQ readiness snapshot",
    command: ["npm", "run", "hq:ready", "--silent"],
    required: false,
    onFail: "Inspect git status parsing errors and ensure repo is healthy.",
  },
  {
    key: "verify",
    title: "HQ pre-commit verification",
    command: ["npm", "run", "hq:verify", "--silent"],
    required: true,
    onFail: "Resolve staged-file blockers and pass verify before commit.",
  },
  {
    key: "releaseNotes",
    title: "HQ release-notes draft",
    command: ["npm", "run", "hq:release-notes", "--silent"],
    required: false,
    onFail: "Fix release-notes generation issues; keep founder narrative draft available.",
  },
  {
    key: "handoff",
    title: "HQ founder handoff summary",
    command: ["npm", "run", "hq:handoff", "--silent"],
    required: true,
    onFail: "Resolve failed handoff sub-step(s), then rerun this full chain.",
  },
];

function runStep(step) {
  const [cmd, ...args] = step.command;
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });

  const stdout = (result.stdout ?? "").trimEnd();
  const stderr = (result.stderr ?? "").trimEnd();
  const output = [stdout, stderr].filter(Boolean).join("\n");
  const exitCode = result.status ?? 1;

  return {
    ...step,
    exitCode,
    passed: exitCode === 0,
    output,
  };
}

function printDivider() {
  console.log("-".repeat(84));
}

function printStepResult(result) {
  console.log(`\n[${result.passed ? "PASS" : "FAIL"}] ${result.title}`);
  console.log(`Command: ${result.command.join(" ")}`);

  if (!result.output) {
    console.log("(no output)");
    return;
  }

  printDivider();
  console.log(result.output);
  printDivider();
}

function printDashboard(results) {
  const failed = results.filter((step) => !step.passed);
  const requiredFailures = results.filter((step) => step.required && !step.passed);

  console.log("\nHQ Tooling Chain Dashboard (Dry Run)");
  console.log("=".repeat(37));
  console.log("This command never stages, commits, or pushes. It only runs HQ checks/guides.");
  console.log(`Ordered steps passed: ${results.length - failed.length}/${results.length}`);

  for (const [index, step] of results.entries()) {
    const status = step.passed ? "PASS" : "FAIL";
    const requirement = step.required ? "required" : "optional";
    console.log(`${index + 1}. [${status}] ${step.title} (${requirement})`);
  }

  console.log("\nNext-action guidance:");

  if (failed.length === 0) {
    console.log("1) Run quality gates: npm run lint && npm run build");
    console.log("2) Review release notes draft output and finalize narrative");
    console.log("3) Review staged diff: git diff --cached");
    console.log("4) Commit/push manually (no automation in this workflow)");
    return { blocked: false };
  }

  const firstFailure = results.find((step) => !step.passed);
  if (firstFailure) {
    console.log(`1) First failing step: ${firstFailure.title}`);
    console.log(`2) ${firstFailure.onFail}`);
    console.log("3) Rerun: npm run hq:tooling-chain");
  }

  if (requiredFailures.length > 0) {
    console.log("4) Required step(s) failed, so founder ship flow remains blocked.");
    return { blocked: true };
  }

  console.log("4) Only optional step(s) failed; fix when possible before ship.");
  return { blocked: false };
}

function main() {
  console.log("HQ Full Tooling Chain");
  console.log("=".repeat(20));

  const results = STEPS.map((step) => {
    const result = runStep(step);
    printStepResult(result);
    return result;
  });

  const { blocked } = printDashboard(results);

  if (blocked) {
    process.exit(1);
  }
}

main();
