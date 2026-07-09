#!/usr/bin/env node
/**
 * PreToolUse resolve gate (Claude/Codex plugin hook).
 * Denies `cdx-intents.js --resolve <id> --kind implemented` unless fresh
 * passing verify evidence exists at .contextdx/intents/verify/<id>.json —
 * mechanical enforcement of "no verify, no implemented". The intents CLI
 * applies the same rule itself (the host-independent backstop); this hook
 * stops the attempt before a process even runs.
 *
 * The evidence contract (shape, 30-minute freshness, filename sanitization)
 * mirrors packages/shared/src/core/intent-manager.ts — keep them in sync.
 *
 * Fail-open on anything unparseable: exit 0 with no output. Plain node,
 * no dependencies, no build tokens (copied untokenized by build-plugins.js).
 */

"use strict";

const fs = require("fs");
const path = require("path");

const VERIFY_EVIDENCE_MAX_AGE_MS = 30 * 60 * 1000;

function evidenceProblem(verifyPath) {
  let evidence;
  try {
    evidence = JSON.parse(fs.readFileSync(verifyPath, "utf-8"));
  } catch {
    return "no checks are recorded";
  }
  const checks =
    evidence && Array.isArray(evidence.checks) ? evidence.checks : [];
  if (checks.length === 0) {
    return "no checks are recorded";
  }
  const recordedAt = Date.parse(evidence.recordedAt);
  if (!Number.isFinite(recordedAt)) {
    return "no checks are recorded";
  }
  if (Date.now() - recordedAt > VERIFY_EVIDENCE_MAX_AGE_MS) {
    return "the recorded checks are older than 30 minutes — re-run them";
  }
  if (checks.some((c) => c && c.exitCode !== 0)) {
    return "a recorded check is failing — fix it and re-record";
  }
  return null;
}

function main() {
  let input;
  try {
    input = JSON.parse(fs.readFileSync(0, "utf-8"));
  } catch {
    return;
  }

  const command =
    input && input.tool_input && typeof input.tool_input.command === "string"
      ? input.tool_input.command
      : "";
  if (!command.includes("cdx-intents.js")) return;
  if (!/--kind[=\s]+["']?implemented\b/.test(command)) return;

  const idMatch = command.match(/--resolve[=\s]+["']?([^"'\s]+)/);
  if (!idMatch) return;
  // Same sanitization as IntentManager's file paths.
  const safeId = idMatch[1].replace(/[^A-Za-z0-9._-]/g, "_");

  const cwd =
    input && typeof input.cwd === "string" && input.cwd.length > 0
      ? input.cwd
      : process.cwd();
  const verifyPath = path.join(
    cwd,
    ".contextdx",
    "intents",
    "verify",
    `${safeId}.json`,
  );

  const problem = evidenceProblem(verifyPath);
  if (!problem) return;

  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: `Resolving as implemented needs fresh passing verify evidence — ${problem}. Run the project's checks and record each one first: cdx-intents.js --record-verify ${idMatch[1]} --command "<cmd>" --exit-code <n>`,
      },
    }),
  );
}

main();
