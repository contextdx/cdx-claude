---
name: insights
user-invokable: false
description: Bundled Node.js CLI scripts for fetching server-defined insight skills and pushing analysis results to the ContextDX Claude Code Plugin API. Provides cdx-insights.js for skill caching, insight persistence, and server push. Self-contained — no npm install required.
metadata:
  author: ContextDx
  version: 0.2.0
---

# ContextDX Insights Scripts (Code)

This skill provides bundled Node.js scripts for running server-defined insight analyses on codebase architecture boards. These scripts are self-contained — no npm install required.

## Available Scripts

### cdx-insights.js — Insight Skill & Results Manager

Fetches insight skills from the server, saves analysis results locally, and optionally pushes to the Claude Code Plugin API.

**Invocation:**
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-insights.js [mode] [options]
```

**Modes:**

| Mode | Arguments | Description |
|---|---|---|
| `--list-insight-skills` | `[--no-cache]` | Fetch available insight skills as JSON |
| `--get-insight-skill <slug>` | _(none)_ | Fetch full skill by slug (instructions + references) |
| `--save-insight <path>` | `[--push]` | Save insight payload from JSON file; optionally push to server |
| `--list-insights` | _(none)_ | List locally stored insight skill slugs |
| `--build-context` | `--board-slug <slug> [--out <path>] [--summary] [--demo]` | Build the deterministic context pack (board universe + keyed element/edge index) for a board |

**Common Options:**
| Flag | Default | Description |
|---|---|---|
| `--config <path>` | `.contextdx/config.json` | Config file path |
| `--cache-file <name>` | `insight-skills-cache.json` | Cache file name |
| `--no-cache` | - | Bypass cache, always fetch from server |
| `--push` | - | Attempt to push insight to server after saving |

**Output:** JSON to stdout with fields: `success`, `skills` or `storedInsights`, `featureAvailable`, `cacheStatus`

**Exit codes:** 0=success, 1=config error, 2=board data error (missing/empty/corrupt), 3=API/build error

## Configuration Source

Scripts read configuration from `.contextdx/config.json`.

## Local Storage

Insight results are stored per-skill at `.contextdx/boards/insights/<skill-slug>.json`. Skill metadata is cached at `.contextdx/boards/insight-skills-cache.json` with a 1-hour TTL. The deterministic context pack (`--build-context --out`) is written to `.contextdx/insights/context.json` and recomputed each run.

## References

- [execution-protocol.md](references/execution-protocol.md) — How to execute an InsightSkill
- [graph-context.md](references/graph-context.md) — How to extract board context for analysis
- [report-output-format.md](references/report-output-format.md) — Scope, ElementInsight, InsightPath, GraphSuggestion schemas
