---
category: connect
description: "Connect · Configure ContextDX credentials and settings"
allowed-tools: Read, Write, Bash, AskUserQuestion
---

Set up ContextDX configuration for architecture sync.

> **Faster option:** `/login` signs you in through the browser and writes these
> credentials for you. Use `/configure` for manual setup or CI (credentials by hand).

## Credential Source

Credentials live in ONE place — the config file, never the chat:

**`.contextdx/config.json`**

```json
{
  "bindingToken": "YWJjMTIzLXV1aWQ6ZGVmNDU2LXV1aWQ",
  "apiSecret": "ck_cp_live_xxx",
  "baseUrl": "https://platform.contextdx.com/api",
  "branch": "main",
  "boardSlug": "my-project-overview",
  "excludePaths": ["node_modules", "dist", ".git", "coverage"],
  "includeTests": false,
  "includeSourceReferences": true
}
```

> **Security rule:** Never ask the user to paste `bindingToken` or `apiSecret` into the chat. Always have them edit the file directly, then confirm.

## Configuration Workflow

### Step 1: Ensure the config file exists

- Check whether `.contextdx/config.json` exists.
- **If it does NOT exist**, create the `.contextdx/` folder and write this skeleton (empty credentials, sane defaults). Empty credential fields are intentional — the user fills them in next:

  ```json
  {
    "bindingToken": "",
    "apiSecret": "",
    "baseUrl": "https://platform.contextdx.com/api",
    "branch": "main",
    "boardSlug": "",
    "excludePaths": ["node_modules", "dist", ".git", "coverage"],
    "includeTests": false,
    "includeSourceReferences": true
  }
  ```

- **If it already exists**, read it and continue (do not overwrite the user's file).
- Ensure `.contextdx/` is listed in `.gitignore` (add it if missing) so credentials never get committed.

### Step 2: Detect current state

Read `.contextdx/config.json` and inspect it:

- **Credentials present** (`bindingToken` and `apiSecret` both non-empty): display the current configuration with secrets masked (e.g. `ck_cp_live_****`), then skip to Step 4 to verify.
- **Credentials empty or missing**: go to Step 3.

### Step 3: Ask the user to fill in credentials (in the file, not the chat)

Tell the user to open `.contextdx/config.json` in their editor and fill in:

- `bindingToken` — base64url-encoded `orgId:bindingId`
- `apiSecret` — format `ck_cp_live_` followed by an alphanumeric string
- `branch` — must match the branch configured on the workboard binding (default `main`)
- Optional: `baseUrl`, `excludePaths`, `includeTests`, `includeSourceReferences` (defaults to `true`; set `false` to omit file-path source references from synced nodes/edges) — the skeleton already has working defaults

How to obtain the credentials:

1. Go to the ContextDx UI → ContextDX dashboard
2. Create/bind a ContextDX source to a workboard
3. Copy `bindingToken` and `apiSecret` into `.contextdx/config.json` and **save the file**

Then use **AskUserQuestion** to confirm completion — for example:

> "Have you saved your `bindingToken` and `apiSecret` in `.contextdx/config.json`?"
> Options: **"Yes — verify now"**, **"Not yet"**

- **Not yet**: stop here and let the user finish. They can re-run `/configure` when ready.
- **Yes**: re-read `.contextdx/config.json`. If `bindingToken` or `apiSecret` is still empty/malformed (`apiSecret` must start with `ck_cp_live_`), tell the user exactly which field is missing or wrong and re-prompt. Otherwise continue to Step 4.

### Step 4: Verify credentials (test connection)

Test the connection using the credentials now in the file:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-archetypes.js --no-cache
```

- **Exit 0** → connection works; report the archetype count as confirmation.
- **Exit 1** → config file problem; report the JSON `error` field and point the user at the specific field in `.contextdx/config.json` to fix, then re-verify.
- **Other non-zero** → API/auth failure; report the JSON `error` field. If `errorType` is `auth_invalid`, the credentials were rejected — have the user re-check `bindingToken`/`apiSecret` (or run `/login`), then re-verify.

### Step 5: Discover root board

After a successful connection test, discover the root board:

1. Run the boards CLI to fetch all boards from the server:

   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-boards.js
   ```

2. Parse the JSON output and find the root board (`isChildBoard === false`):
   - **Exactly one root board**: auto-set `boardSlug` in the config to the root board's slug
   - **Multiple root boards**: ask the user which root board to use for this project
   - **No root boards**: warn the user to create a board in the ContextDx UI first. Configuration can still be saved, but `/analyze` and `/sync` will not work until a root board exists.

3. Write `boardSlug` into `.contextdx/config.json` (preserve the user's other fields).

### Step 6: Confirmation

Report configuration complete:

- Configuration file location (`.contextdx/config.json`)
- Connection details (URL, branch, root board slug) with secrets masked
- Connection test result
- Confirmation that `.contextdx/` is gitignored

## Reconfiguration

If configuration already exists, ask the user whether to:

- **Switch to a different board (browser)** — re-bind this project to another board without hand-editing credentials. This re-resolves the full credential triple (`bindingToken` + `apiSecret` + `boardSlug`), since a different board is a different binding with its own secret. The `--rebind` flag is what unlocks the board picker — without it, a bound project's login is authentication-only:
  1. Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-login.js --start --rebind` and print the JSON `display` field verbatim (the browser opens best-effort).
  2. After they sign in, pick the new board, and confirm, run `node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-login.js --poll --analyze-cmd analyze-docs` (give the Bash call ~250s; re-run on `status: "pending"`). Print `display` verbatim.
  3. On `status: "complete"`, the config now points at the newly selected board — the `display` panel already shows it.
- Update specific fields (have them edit `.contextdx/config.json`, then confirm + re-verify)
- Re-run verification against the current file
- Cancel and keep existing

## After configuring — state the next step

When configuration is verified, run the offline status report and relay **only its `Lifecycle:` line** so the user knows the single next command:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-status.js --analyze-cmd analyze-docs
```

Do not print the whole report here — one line, one next step.
