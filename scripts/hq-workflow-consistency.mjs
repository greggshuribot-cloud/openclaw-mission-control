#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = resolve(fileURLToPath(new URL(".", import.meta.url)));
const repoRoot = resolve(__dirname, "..");

const DOC_FILES = [
  "README.md",
  "docs/HQ_COMMIT_READINESS.md",
];

const HQ_HELPER_SCRIPTS = [
  "scripts/hq-readiness.mjs",
  "scripts/hq-precommit-verify.mjs",
  "scripts/hq-commit-package.mjs",
  "scripts/hq-founder-handoff.mjs",
  "scripts/hq-release-notes.mjs",
  "scripts/hq-changelog-snapshot.mjs",
  "scripts/hq-workflow-consistency.mjs",
  "scripts/hq-tooling-chain-demo.mjs",
  "scripts/hq-founder-status.mjs",
  "scripts/hq-heartbeat.mjs",
  "scripts/hq-heartbeat-check.mjs",
  "scripts/hq-heartbeat-smoke.mjs",
  "scripts/hq-heartbeat-regression.mjs",
  "scripts/hq-heartbeat-suite.mjs",
  "scripts/hq-heartbeat-preflight.mjs",
];

function readUtf8(path) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

function extractHints(scriptPath) {
  const content = readUtf8(scriptPath);
  const match = content.match(/const\s+HQ_PATH_HINTS\s*=\s*\[(?<body>[\s\S]*?)\];/m);
  if (!match?.groups?.body) {
    return { found: false, hints: [], content };
  }

  const hints = [...match.groups.body.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  return { found: true, hints, content };
}

function normalizeHint(value) {
  if (value.endsWith("/**")) return `${value.slice(0, -3)}/`;
  return value;
}

function asSortedUnique(values) {
  return [...new Set(values.map(normalizeHint))].sort((a, b) => a.localeCompare(b));
}

function diffHints(canonical, candidate) {
  const canonicalSet = new Set(canonical);
  const candidateSet = new Set(candidate);
  return {
    missing: canonical.filter((item) => !candidateSet.has(item)),
    extra: candidate.filter((item) => !canonicalSet.has(item)),
  };
}

function extractDocScopeHints(docContent) {
  const start = docContent.indexOf("## Scope Hints");
  if (start === -1) return [];
  const tail = docContent.slice(start);
  const end = tail.indexOf("If HQ surface area grows");
  const block = end === -1 ? tail : tail.slice(0, end);
  return [...block.matchAll(/^-\s+`([^`]+)`/gm)].map((m) => m[1]);
}

function containsCommandRef(content, commandName) {
  return content.includes(`npm run ${commandName}`);
}

function reportCheck(checks, name, pass, details, suggestions = []) {
  checks.push({ name, pass, details, suggestions });
}

function main() {
  const checks = [];

  const packageJson = JSON.parse(readUtf8("package.json"));
  const hqCommands = Object.keys(packageJson.scripts ?? {})
    .filter((key) => key.startsWith("hq:"))
    .sort((a, b) => a.localeCompare(b));

  const helperWithHints = HQ_HELPER_SCRIPTS
    .filter((path) => existsSync(resolve(repoRoot, path)))
    .map((path) => ({ path, ...extractHints(path) }))
    .filter((entry) => entry.found);

  const canonicalHints = asSortedUnique(helperWithHints.flatMap((entry) => entry.hints));

  for (const entry of helperWithHints) {
    const candidate = asSortedUnique(entry.hints);
    const { missing, extra } = diffHints(canonicalHints, candidate);
    const pass = missing.length === 0 && extra.length === 0;
    const detailParts = [];
    if (missing.length) detailParts.push(`missing: ${missing.join(", ")}`);
    if (extra.length) detailParts.push(`extra: ${extra.join(", ")}`);
    reportCheck(
      checks,
      `HQ_PATH_HINTS parity :: ${entry.path}`,
      pass,
      pass ? "matches shared HQ hints" : detailParts.join(" | "),
      pass
        ? []
        : [
            `Sync ${entry.path} HQ_PATH_HINTS with shared list (${canonicalHints.length} entries).`,
          ],
    );
  }

  const readinessDoc = readUtf8("docs/HQ_COMMIT_READINESS.md");
  const docHints = asSortedUnique(extractDocScopeHints(readinessDoc));
  const docDiff = diffHints(canonicalHints, docHints);
  reportCheck(
    checks,
    "Scope hint docs parity :: docs/HQ_COMMIT_READINESS.md",
    docDiff.missing.length === 0 && docDiff.extra.length === 0,
    docDiff.missing.length === 0 && docDiff.extra.length === 0
      ? "matches shared HQ hints"
      : `missing: ${docDiff.missing.join(", ") || "none"} | extra: ${docDiff.extra.join(", ") || "none"}`,
    docDiff.missing.length || docDiff.extra.length
      ? ["Update Scope Hints list in docs/HQ_COMMIT_READINESS.md to match script hints."]
      : [],
  );

  for (const command of hqCommands) {
    for (const file of DOC_FILES) {
      const content = readUtf8(file);
      const present = containsCommandRef(content, command);
      reportCheck(
        checks,
        `Command reference :: ${command} in ${file}`,
        present,
        present ? "present" : "missing",
        present ? [] : [`Add \`npm run ${command}\` to ${file}.`],
      );
    }
  }

  for (const command of hqCommands) {
    if (command === "hq:precommit") continue;
    const commandValue = packageJson.scripts?.[command] ?? "";
    const match = commandValue.match(/node\s+(scripts\/[\w.-]+\.mjs)/);
    const expected = match?.[1];

    if (!expected) {
      reportCheck(
        checks,
        `Helper script mapping :: ${command}`,
        false,
        `unsupported mapping: ${commandValue || "(empty)"}`,
        [`Map ${command} to a node script (e.g., node scripts/<name>.mjs).`],
      );
      continue;
    }

    const hasScriptFile = existsSync(resolve(repoRoot, expected));
    reportCheck(
      checks,
      `Helper script exists :: ${expected}`,
      hasScriptFile,
      hasScriptFile ? "found" : "missing",
      hasScriptFile ? [] : [`Create ${expected} or update package.json mapping for ${command}.`],
    );
  }

  const failed = checks.filter((check) => !check.pass);
  const passed = checks.length - failed.length;
  const overallPass = failed.length === 0;

  console.log("HQ Workflow Consistency Check (dry-run)");
  console.log("=".repeat(39));
  console.log(`Overall: ${overallPass ? "PASS" : "FAIL"}`);
  console.log(`Checks: ${passed}/${checks.length} passed`);

  const grouped = [
    ...checks.filter((check) => !check.pass),
    ...checks.filter((check) => check.pass),
  ];

  for (const check of grouped) {
    console.log(`- [${check.pass ? "PASS" : "FAIL"}] ${check.name} — ${check.details}`);
  }

  if (failed.length > 0) {
    console.log("\nFix suggestions:");
    const suggestions = asSortedUnique(failed.flatMap((check) => check.suggestions));
    suggestions.forEach((item) => console.log(`- ${item}`));
    process.exit(1);
  }

  console.log("\nNo consistency issues found. Dry-run only: no files or git state were changed by this check.");
}

main();
