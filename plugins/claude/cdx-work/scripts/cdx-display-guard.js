#!/usr/bin/env node
/**
 * PostToolUse display guard (Claude/Codex plugin hook).
 * When a Bash tool call ran a cdx CLI whose JSON output carries a `display`
 * field, inject a reminder to print that display verbatim — the script, not
 * the model, owns user-facing rendering (see command standards in the source
 * repo). The display body itself is NOT repeated here; it is already in the
 * tool result — this only pins the behavior.
 *
 * Fail-open by design: any parse problem exits 0 with no output. Plain node,
 * no dependencies, no build tokens (copied untokenized by build-plugins.js).
 */

"use strict";

const fs = require("fs");

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
  if (!command.includes("scripts/cdx-")) return;

  // Bash tool_response shapes vary by host — accept a string or an object
  // carrying stdout.
  const response = input.tool_response;
  let text = "";
  if (typeof response === "string") {
    text = response;
  } else if (response && typeof response.stdout === "string") {
    text = response.stdout;
  } else if (response !== undefined) {
    try {
      text = JSON.stringify(response);
    } catch {
      return;
    }
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return;
  let parsed;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return;
  }
  if (!parsed || typeof parsed.display !== "string") return;

  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext:
          "The cdx CLI output above includes a `display` field of ready-to-print markdown. Print that display to the user verbatim — do not reformat, reorder, summarise, or rebuild its tables.",
      },
    }),
  );
}

main();
