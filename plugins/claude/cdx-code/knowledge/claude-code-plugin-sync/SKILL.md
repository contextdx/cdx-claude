---
name: claude-code-plugin-sync
description: Bundled Node.js CLI scripts for syncing codebase analysis to the ContextDX Claude Code Plugin API. Provides cdx-sync.js for smart diff-based sync, cdx-archetypes.js for server archetype caching, and cdx-boards.js for board management. Self-contained — no npm install required.
user-invokable: false
metadata:
  author: ContextDx
  version: 0.2.0
---

# ContextDX Sync Scripts (Code)

This skill provides bundled Node.js scripts for syncing codebase architecture analysis data to the ContextDX Claude Code Plugin API. These scripts are self-contained — no npm install required.

## Available Scripts

### cdx-sync.js — Sync Analysis Data

Transforms codebase analysis (`.contextdx/boards/<board-slug>.json`) into ContextDX format and pushes to the API.

**Invocation:**
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-sync.js [options]
```

**Options:**
| Flag | Default | Description |
|---|---|---|
| `--config <path>` | `.contextdx/config.json` | Config file path |
| `--analysis <path>` | `.contextdx/boards/<board-slug>.json` | Analysis file path |
| `--board-slug <slug>` | (required) | Board slug for this sync |
| `--mode <mode>` | `merge` | Push mode: `merge` or `replace` |
| `--dry-run` | - | Validate and transform only, don't push |
| `--smart-sync` | - | Enable diff-based sync (recommended) |
| `--force-pull` | - | Force refresh of server elements before diff |
| `--force-push` | - | Push all elements regardless of diff |
| `--store-file <name>` | `.contextdx/boards/stores/<board-slug>.store.json` | Store file name |
| `--cache-file <name>` | `.contextdx/boards/archetypes-cache.json` | Archetype cache file name |

**Output:** JSON to stdout with fields: `success`, `nodeCount`, `edgeCount`, `pushResult`, `diff`, `timing`

**Exit codes:** 0=success, 1=config error, 2=analysis file error, 3=validation error, 4=API error

### cdx-archetypes.js — Fetch Archetypes

Fetches available archetypes from the Claude Code Plugin API with TTL-based caching.

**Invocation:**
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-archetypes.js [options]
```

**Options:**
| Flag | Default | Description |
|---|---|---|
| `--config <path>` | `.contextdx/config.json` | Config file path |
| `--cache-file <name>` | `.contextdx/boards/archetypes-cache.json` | Cache file name |
| `--no-cache` | - | Bypass cache, always fetch from server |

**Output:** JSON with `archetypes`, `nodeArchetypes`, `edgeArchetypes`, `mappingValidation`

### cdx-boards.js — Manage Boards

Fetches boards from the server and optionally ensures child boards exist before syncing.

**Invocation:**
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-boards.js [options]
```

**Options:**
| Flag | Default | Description |
|---|---|---|
| `--config <path>` | `.contextdx/config.json` | Config file path |
| `--ensure-boards <path>` | - | Manifest path — create missing child boards |

**Mode 1 — Fetch boards** (no `--ensure-boards`):
Calls `GET /code-plugin/boards` and outputs the full board list as JSON with `boards`, `rootBoard`, `childBoards`, and `boardCount`.

**Mode 2 — Ensure boards** (`--ensure-boards <manifest>`):
Reads the local manifest, fetches server boards, computes missing child boards, and calls `POST /code-plugin/boards` to create them. Outputs JSON with `created`, `existing`, and `errors`.

**Exit codes:** 0=success, 1=config error, 2=API error

## Configuration Source

Scripts read configuration from `.contextdx/config.json`.

## Store Files

Sync state is stored per-board in `.contextdx/boards/stores/<board-slug>.store.json`. Each board has its own isolated store tracking element hashes and sync status.

## References

- [transformation-rules.md](references/transformation-rules.md) — Code archetype mapping table
- [sync-protocol.md](references/sync-protocol.md) — Sync workflow documentation
