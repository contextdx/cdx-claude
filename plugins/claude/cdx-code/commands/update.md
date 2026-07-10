---
category: connect
description: "Connect · Update this plugin to the latest published version"
allowed-tools: Bash(node:*)
---

Update **Cdx Code** (`cdx-code`) to the latest version published for
**Claude Code**. The script looks up the plugin's actual installed marketplace and scope and
updates it directly — it does not guess or retry blindly.

## Update workflow

Run the update script:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-update.js --host claude --plugin-name cdx-code --host-name "Claude Code"
```

Print the JSON `display` field **verbatim in your reply** — the Bash output panel is collapsed for
the user, so write it out in full. It already states old → new version (or the reason it couldn't
update). Do not reformat it, and do not state a version number yourself beyond what `display` says.

If the script exits non-zero, `display` already explains what went wrong (marketplace refresh
failed, plugin not found under any scope, or the update command itself failed) — relay it as-is
rather than guessing at a fix or retrying with different flags.
