#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseHeartbeatPreflightOutput } from "../lib/hq-heartbeat-preflight-parse.mjs";

const __dirname = resolve(fileURLToPath(new URL(".", import.meta.url)));
const repoRoot = resolve(__dirname, "../..");

function run() {
  let output = "";

  try {
    output = execFileSync("npm", ["run", "--silent", "hq:heartbeat:preflight"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    output = `${error.stdout ?? ""}\n${error.stderr ?? ""}`;
  }

  const parsed = parseHeartbeatPreflightOutput(output);
  const f = parsed.fields;

  console.log(
    `[node] status=${parsed.status} contracts=${parsed.contracts} suite=${parsed.suite} founder=${parsed.founder}`,
  );
  console.log(
    `[node] suite=${Number.isNaN(parsed.suitePassed) ? "unknown" : parsed.suitePassed}/${Number.isNaN(parsed.suiteTotal) ? "unknown" : parsed.suiteTotal} founder_required_failures=${Number.isNaN(parsed.founderRequiredFailures) ? "unknown" : parsed.founderRequiredFailures} founder_next_key=${parsed.founderNextKey}`,
  );

  // strict mode preview (non-zero on failed required preflight checks)
  try {
    execFileSync("npm", ["run", "--silent", "hq:heartbeat:preflight"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "ignore", "ignore"],
    });
  } catch {
    console.log("[preflight] non-zero exit indicates FAIL status (expected when any subcheck fails)");
  }
}

run();
