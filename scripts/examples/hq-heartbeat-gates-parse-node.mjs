#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseHeartbeatGatesOutput } from "../lib/hq-heartbeat-gates-parse.mjs";

const __dirname = resolve(fileURLToPath(new URL(".", import.meta.url)));
const repoRoot = resolve(__dirname, "../..");

function run() {
  let output = "";

  try {
    output = execFileSync("npm", ["run", "--silent", "hq:heartbeat:gates", "--", "--no-strict"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    output = `${error.stdout ?? ""}\n${error.stderr ?? ""}`;
  }

  const parsed = parseHeartbeatGatesOutput(output);
  const f = parsed.fields;

  console.log(
    `[node] status=${parsed.status} strict=${parsed.strict} strict_exit=${Number.isNaN(parsed.strictExit) ? "unknown" : parsed.strictExit}`,
  );
  console.log(
    `[node] contracts=${f.contracts ?? "unknown"} preflight_validate=${f.preflight_validate ?? "unknown"} suite_explain_validate=${f.suite_explain_validate ?? "unknown"}`,
  );

  // strict mode preview (default): non-zero on any failing gate
  try {
    execFileSync("npm", ["run", "--silent", "hq:heartbeat:gates"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "ignore", "ignore"],
    });
  } catch {
    console.log("[gates] non-zero exit indicates FAIL status in strict mode (expected when any gate fails)");
  }
}

run();
