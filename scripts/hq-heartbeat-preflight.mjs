#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = resolve(fileURLToPath(new URL(".", import.meta.url)));
const repoRoot = resolve(__dirname, "..");

const args = new Set(process.argv.slice(2));
const helpMode = args.has("--help") || args.has("-h");

const STEPS = [
  {
    key: "contracts",
    command: ["npm", ["run", "--silent", "hq:heartbeat:contracts"]],
    expectedPrefix: "HQ_HEARTBEAT_CONTRACTS",
  },
  {
    key: "suite",
    command: ["npm", ["run", "--silent", "hq:heartbeat:suite"]],
    expectedPrefix: "HQ_HEARTBEAT_SUITE",
  },
  {
    key: "founder",
    command: ["npm", ["run", "--silent", "hq:founder-status"]],
  },
];

function usage() {
  console.log("Usage: node scripts/hq-heartbeat-preflight.mjs [--help|-h]");
  console.log("Runs heartbeat contracts + suite + founder-status in dry-run mode and prints one compact summary line for cron/operator preflight checks.");
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
    return {
      ok: false,
      output: String(error.stdout ?? "").trim(),
      stderr: String(error.stderr ?? "").trim(),
    };
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

function parseFounderSummary(output) {
  const summaryMatch = output.match(/Summary:\s*(\d+)\/(\d+)\s*passed;\s*required failures:\s*(\d+)/i);
  const suggestedMatch = output.match(/Suggested next command:\s*(.+)$/im);

  if (!summaryMatch) {
    return {
      parsed: false,
      passed: null,
      total: null,
      requiredFailures: null,
      nextCommand: null,
    };
  }

  return {
    parsed: true,
    passed: Number(summaryMatch[1]),
    total: Number(summaryMatch[2]),
    requiredFailures: Number(summaryMatch[3]),
    nextCommand: suggestedMatch?.[1]?.trim() ?? null,
  };
}

function main() {
  if (helpMode) {
    usage();
    return;
  }

  const contractsRun = runCommand(...STEPS[0].command);
  const contractsLine = contractsRun.output.split("\n").find((line) => line.startsWith("HQ_HEARTBEAT_CONTRACTS")) ?? "";
  const contractsFields = parseFields(contractsLine, "HQ_HEARTBEAT_CONTRACTS");
  const contractsPass = contractsRun.ok && contractsFields?.status === "PASS";

  const suiteRun = runCommand(...STEPS[1].command);
  const suiteLine = suiteRun.output.split("\n").find((line) => line.startsWith("HQ_HEARTBEAT_SUITE")) ?? "";
  const suiteFields = parseFields(suiteLine, "HQ_HEARTBEAT_SUITE");
  const suitePass = suiteRun.ok && suiteFields?.status === "PASS";

  const founderRun = runCommand(...STEPS[2].command);
  const founderSummary = parseFounderSummary(founderRun.output);
  const founderPass = founderRun.ok;

  const overallPass = contractsPass && suitePass && founderPass;

  console.log(
    [
      "HQ_HEARTBEAT_PREFLIGHT",
      "mode=dry-run",
      `status=${overallPass ? "PASS" : "FAIL"}`,
      `contracts=${contractsPass ? "PASS" : "FAIL"}`,
      `contracts_heartbeat_schema=${contractsFields?.heartbeat_schema ?? "unknown"}`,
      `contracts_suite_explain_contract=${contractsFields?.suite_explain_contract ?? "unknown"}`,
      `suite=${suitePass ? "PASS" : "FAIL"}`,
      `suite_state=${suiteFields?.state ?? "unknown"}`,
      `suite_passed=${suiteFields?.passed ?? "unknown"}`,
      `suite_total=${suiteFields?.total ?? "unknown"}`,
      `founder=${founderPass ? "PASS" : "FAIL"}`,
      `founder_passed=${founderSummary.passed ?? "unknown"}`,
      `founder_total=${founderSummary.total ?? "unknown"}`,
      `founder_required_failures=${founderSummary.requiredFailures ?? "unknown"}`,
      `founder_next_key=${
        founderSummary.nextCommand === "npm run hq:consistency"
          ? "consistency"
          : founderSummary.nextCommand === "npm run hq:verify"
            ? "verify"
            : founderSummary.nextCommand === "npm run hq:handoff"
              ? "handoff"
              : founderSummary.nextCommand === "npm run hq:ready"
                ? "readiness"
                : founderSummary.nextCommand === "npm run hq:release-notes"
                  ? "releaseNotes"
                  : founderSummary.nextCommand === "npm run lint && npm run build"
                    ? "ship"
                    : "unknown"
      }`,
    ].join(" "),
  );

  if (!overallPass) {
    process.exit(1);
  }
}

main();
