---
category: connect
description: Update this plugin to the latest published version
allowed-tools: Bash
---

Update **Cdx Work** (`cdx-work`) to the latest version published for
**Claude Code**. The update mechanism differs per host — the steps below already resolved to
the right one for this install.

## Update workflow

Run these to update the plugin, then tell the user to restart Claude Code:

```bash
claude plugin marketplace update contextdx
claude plugin update cdx-work
```

Installed with a non-default scope? Re-run the second command with `--scope project` or `--scope local` to match.

## After updating

- If the steps above ran shell commands, confirm they exited cleanly before telling the user the
  update is done — relay any error output verbatim rather than guessing at the cause.
- **Don't state a version number yourself.** These commands don't reliably report the new version
  before a restart — plugin installs are versioned directories, and this session's plugin root
  stays pinned to the old one until relaunch. Relay only what the command output actually said.
- The update only takes effect after **restarting Claude Code** — say so explicitly, every time,
  and point the user at `/help` (or `/status`) right after they restart to confirm which version
  is now active.
- Already on the latest version? Say so plainly instead of re-running anything.
