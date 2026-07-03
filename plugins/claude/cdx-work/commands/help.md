---
description: List all cdx-work commands with descriptions and the plugin version
allowed-tools: Bash(node:*)
---

Show the user every command this plugin ships, what each one does, and the
plugin version. The script renders the final output itself — your only job is to
run it and pass its output through.

## Workflow

1. Run the help script:

   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-help.js
   ```

2. Print the script's stdout **verbatim** — it is already formatted markdown.
   Do not reformat, reorder, summarise, or add commentary.

3. If the script exits non-zero, print its output verbatim and stop. Do not
   fabricate command lists.
