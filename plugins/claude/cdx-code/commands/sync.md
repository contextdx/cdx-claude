---
category: map
description: "Map · Sync architecture analysis to ContextDX"
argument-hint: [--board <slug> | --all]
allowed-tools: Read, Bash(node:*), AskUserQuestion
---

Synchronize local architecture analysis to ContextDX, board by board.

## Prerequisites

Before syncing, ensure:

1. At least one analysis has been run (`.contextdx/boards/manifest.json` exists with board entries)
2. Configuration is set up (`.contextdx/config.json` exists with credentials)

## Sync Modes

### Sync a specific board

```
/sync --board <board-slug>
```

Syncs a single board to ContextDX.

### Sync all boards

```
/sync --all
```

Reads the manifest and syncs all boards that have analysis data.

### Default (no args)

```
/sync
```

If only one board exists, syncs it. If multiple exist, lists them and asks which to sync.

## Sync Workflow

### Step 1: Read Configuration

Read `.contextdx/config.json` and extract ContextDX credentials:

- `bindingToken`: Combined authentication token
- `apiSecret`: API secret (starts with `ck_cp_live_`)
- `baseUrl`: API endpoint (default: `https://platform.contextdx.com/api`)
- `branch`: Git branch name for sync
- `boardSlug`: Root board slug

If configuration is missing or `boardSlug` is not set, make the **connect-now offer** (see Error Handling).

### Step 2: Load Board Manifest

Read `.contextdx/boards/manifest.json` to discover which boards exist and their metadata. If the manifest doesn't exist, instruct the user to run `/analyze` first.

### Step 2.5: Binding-Scope Check (offer cleanup for stale boards)

The manifest can carry boards from a **previous binding** (rebind residue) — syncing one would push at a board that belongs to another binding's tree, and both the CLI and the server refuse it. Check before picking boards:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-boards.js --check-scope
```

Parse the JSON output (`bindingScope.foreignBoards`):

- **Empty** → proceed silently to Step 3.
- **Non-empty** → print the `display` field verbatim, then ask with **AskUserQuestion** — "Archive N stale board(s) from a previous binding?" with options:
  - **Archive now (recommended)** → run `node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-boards.js --prune-foreign`, print its `display` verbatim (files move to `.contextdx/boards/_orphaned/`, reversible), then continue.
  - **Delete permanently** → same with `--prune-foreign --delete`.
  - **Skip for now** → continue, but only in-scope boards may be synced; the warning will reappear on every sync until cleaned.

### Step 3: Determine Boards to Sync

Based on the mode:
- `--board <slug>`: Sync only that board (validate it exists in manifest and is **in scope** per Step 2.5)
- `--all`: Sync all **in-scope** boards in the manifest (never the foreign ones)
- Default: If one in-scope board, sync it; if multiple, prompt user

### Step 3.5: Ensure Boards Exist on Server

Before pushing elements, ensure all target boards exist on the server. Run the boards CLI in ensure mode:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-boards.js \
  --ensure-boards .contextdx/boards/manifest.json
```

This:
1. Fetches existing boards from the server
2. Compares against the local manifest
3. Creates any missing child boards via `POST /code-plugin/boards`
4. Reports: X created, Y already existed, Z errors

Parse the JSON output:
- `created`: Board slugs that were newly created on the server
- `existing`: Board slugs that already existed (no action needed)
- `errors`: Board slugs that failed to create — warn the user but continue syncing boards that do exist
- `skippedForeign`: Manifest boards outside this binding's tree, skipped automatically (already handled in Step 2.5 — no action here)
- `boardUrls`: Map of board slug → clickable "view this board" URL (built by the server). A value may be `null` when the server can't resolve it. **Keep this map** — you'll print these links in Step 6 after each board syncs.

If any boards failed to create, warn the user. Boards that failed will likely cause 404 errors during sync — skip them and report at the end.

### Step 4: Sync Each Board via CLI

