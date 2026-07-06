---
category: connect
description: Sign in to ContextDX in the browser and pick a board (no copy-paste)
allowed-tools: Read, Write, Bash, AskUserQuestion
---

Connect this document set to ContextDX by signing in through the browser. The
credentials are written straight into `.contextdx/config.json` for you — no
copying tokens by hand.

If this project is **already bound to a board** (non-empty `boardSlug` in
`.contextdx/config.json`), `/login` asks whether to **reconnect** to that board
(refresh credentials; board and branch unchanged) or **connect to a different
workspace/board** for this project. The browser is already signed in, so
switching is just picking the new board — no repeated login. `/configure` can
also switch boards; deleting `.contextdx/config.json` starts a fresh full setup.

> Prefer manual setup or running in CI? Use **`/configure`** instead — it stays
> fully supported and takes `bindingToken`/`apiSecret` directly.

## Login Workflow

The script's JSON output always includes a `display` field of ready-made
markdown. **Print `display` verbatim — never reformat, summarise, or rebuild it.**
Branch only on `status` and the exit code.

### Step 0: Already bound to a board?

Read `.contextdx/config.json` and choose the Step 1 start flag by its `boardSlug`:

- **Empty or absent** → fresh connection: use `--start` (the browser shows the
  full workspace/board picker).
- **Non-empty** → this project is already bound to that board. You're already
  signed in, so no full re-login is needed — ask with **AskUserQuestion**:
  - **"Reconnect to `<boardSlug>`"** (refresh credentials; same board and
    branch) → use `--start`.
  - **"Connect to a different workspace/board"** (bind this project to another
    board) → use `--start --rebind`, which unlocks the full picker.

Carry the chosen flag into Step 1.

### Step 1: Start the browser login

Run the start phase with the flag chosen in Step 0. It requests a one-time code
and (best-effort) opens the user's default browser:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-login.js --start          # add --rebind to bind a different board
```

Print the JSON `display` field verbatim, then wait for the user to finish in
the browser before continuing.

On a non-zero exit, print `display` verbatim and stop.

### Step 2: Wait for approval

Run the poll phase. It blocks until the user finishes in the browser (allow it
to run for a few minutes — give the Bash call a generous timeout, e.g. 250s):

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-login.js --poll --analyze-cmd analyze-docs
```

Print the JSON `display` field verbatim. Then, by `status`:

- **`complete`**: done — the `display` panel already confirms the connection
  and next steps. Nothing more to add.
- **`pending`**: the user hasn't finished in the browser yet. Run the same
  `--poll` command again to keep waiting (the code is still valid), or re-run
  `/login` if they closed the tab.
- On a non-zero exit (denied / expired / board mismatch): `display` explains
  what happened — offer to re-run `/login` from Step 1 if appropriate.

## Notes

- **Where you sign in:** the browser opens the ContextDX app, which sends you to
  the ContextDX portal login. If your org uses the web app already, this is the
  same login.
- **Account state:** if your account isn't onboarded, is blocked, or its
  subscription has lapsed, the browser will show the onboarding / access page and
  you won't be able to bind a board — resolve that first, then re-run `/login`.
- **Local testing / self-hosted:** point the CLI at another API with
  `CONTEXTDX_BASE_URL` (or `--base-url`), e.g. `http://localhost:8081/api` — see
  the repo's local-testing guide. A successful login pins that URL into
  `.contextdx/config.json`, so later commands stay on the same server without
  env vars.

## After connecting — state the next step

Once login completes (`status: "complete"`), run the offline status report and relay **only its `Lifecycle:` line** so the user knows the single next command (e.g. `/analyze-archetypes` for an existing document set, or `/build` for an empty repo with compiled skills):

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-status.js --analyze-cmd analyze-docs
```

Do not print the whole report here — one line, one next step.
