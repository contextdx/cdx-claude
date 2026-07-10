---
category: connect
description: "Connect · Disconnect this project from ContextDX (clears local credentials)"
argument-hint: "[--purge]"
allowed-tools: Bash
---

Disconnect this document set from ContextDX by clearing the credentials in
`.contextdx/config.json`. By default the board, branch, and server settings are
kept so a later `/login` reconnects in one confirm; `--purge` resets the whole
config to its defaults. This is a **local** disconnect — the display explains
the server-side caveat.

## Workflow

1. Run the logout phase (add `--purge` only if the user asked for a full reset):

   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-login.js --logout
   ```

2. Print the JSON `display` field **verbatim in your reply** — never reformat,
   summarise, or rebuild it; the Bash output panel is collapsed for the user, so
   write it out in full. It already covers what was cleared, the server-side
   caveat, and the next command (`/login`).

3. On a non-zero exit, print `display` verbatim in your reply and stop.