For each board to sync, run the ContextDX sync CLI with the board's analysis file and board slug:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-sync.js \
  --board-slug <board-slug> \
  --analysis .contextdx/boards/<board-slug>.json \
  --mode merge \
  --smart-sync
```

**CLI Options:**

- `--board-slug <slug>`: **Required** — board slug to sync to
- `--analysis <path>`: **Required** — analysis file path
- `--config <path>`: Config file path (default: `.contextdx/config.json`, rarely needed)
- `--mode <mode>`: Push mode - `merge` (default) or `replace`
- `--dry-run`: Validate and transform only, don't push to API
- `--smart-sync`: Enable diff-based sync (pulls server state, computes diff, pushes only changes)
- `--force-pull`: Force refresh of server elements before computing diff
- `--force-push`: Push all elements regardless of diff results

### Step 5: Parse CLI Output

The CLI outputs one JSON object to stdout. Branch on `success`:

- **`success: true`** — summarise from `pushResult` (`nodesCreated`/`nodesUpdated`/`edgesCreated`/`edgesUpdated`, plus any `pushResult.errors[]`) and, in smart-sync mode, the `diff` counts (`newNodes`/`changedNodes`/`unchangedNodes`, same for edges).
- **`success: false`** — report the `error` field. If `errorType` is `auth_invalid`, the credentials were rejected (revoked binding or rotated secret) — make the **connect-now offer** (see Error Handling) rather than reporting a generic API error.

Two honesty fields may appear on success — **always surface them** when present:

- `conflicts` (`{nodes: [...], edges: [...]}`): both the local analysis and the server changed these elements since the last sync (an architect or another source edited them). They were **not pushed**. List the slugs and tell the user: review on the board, then re-run with `--force-push` to overwrite the server's version.
- `deletedOnServer` (`{nodes: [...], edges: [...]}`): these were deleted on the server since the last sync and were **not recreated**. List the slugs; re-running with `--force-push` recreates them if the deletion was unintended.

### Step 6: Report Results

For each synced board, report:
- Board slug and layer
- Nodes: X created, Y updated
- Edges: X created, Y updated
- Any errors from the `pushResult.errors` array
- **View link**: if `boardUrls[<board-slug>]` (from Step 3.5) is a non-null URL, print it as a clickable link, e.g. `🔗 View board: <url>`. If it's `null` or absent, skip the link silently (don't surface an error — the server may be older or the link not yet resolvable).

If syncing multiple boards, show a summary at the end, including each board's view link where available.

---

## Error Handling

CLI exit codes:

- `0`: Success
- `1`: Configuration error (missing file, invalid format, missing --board-slug) — make the **connect-now offer** (below). Also used for a **branch mismatch** (current git branch differs from the binding's pinned branch) and for an **out-of-scope board** (the target board belongs to a previous binding's tree) — in both cases relay the `error` field verbatim; it names the fix (no connect-now offer: the config is fine). For out-of-scope, offer the Step 2.5 cleanup instead
- `2`: Analysis file error (missing or invalid JSON, missing boardSlug in metadata) — suggest running `/analyze` first
- `3`: Validation error (invalid node/edge structure or archetype mismatch) — report the JSON `error` detail
- `4`: API error — report the JSON `error`; the CLI already retries transient failures and maps HTTP errors to messages, so relay its text rather than re-deriving HTTP semantics

### Connect-now offer

Used whenever ContextDX is not configured or the credentials were rejected (`errorType: "auth_invalid"`). Ask with **AskUserQuestion** — "Connect to ContextDX now?" (**Connect now** / **Not now**):

- **Connect now** → run the browser login here, printing each JSON `display` verbatim **in your reply** (the Bash output panel is collapsed for the user): `node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-login.js --start`, then `node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-login.js --poll --analyze-cmd analyze` (generous Bash timeout, e.g. 250s). On `status: "complete"`, resume this command from the step that failed; anything else — stop, the display explains.
- **Not now** → stop with the canonical message: "ContextDX not configured — run `/login` (browser) or `/configure` (manual) first" (or, when credentials were rejected: "Your ContextDX credentials were rejected — run `/login` to reconnect").
