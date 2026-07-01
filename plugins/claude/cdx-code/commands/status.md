---
description: Show ContextDX sync status and analysis summary
allowed-tools: Read, Bash(git:*)
---

Display current sync status and analysis summary for ContextDX integration.

## Status Check Workflow

### Step 1: Configuration Status

Read `.contextdx/config.json` and report:
- Base URL (configured or not)
- Branch (configured or not)
- Exclude paths configured

If not configured, suggest running `/login` (browser) or `/configure` (manual).

### Step 1.5: Archetype Precondition Status

Read `.contextdx/archetype-analysis.lock.json` if it exists. Report:

- **No lock file** → "Archetype precondition not yet run. Start with `/analyze-archetypes` to settle the catalogue before `/analyze`."
- **Lock with `submittedAt: null` and `skippedAt: null`** → "Archetype scan completed on <date>; no gaps. Catalogue is settled at commit `<short-hash>`."
- **Lock with `skippedAt` set** → "Archetype scan skipped on <date>. Components may have misfit archetypes. Re-run `/analyze-archetypes` after admin reviews the catalogue."
- **Lock with `submittedAt` set and `proposalIds[]` non-empty**:
  - Count the IDs: report "N proposals submitted on <date> (awaiting approval)."
  - List the proposal IDs (truncated to first 8 chars) so the user can correlate with the ContextDX UI.
  - Suggest: "Re-run `/analyze-archetypes` after admin approval, then `/analyze --clean` to retype affected components."
- **Lock stale** (commitHash or catalogueHash differs from current): warn "Archetype lock is stale. Re-run `/analyze-archetypes`."

### Step 2: Board Manifest Status

Read `.contextdx/boards/manifest.json` (if it exists) and report:
- Number of boards
- For each board: slug, name, layer, last analysis timestamp

If manifest missing, suggest running `/analyze`.

### Step 3: Per-Board Analysis Summary

For each board in the manifest, read `.contextdx/boards/<board-slug>.json` and report:
- Project name
- Tech stacks detected
- Node counts by archetype
- Edge counts by type
- Whether this is a child board (and if so, which parent board/node)

### Step 4: Sync Status

For each board, check `.contextdx/boards/stores/<board-slug>.store.json` for sync metadata:
- Last sync timestamp
- Sync status (success/failed)
- Nodes synced (created/updated/unchanged)
- Edges synced (created/updated/unchanged)

If never synced, suggest running `/sync`.

### Step 5: Changed Files Since Last Analysis

For each board, read the `analyzedAtCommit` hash from `.contextdx/boards/<board-slug>.json` metadata.

If `analyzedAtCommit` exists:
1. Run `git diff --name-only --diff-filter=ACMR <analyzedAtCommit> HEAD` to find changed/added files since last analysis (includes both committed and uncommitted changes)
2. Filter to relevant source files (exclude `node_modules/`, `dist/`, `.git/`, `coverage/`, test files)
3. Report count and list of changed files
4. If no changes, report "Up to date"

If `analyzedAtCommit` is missing (old board data), suggest running `/analyze --clean`.

## Output Format

Display status in organized sections:

```
## Configuration
Base URL: https://api.contextdx.com
Branch: main

## Archetypes
Catalogue: 18 archetypes available (last fetched 2026-05-13)
Last scan: commit a1b2c3d on 2026-05-12
Pending proposals: 3 submitted on 2026-05-12 (awaiting approval)
  - 8f3a91…  http_service
  - 1c4d77…  worker_service
  - 5e7b22…  lambda_function
Action: re-run /analyze-archetypes after admin approval, then /analyze --clean

## Boards (2)

### my-project-overview (L0 Overview)
Last analyzed: 2025-01-25 10:30:00
Tech stacks: Next.js, NestJS

Nodes:
  - Services: 12
  - APIs: 8
  - Database: 5
  - Components: 15
  Total: 40

Edges:
  - imports: 52
  - db_read: 12
  - api_call: 6
  Total: 70

Sync: success (2025-01-25 10:35:00)

### user-domain (L1 Domain)
Last analyzed: 2025-01-25 10:32:00
Parent: my-project-overview / user-service-node

Nodes: 15 | Edges: 22
Sync: success (2025-01-25 10:36:00)

Changed since analysis: 0 files
```

## Missing Components

If any component is missing, provide clear next steps:
- No configuration -> Run `/login` (browser) or `/configure` (manual)
- Credentials rejected (`errorType: "auth_invalid"`) -> Run `/login` to reconnect
- No archetype precondition -> Run `/analyze-archetypes`
- No analysis -> Run `/analyze`
- Not synced -> Run `/sync`
