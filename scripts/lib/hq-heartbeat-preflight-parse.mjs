#!/usr/bin/env node

const PREFLIGHT_PREFIX = "HQ_HEARTBEAT_PREFLIGHT";

function parseTokenLine(line) {
  const fields = {};
  for (const token of line.trim().split(/\s+/)) {
    const separatorIndex = token.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = token.slice(0, separatorIndex);
    const value = token.slice(separatorIndex + 1);
    if (!key) continue;
    fields[key] = value;
  }
  return fields;
}

export function parseHeartbeatPreflightLine(line) {
  const trimmed = String(line ?? "").trim();
  if (!trimmed.startsWith(`${PREFLIGHT_PREFIX} `)) {
    throw new Error(`Expected ${PREFLIGHT_PREFIX} token line.`);
  }

  const fields = parseTokenLine(trimmed);
  return {
    prefix: PREFLIGHT_PREFIX,
    line: trimmed,
    fields,
    status: fields.status ?? "unknown",
    contracts: fields.contracts ?? "unknown",
    suite: fields.suite ?? "unknown",
    founder: fields.founder ?? "unknown",
    founderNextKey: fields.founder_next_key ?? "unknown",
    suitePassed: Number.parseInt(fields.suite_passed ?? "-1", 10),
    suiteTotal: Number.parseInt(fields.suite_total ?? "-1", 10),
    founderRequiredFailures: Number.parseInt(fields.founder_required_failures ?? "-1", 10),
  };
}

export function parseHeartbeatPreflightOutput(output) {
  const lines = String(output ?? "").split(/\r?\n/);
  const line = [...lines].reverse().find((candidate) => candidate.startsWith(`${PREFLIGHT_PREFIX} `));

  if (!line) {
    throw new Error(`Missing ${PREFLIGHT_PREFIX} line in output.`);
  }

  return parseHeartbeatPreflightLine(line);
}

export { PREFLIGHT_PREFIX };
