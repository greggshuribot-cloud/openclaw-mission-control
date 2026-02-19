#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const __dirname = resolve(fileURLToPath(new URL(".", import.meta.url)));
const repoRoot = resolve(__dirname, "..");

const EXPECTED_PREFIX = "HQ_HEARTBEAT_PREFLIGHT";
const EXPECTED_FIELD_ORDER = [
  "mode",
  "status",
  "contracts",
  "contracts_heartbeat_schema",
  "contracts_suite_explain_contract",
  "suite",
  "suite_state",
  "suite_passed",
  "suite_total",
  "founder",
  "founder_passed",
  "founder_total",
  "founder_required_failures",
  "founder_next_key",
];

function loadSchema() {
  const schemaPath = resolve(repoRoot, "docs/hq-heartbeat-preflight.schema.json");
  return JSON.parse(readFileSync(schemaPath, "utf8"));
}

function runPreflight() {
  try {
    return execFileSync("npm", ["run", "--silent", "hq:heartbeat:preflight"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    return String(error.stdout ?? "").trim();
  }
}

function parsePreflightLine(output) {
  const line = output
    .split("\n")
    .map((row) => row.trim())
    .filter(Boolean)
    .find((row) => row.startsWith(`${EXPECTED_PREFIX} `));

  if (!line) return null;

  const tokens = line.split(/\s+/);
  const prefix = tokens.shift() ?? "";

  const fields = {};
  const order = [];
  for (const token of tokens) {
    const idx = token.indexOf("=");
    if (idx === -1) continue;
    const key = token.slice(0, idx);
    const value = token.slice(idx + 1);
    fields[key] = value;
    order.push(key);
  }

  return { line, prefix, fields, order };
}

function asInt(value) {
  return Number.parseInt(String(value), 10);
}

function main() {
  const checks = [];
  const fail = (name, detail) => checks.push({ name, pass: false, detail });
  const pass = (name) => checks.push({ name, pass: true, detail: "ok" });

  const schema = loadSchema();
  const output = runPreflight();
  const parsed = parsePreflightLine(output);

  if (!parsed) {
    fail("line:prefixed", "missing HQ_HEARTBEAT_PREFLIGHT line");
  } else {
    if (parsed.prefix === EXPECTED_PREFIX) pass("line:prefix");
    else fail("line:prefix", `expected ${EXPECTED_PREFIX}, got ${parsed.prefix || "(empty)"}`);

    const order = parsed.order.join(",");
    const expectedOrder = EXPECTED_FIELD_ORDER.join(",");
    if (order === expectedOrder) pass("order:fields");
    else fail("order:fields", `expected ${expectedOrder}, got ${order || "(empty)"}`);

    const ajv = new Ajv2020({ allErrors: true, strict: false });
    const validate = ajv.compile(schema);
    if (validate(parsed.fields)) pass("schema:fields");
    else {
      const details = (validate.errors ?? []).map((err) => `${err.instancePath || "/"} ${err.message}`).join(" | ");
      fail("schema:fields", details || "unknown schema error");
    }

    const status = parsed.fields.status;
    const contracts = parsed.fields.contracts;
    const suite = parsed.fields.suite;
    const founder = parsed.fields.founder;

    const allPass = contracts === "PASS" && suite === "PASS" && founder === "PASS";
    if ((status === "PASS") === allPass) pass("invariant:status-aligns-subchecks");
    else {
      fail(
        "invariant:status-aligns-subchecks",
        `status=${status} contracts=${contracts} suite=${suite} founder=${founder}`,
      );
    }

    const suitePassed = asInt(parsed.fields.suite_passed);
    const suiteTotal = asInt(parsed.fields.suite_total);
    if (Number.isInteger(suitePassed) && Number.isInteger(suiteTotal) && suitePassed >= 0 && suiteTotal >= 0 && suitePassed <= suiteTotal) {
      pass("invariant:suite-count-range");
    } else {
      fail("invariant:suite-count-range", `suite_passed=${parsed.fields.suite_passed} suite_total=${parsed.fields.suite_total}`);
    }

    const founderPassed = asInt(parsed.fields.founder_passed);
    const founderTotal = asInt(parsed.fields.founder_total);
    const founderRequiredFailures = asInt(parsed.fields.founder_required_failures);
    if (
      Number.isInteger(founderPassed)
      && Number.isInteger(founderTotal)
      && Number.isInteger(founderRequiredFailures)
      && founderPassed >= 0
      && founderTotal >= 0
      && founderRequiredFailures >= 0
      && founderPassed <= founderTotal
      && founderRequiredFailures <= founderTotal
    ) {
      pass("invariant:founder-count-range");
    } else {
      fail(
        "invariant:founder-count-range",
        `founder_passed=${parsed.fields.founder_passed} founder_total=${parsed.fields.founder_total} founder_required_failures=${parsed.fields.founder_required_failures}`,
      );
    }

    const founderConsistent = (founder === "PASS" && founderRequiredFailures === 0)
      || (founder === "FAIL" && founderRequiredFailures > 0);

    if (founderConsistent) pass("invariant:founder-status-required-failures");
    else {
      fail(
        "invariant:founder-status-required-failures",
        `founder=${founder} founder_required_failures=${parsed.fields.founder_required_failures}`,
      );
    }
  }

  const failed = checks.filter((check) => !check.pass);

  if (failed.length > 0) {
    console.error("hq:heartbeat:preflight contract validation FAILED (dry-run)");
    for (const check of failed) {
      console.error(`- ${check.name}: ${check.detail}`);
    }
    process.exit(1);
  }

  console.log("hq:heartbeat:preflight contract validation PASS (dry-run)");
}

main();
