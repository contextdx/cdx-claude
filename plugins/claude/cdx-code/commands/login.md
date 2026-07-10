---
category: connect
description: "Connect · Sign in to ContextDX in the browser and pick a board (no copy-paste)"
argument-hint: "[switch]"
allowed-tools: Bash
---

Connect this codebase to ContextDX by signing in through the browser. The
credentials are written straight into `.contextdx/config.json` for you — no
copying tokens by hand.

`/login` is **idempotent**: already connected → it says so and stops; stored
credentials rejected → it flows straight into a fresh sign-in. To bind this
project to a **different workspace/board**, run `/login switch` (the browser is
already signed in, so switching is just picking the new board). `/configure`
can also switch boards; `/logout` disconnects this project.

> Prefer manual setup or running in CI? Use **`/configure`** instead — it stays
> fully supported and takes `bindingToken`/`apiSecret` directly.

## Login Workflow

The script's JSON output always includes a `display` field of ready-made
markdown. **Print `display` verbatim in your reply — never reformat, summarise, or rebuild it; the Bash output panel is collapsed for the user.**
Branch only on `status` and the exit code.

### Step 0: Check the current connection

Skip this step entirely when the user asked to switch boards (`switch`
argument, or an explicit ask) — go straight to Step 1 with `--rebind`.
Otherwise run:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-login.js --check
```

Branch on `status`:

- **`authenticated`** → print `display` verbatim and **stop** — the user is
  already connected; the panel names `/logout` and `/login switch`.
- **`invalid`** → print `display` verbatim (stored credentials were rejected —
  a fresh sign-in follows), then continue to Step 1.
- **`unauthenticated`** or **`unreachable`** → continue to Step 1 without
  printing anything (Step 1 reports its own success or failure).

### Step 1: Start the browser login

Run the start phase. It requests a one-time code and (best-effort) opens the
user's default browser. A project already bound to a board re-authenticates to
that same board; `--rebind` (the `switch` path) unlocks the full picker:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-login.js --start          # add --rebind only for /login switch
```

Print the JSON `display` field verbatim, then wait for the user to finish in
the browser before continuing.

On a non-zero exit, print `display` verbatim and stop.

### Step 2: Wait for approval

Run the poll phase. It blocks until the user finishes in the browser (allow it
to run for a few minutes — give the Bash call a generous timeout, e.g. 250s):

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-login.js --poll --analyze-cmd analyze
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

Once login completes (`status: "complete"`), run the offline status report and relay **only its `Lifecycle:` line** so the user knows the single next command (e.g. `/analyze-archetypes` for an existing codebase, or `/build` for an empty repo with compiled skills):

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-status.js --analyze-cmd analyze
```

Do not print the whole report here — one line, one next step.
