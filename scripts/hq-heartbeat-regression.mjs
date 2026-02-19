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
  console.log("Usage: node scripts/hq-heartbeat-regression.mjs [--strict|-s] [--help|-h]");
  console.log("Runs dry-run heartbeat modes and checks cross-mode invariants (prefixes, field presence/order, token consistency).");
  console.log("Prints a compact PASS/FAIL report suitable for cron/CI dry-run usage.");
  console.log("--strict exits non-zero when any invariant fails.");
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

function parseQuiet(line) {
  const parts = line.trim().split(/\s+/);
  if (parts[0] !== "HQ_HEARTBEAT") return null;

  const orderedFields = [
    "mode",
    "status",
    "hash",
    "required_passed",
    "required_total",
    "state",
    "next_key",
    "strict",
    "strict_exit",
  ];

  const parsedOrder = [];
  const values = {};
  for (const part of parts.slice(1)) {
    const eq = part.indexOf("=");
    if (eq === -1) return null;
    const key = part.slice(0, eq);
    const value = part.slice(eq + 1);
    parsedOrder.push(key);
    values[key] = value;
  }

  return {
    values,
    orderPass: orderedFields.join(",") === parsedOrder.join(","),
    raw: line,
  };
}

function parseTsv(line) {
  const cols = line.trim().split("\t");
  if (cols.length !== 11) return null;
  return {
    type: cols[0],
    mode: cols[1],
    status: cols[2],
    hash: cols[3],
    requiredPassed: cols[4],
    requiredTotal: cols[5],
    state: cols[6],
    nextKey: cols[7],
    nextCommand: cols[8],
    strict: cols[9],
    strictExit: cols[10],
  };
}

function parseStateToken(value) {
  const tokens = value.split(",");
  const map = {};
  for (const token of tokens) {
    const [key, pass] = token.split(":");
    if (!key || (pass !== "P" && pass !== "F")) return null;
    map[key] = pass;
  }
  return map;
}

