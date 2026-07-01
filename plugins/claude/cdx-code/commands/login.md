---
description: Sign in to ContextDX in the browser and pick a board (no copy-paste)
allowed-tools: Read, Write, Bash, AskUserQuestion
---

Connect this codebase to ContextDX by signing in through the browser, then
picking a board that already has a binding. The credentials are written straight
into `.contextdx/config.json` for you — no copying tokens by hand.

> Prefer manual setup or running in CI? Use **`/configure`** instead — it stays
> fully supported and takes `bindingToken`/`apiSecret` directly.

## Login Workflow

### Step 1: Start the browser login

Run the start phase, which requests a one-time code and (best-effort) opens your
browser:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-login.js --start
```

Parse the JSON output and show the user:

- The **verification URL** (`verificationUriComplete` if present, else
  `verificationUri`) — a clickable link.
- The **user code** (`userCode`) — they may need to enter it on that page.
- Whether the browser opened automatically (`browserOpened`). If `false`, tell
  them to open the URL themselves.

Then tell the user: sign in, select the board you want this codebase bound
to, and confirm. Wait for them before continuing.

### Step 2: Wait for approval

Run the poll phase. It blocks until you finish in the browser (allow it to run
for a few minutes):

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-login.js --poll
```

Give the Bash call a generous timeout (e.g. 250s). Inspect the JSON `status`:

- **`complete`**: credentials were written and a connection test ran — go to
  Step 3.
- **`pending`**: you haven't finished in the browser yet. Run the same `--poll`
  command again to keep waiting (the code is still valid), or re-run `/login` if
  you closed the tab.
- On a non-zero exit (denied / expired): tell the user and offer to re-run
  `/login` from Step 1.

### Step 3: Confirm

On `status: "complete"`, report:

- Config file location (`.contextdx/config.json`) with the API secret masked
  (`apiSecretMasked`).
- The bound board (`boardSlug`) and `branch`.
- The connection test result (`connectionOk`). If `false`, the credentials were
  written but the test call failed — suggest re-running `/status` or `/login`.
- Confirm `.contextdx/` is gitignored (`gitignoreUpdated` reports whether the
  entry was just added; if it was already present, nothing changed).

You're connected — `/analyze` and `/sync` will now work.

## Notes

- **Where you sign in:** the browser opens the ContextDX app, which sends you to
  the ContextDX portal login (`https://portal.contextdx.com/login` by default).
  If your org uses the web app already, this is the same login.
- **Account state:** if your account isn't onboarded, is blocked, or its
  subscription has lapsed, the browser will show the onboarding / access page and
  you won't be able to bind a board — resolve that first, then re-run `/login`.
- **Local testing / self-hosted:** point the CLI at another API with
  `CONTEXTDX_BASE_URL` (or `--base-url`); the login and app URLs follow from that
  server's configuration, so nothing is hardcoded to production.
