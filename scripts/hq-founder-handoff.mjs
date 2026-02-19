#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const STEPS = [
  {
    key: "readiness",
    title: "HQ readiness snapshot",
    command: ["npm", "run", "hq:ready", "--silent"],
    required: false,
  },
  {
    key: "verify",
    title: "HQ pre-commit verification",
    command: ["npm", "run", "hq:verify", "--silent"],
    required: true,
  },
  {
    key: "commit",
    title: "HQ commit packaging",
    command: ["npm", "run", "hq:commit", "--silent"],
    required: false,
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
  const combined = [stdout, stderr].filter(Boolean).join("\n");

  return {
    ...step,
    exitCode: result.status ?? 1,
    output: combined,
    passed: (result.status ?? 1) === 0,
  };
}

function printDivider() {
  console.log("-".repeat(72));
}

function printStep(stepResult) {
  const status = stepResult.passed ? "PASS" : "FAIL";
  console.log(`\n[${status}] ${stepResult.title}`);
  console.log(`Command: ${stepResult.command.join(" ")}`);

  if (stepResult.output) {
    printDivider();
    console.log(stepResult.output);
    printDivider();
  } else {
    console.log("(no output)");
  }
}

function printSummary(results) {
  const requiredFailures = results.filter((step) => step.required && !step.passed);
  const failed = results.filter((step) => !step.passed);

  console.log("\nFounder Handoff Summary (Dry Run)");
  console.log("=".repeat(34));
  console.log("- This workflow does not stage, commit, or push anything.");
  console.log("- It only runs HQ readiness + verify + commit packaging guidance.");
  console.log(`- Steps passed: ${results.length - failed.length}/${results.length}`);

  for (const step of results) {
    console.log(`  - ${step.passed ? "✅" : "❌"} ${step.title}`);
  }

  console.log("\nRecommended founder next actions:");
  console.log("1) Resolve blockers shown above (if any)");
  console.log("2) Run quality gates: npm run lint && npm run build");
  console.log("3) Review staged diff: git diff --cached");
  console.log("4) Commit manually using the printed template");

  if (requiredFailures.length > 0) {
    console.error("\n❌ Founder handoff blocked: required verification step failed.");
    process.exit(1);
  }

  console.log("\n✅ Founder handoff guidance complete. Ready for manual commit flow.");
}

function main() {
  console.log("HQ Founder Handoff");
  console.log("=".repeat(18));

  const results = [];

  for (const step of STEPS) {
    const result = runStep(step);
    results.push(result);
    printStep(result);
  }

  printSummary(results);
}

main();
