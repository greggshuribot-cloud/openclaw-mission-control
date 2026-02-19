#!/usr/bin/env node

const GATES_PREFIX = "HQ_HEARTBEAT_GATES";

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

export function parseHeartbeatGatesLine(line) {
  const trimmed = String(line ?? "").trim();
  if (!trimmed.startsWith(`${GATES_PREFIX} `)) {
    throw new Error(`Expected ${GATES_PREFIX} token line.`);
  }

  const fields = parseTokenLine(trimmed);
  return {
    prefix: GATES_PREFIX,
    line: trimmed,
    fields,
    status: fields.status ?? "unknown",
    strict: fields.strict ?? "unknown",
    strictExit: Number.parseInt(fields.strict_exit ?? "-1", 10),
  };
}

export function parseHeartbeatGatesOutput(output) {
  const lines = String(output ?? "").split(/\r?\n/);
  const line = [...lines].reverse().find((candidate) => candidate.startsWith(`${GATES_PREFIX} `));

  if (!line) {
    throw new Error(`Missing ${GATES_PREFIX} line in output.`);
  }

  return parseHeartbeatGatesLine(line);
}

export { GATES_PREFIX };
