#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const __dirname = resolve(fileURLToPath(new URL(".", import.meta.url)));
const repoRoot = resolve(__dirname, "..");

function main() {
  const schemaPath = resolve(repoRoot, "docs/hq-heartbeat.schema.json");
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));

  const raw = execFileSync("npm", ["run", "--silent", "hq:heartbeat", "--", "--json"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

  const payload = JSON.parse(raw);

  const jsonModeSchema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    ...(schema.properties?.jsonMode ?? {}),
  };

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(jsonModeSchema);
  const pass = validate(payload);

  if (!pass) {
    console.error("hq:heartbeat schema validation FAILED (dry-run)");
    for (const err of validate.errors ?? []) {
      console.error(`- ${err.instancePath || "/"} ${err.message}`);
    }
    process.exit(1);
  }

  console.log("hq:heartbeat schema validation PASS (dry-run)");
}

main();