function main() {
  if (helpMode) {
    usage();
    return;
  }

  const checks = [];

  const humanRun = runCommand("npm", ["run", "--silent", "hq:heartbeat"]);
  const jsonRun = runCommand("npm", ["run", "--silent", "hq:heartbeat", "--", "--json"]);
  const quietRun = runCommand("npm", ["run", "--silent", "hq:heartbeat", "--", "--quiet"]);
  const tsvRun = runCommand("npm", ["run", "--silent", "hq:heartbeat", "--", "--tsv"]);

  checks.push({ name: "exec:human", pass: humanRun.ok });
  checks.push({ name: "exec:json", pass: jsonRun.ok });
  checks.push({ name: "exec:quiet", pass: quietRun.ok });
  checks.push({ name: "exec:tsv", pass: tsvRun.ok });

  if (!humanRun.ok || !jsonRun.ok || !quietRun.ok || !tsvRun.ok) {
    const failed = checks.filter((c) => !c.pass);
    const strictExitCode = strictMode && failed.length > 0 ? 1 : 0;
    console.log(
      [
        "HQ_HEARTBEAT_REGRESSION",
        "mode=dry-run",
        `status=${failed.length === 0 ? "PASS" : "FAIL"}`,
        `passed=${checks.length - failed.length}`,
        `total=${checks.length}`,
        `strict=${strictMode ? 1 : 0}`,
        `strict_exit=${strictExitCode}`,
      ].join(" "),
    );
    for (const check of failed) console.log(`- [FAIL] ${check.name}`);
    if (strictMode && failed.length > 0) process.exit(1);
    return;
  }

  const human = humanRun.output;
  const jsonRaw = jsonRun.output;
  const quiet = parseQuiet(quietRun.output);
  const tsv = parseTsv(tsvRun.output);

  checks.push({
    name: "human:prefix",
    pass: /^HQ heartbeat dry-run @/.test(human),
  });
  checks.push({
    name: "human:shape",
    pass: /^HQ heartbeat dry-run @[^:]+: required \d+\/\d+ \(([^)]+)\); next .+$/.test(human),
  });

  let json;
  try {
    json = JSON.parse(jsonRaw);
    checks.push({ name: "json:parse", pass: true });
  } catch {
    checks.push({ name: "json:parse", pass: false });
  }

  if (json) {
    const requiredKeys = ["mode", "command", "hash", "required", "next", "strict", "strictExitCode"];
    const topKeys = Object.keys(json);
    const keysPresent = requiredKeys.every((k) => topKeys.includes(k));
    const keyOrderPass = requiredKeys.every((k, i) => topKeys[i] === k);

    checks.push({ name: "json:keys-present", pass: keysPresent });
    checks.push({ name: "json:key-order", pass: keyOrderPass });
    checks.push({ name: "json:prefix", pass: json.mode === "dry-run" && json.command === "hq:heartbeat" });

    const requiredState = json.required?.state;
    const requiredStateOrder = requiredState ? Object.keys(requiredState) : [];
    checks.push({
      name: "json:state-keys",
      pass:
        Boolean(requiredState) &&
        ["consistency", "verify", "handoff"].every((k) => k in requiredState) &&
        requiredStateOrder.join(",") === "consistency,verify,handoff",
    });
  }

  checks.push({ name: "quiet:parse", pass: Boolean(quiet) });
  if (quiet) {
    checks.push({ name: "quiet:order", pass: quiet.orderPass });
    checks.push({ name: "quiet:prefix", pass: quiet.values.mode === "dry-run" });
  }

  checks.push({ name: "tsv:parse", pass: Boolean(tsv) });
  if (tsv) {
    checks.push({ name: "tsv:prefix", pass: tsv.type === "HQ_HEARTBEAT" && tsv.mode === "dry-run" });
    checks.push({ name: "tsv:state-prefix", pass: /consistency:[PF],verify:[PF],handoff:[PF]/.test(tsv.state) });
  }

  if (json && quiet && tsv) {
    const jsonStateToken = [
      `consistency:${json.required.state.consistency ? "P" : "F"}`,
      `verify:${json.required.state.verify ? "P" : "F"}`,
      `handoff:${json.required.state.handoff ? "P" : "F"}`,
    ].join(",");

    const quietState = parseStateToken(quiet.values.state);
    const tsvState = parseStateToken(tsv.state);

    checks.push({ name: "invariant:hash", pass: json.hash === quiet.values.hash && json.hash === tsv.hash });
    checks.push({
      name: "invariant:required-counts",
      pass:
        String(json.required.passed) === quiet.values.required_passed &&
        String(json.required.total) === quiet.values.required_total &&
        String(json.required.passed) === tsv.requiredPassed &&
        String(json.required.total) === tsv.requiredTotal,
    });
    checks.push({
      name: "invariant:state-token",
      pass: Boolean(quietState) && Boolean(tsvState) && quiet.values.state === jsonStateToken && tsv.state === jsonStateToken,
    });

    const expectedStatus = json.required.passed === json.required.total ? "PASS" : "FAIL";
    checks.push({
      name: "invariant:status",
      pass: quiet.values.status === expectedStatus && tsv.status === expectedStatus,
    });

    const nextKey = json.next.includes("hq:consistency")
      ? "consistency"
      : json.next.includes("hq:verify")
        ? "verify"
        : json.next.includes("hq:handoff")
          ? "handoff"
          : "lint_build";

    checks.push({
      name: "invariant:next-key",
      pass: quiet.values.next_key === nextKey && tsv.nextKey === nextKey,
    });

    checks.push({
      name: "invariant:strict-default",
      pass:
        json.strict === false &&
        json.strictExitCode === 0 &&
        quiet.values.strict === "0" &&
        quiet.values.strict_exit === "0" &&
        tsv.strict === "0" &&
        tsv.strictExit === "0",
    });
  }

  const failed = checks.filter((check) => !check.pass);
  const status = failed.length === 0 ? "PASS" : "FAIL";
  const strictExitCode = strictMode && failed.length > 0 ? 1 : 0;

  console.log(
    [
      "HQ_HEARTBEAT_REGRESSION",
      "mode=dry-run",
      `status=${status}`,
      `passed=${checks.length - failed.length}`,
      `total=${checks.length}`,
      `strict=${strictMode ? 1 : 0}`,
      `strict_exit=${strictExitCode}`,
    ].join(" "),
  );

  if (failed.length > 0) {
    for (const check of failed) {
      console.log(`- [FAIL] ${check.name}`);
    }
  }

  if (strictMode && failed.length > 0) {
    process.exit(1);
  }
}

main();
