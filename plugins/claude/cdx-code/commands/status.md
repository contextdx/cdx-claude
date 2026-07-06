---
category: connect
description: Show ContextDX sync status and analysis summary
allowed-tools: Bash(node:*)
---

Show the full ContextDX status for this project — configuration, archetype
precondition, boards (analysis + sync state + changed files), and adopted
aspects. The script renders the final report itself — your only job is to run
it and pass its output through.

## Workflow

1. Run the status script:

   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-status.js --analyze-cmd analyze
   ```

2. Print the script's stdout **verbatim** — it is already formatted markdown,
   including a "Next steps" section. Do not reformat, reorder, summarise, or
   re-derive any state by reading `.contextdx/` files yourself.

3. If the script exits non-zero, print its output verbatim and stop. Do not
   fabricate status.

The report is offline (local `.contextdx/` state + local git only) — it never
calls the API, so it cannot verify credentials. If the user asks whether the
connection actually works, point them to `/login` (browser) or `/configure`
(manual), which test the connection.
