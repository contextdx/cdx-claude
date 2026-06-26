---
description: List all cdx-code commands with descriptions and the plugin version
allowed-tools: Bash(node:*)
---

Show the user every command this plugin ships, what each one does, and the plugin version. The command set is read from the actual command files at runtime — no hand-maintained list.

## Workflow

1. Run the help script:

   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-help.js
   ```

2. Parse the JSON output. It has shape:

   ```json
   {
     "success": true,
     "plugin": { "name": "cdx-code", "version": "0.4.3", "description": "..." },
     "commands": [
       { "name": "analyze", "description": "...", "argumentHint": "...", "file": "commands/analyze.md" }
     ]
   }
   ```

3. Render the output exactly as below (substitute the JSON values). Use the plugin's own `name` for the command prefix — do not hard-code `cdx-code`:

   ```
   # <plugin.name> v<plugin.version>

   <plugin.description>

   ## Commands

   | Command | Arguments | Description |
   | ------- | --------- | ----------- |
   | `/<plugin.name>:<command.name>` | `<command.argumentHint>` or — | <command.description> |

   > **Opting out of source references:** synced nodes and edges include file-path source references (and links into your git host) by default. To omit them from what `/sync` pushes, set `"includeSourceReferences": false` in `.contextdx/config.json`.
   ```

   - List commands in the order returned by the script (alphabetical).
   - For commands with no `argumentHint`, show `—` (em-dash) in the Arguments column.
   - If `plugin.description` is long, render it on its own paragraph above the table, not wrapped into the table.
   - Always include the source-references opt-out note after the table — it's static guidance, not part of the script's JSON output.

4. If the script exits non-zero or returns `success: false`, print the `error` field and stop. Do not fabricate command lists.
