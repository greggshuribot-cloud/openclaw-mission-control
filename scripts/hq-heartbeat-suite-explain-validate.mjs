#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const __dirname = resolve(fileURLToPath(new URL(".", import.meta.url)));
const repoRoot = resolve(__dirname, "..");

const EXPECTED_SUBCHECKS = ["check", "smoke", "regression"];
const EXPECTED_SUBCHECK_ORDER = "subcheck,status,reason";
const EXPECTED_REASON_MIN_ORDER = "code,reason";
const EXPECTED_AGGREGATE_ORDER = "mode,status,passed,total,state,checks";

function loadSchema() {
  const schemaPath = resolve(repoRoot, "docs/hq-heartbeat-suite-explain.schema.json");
  return JSON.parse(readFileSync(schemaPath, "utf8"));
}

function runSuiteExplain() {
  return execFileSync(
    "npm",
    ["run", "--silent", "hq:heartbeat:suite", "--", "--explain-json", "--explain-json-line"],
    {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  ).trim();
}

function parsePrefixedJsonLines(output, prefix) {
  const rows = [];
  for (const line of output.split("\n")) {
    if (!line.startsWith(`${prefix} `)) continue;
    const jsonPart = line.slice(prefix.length + 1);
    rows.push(JSON.parse(jsonPart));
  }
  return rows;
}

function joinKeys(value) {
  return Object.keys(value ?? {}).join(",");
}

function main() {
  const schema = loadSchema();
  const output = runSuiteExplain();

  const perRows = parsePrefixedJsonLines(output, "HQ_HEARTBEAT_SUITE_EXPLAIN_JSON");
  const aggregateRows = parsePrefixedJsonLines(output, "HQ_HEARTBEAT_SUITE_EXPLAIN_JSON_LINE");

  const checks = [];
  const fail = (name, detail) => checks.push({ name, pass: false, detail });
  const pass = (name) => checks.push({ name, pass: true, detail: "ok" });

  if (perRows.length === EXPECTED_SUBCHECKS.length) pass("rows:per-subcheck-count");
  else fail("rows:per-subcheck-count", `expected ${EXPECTED_SUBCHECKS.length}, got ${perRows.length}`);

  if (aggregateRows.length === 1) pass("rows:aggregate-count");
  else fail("rows:aggregate-count", `expected 1, got ${aggregateRows.length}`);

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  ajv.addSchema(schema);
  const validatePer = ajv.getSchema(`${schema.$id}#/$defs/perSubcheckJsonLine`);
  const validateAggregate = ajv.getSchema(`${schema.$id}#/$defs/aggregateJsonLine`);

  if (!validatePer || !validateAggregate) {
    console.error("hq:heartbeat:suite explain contract validation FAILED (dry-run)");
    console.error("- schema: unable to load per-subcheck/aggregate validators from docs/hq-heartbeat-suite-explain.schema.json");
    process.exit(1);
  }

  for (const [index, row] of perRows.entries()) {
    if (validatePer(row)) pass(`schema:per-subcheck:${index}`);
    else fail(`schema:per-subcheck:${index}`, (validatePer.errors ?? []).map((err) => `${err.instancePath || "/"} ${err.message}`).join(" | "));

    const keyOrder = joinKeys(row);
    if (keyOrder === EXPECTED_SUBCHECK_ORDER) pass(`order:per-subcheck:${index}`);
    else fail(`order:per-subcheck:${index}`, `expected ${EXPECTED_SUBCHECK_ORDER}, got ${keyOrder || "(empty)"}`);

    const reasonOrder = joinKeys(row.reason);
    if (reasonOrder.startsWith(EXPECTED_REASON_MIN_ORDER)) pass(`order:reason:${index}`);
    else fail(`order:reason:${index}`, `expected prefix ${EXPECTED_REASON_MIN_ORDER}, got ${reasonOrder || "(empty)"}`);
  }

  if (aggregateRows.length === 1) {
    const aggregate = aggregateRows[0];
    if (validateAggregate(aggregate)) pass("schema:aggregate");
    else fail("schema:aggregate", (validateAggregate.errors ?? []).map((err) => `${err.instancePath || "/"} ${err.message}`).join(" | "));

    const keyOrder = joinKeys(aggregate);
    if (keyOrder === EXPECTED_AGGREGATE_ORDER) pass("order:aggregate");
    else fail("order:aggregate", `expected ${EXPECTED_AGGREGATE_ORDER}, got ${keyOrder || "(empty)"}`);

    const checkOrder = (aggregate.checks ?? []).map((row) => row.subcheck).join(",");
    const expectedOrder = EXPECTED_SUBCHECKS.join(",");
    if (checkOrder === expectedOrder) pass("order:aggregate-checks-subcheck");
    else fail("order:aggregate-checks-subcheck", `expected ${expectedOrder}, got ${checkOrder || "(empty)"}`);
  }

  const failed = checks.filter((check) => !check.pass);

  if (failed.length > 0) {
    console.error("hq:heartbeat:suite explain contract validation FAILED (dry-run)");
    for (const check of failed) {
      console.error(`- ${check.name}: ${check.detail}`);
    }
    process.exit(1);
  }

  console.log("hq:heartbeat:suite explain contract validation PASS (dry-run)");
}

main();
