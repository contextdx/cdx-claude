---
category: connect
description: "Connect · List all cdx-code commands with descriptions and the plugin version"
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

2. Reproduce the script's stdout **verbatim in your reply** — write it out in
   full; the Bash output panel is collapsed for the user, so nothing shows
   unless you do. Print it fresh each call (not "same as last run"), and don't
   reformat, reorder, summarise, or add commentary.

3. If the script exits non-zero, print its output verbatim and stop. Do not
   fabricate command lists.
