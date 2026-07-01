# Graph Context Extraction

This document describes how to extract context from the existing architecture board to inject into InsightSkill instructions.

> **Preferred path:** the context prepass (`cdx-insights.js --build-context`) precomputes all of this — the resolved board universe, the skill variables, the keyed element index, the edge adjacency, and a degree table — into one pack at `.contextdx/insights/<boardSlug>.context.json`. Consume the pack instead of doing the manual extraction below. What follows describes the underlying board shape and the **fallback** extraction for when the pack is unavailable.

## Board Data Location

Board analysis data is stored at `.contextdx/boards/<boardSlug>.json`. The board slug comes from the plugin config (`.contextdx/config.json` → `boardSlug` field).

## Board JSON Structure

```json
{
  "metadata": {
    "analyzedAt": "2026-02-24T10:00:00.000Z",
    "projectName": "my-project",
    "languages": ["typescript", "javascript"],
    "techStacks": ["nextjs", "nestjs", "postgresql"],
    "boardSlug": "my-project-overview",
    "layer": 0
  },
  "nodes": [
    {
      "slug": "auth-service",
      "name": "Auth Service",
      "type": "Service",
      "description": "Handles user authentication and JWT tokens",
      "path": "src/auth",
      "parentSlug": null
    }
  ],
  "edges": [
    {
      "sourceSlug": "api-gateway",
      "targetSlug": "auth-service",
      "type": "depends-on"
    }
  ]
}
```

## Skill Variables

InsightSkill instructions may contain `{{variable}}` placeholders. Extract values from the board data:

| Variable | Source | Example Value |
|---|---|---|
| `{{boardSlug}}` | `metadata.boardSlug` | `my-project-overview` |
| `{{techStacks}}` | `metadata.techStacks` joined by ", " | `nextjs, nestjs, postgresql` |
| `{{detectedLanguages}}` | `metadata.languages` joined by ", " | `typescript, javascript` |
| `{{nodeArchetypes}}` | Unique `type` values from `nodes[]` | `Service, Database, API, Component` |
| `{{focusNodes}}` | Formatted node list | See below |

### `{{focusNodes}}` Format

A markdown list of nodes with their slug, archetype, and description:

```
- auth-service (Service): Handles user authentication and JWT tokens
- api-gateway (API): REST API gateway with rate limiting
- user-db (Database): PostgreSQL user store
```

Build this from `nodes[]` — include `slug`, `type` (archetype), and `description` for each node.

## Reading Board Data

1. Check if `.contextdx/boards/<boardSlug>.json` exists
2. If missing, report "No board data found — run /analyze first" and stop
3. Parse the JSON and extract the skill variables above
4. Replace all `{{variable}}` placeholders in the skill's `instructions` text

## Multi-Board Context

The prepass already resolves the multi-board universe and emits `boards`/`elements`/`edges` keyed across all of them — consume `pack` and skip this walk. The steps below are the **fallback** when the pack is unavailable.

Insights can start at any layer board and paths can span across board boundaries. To enable cross-board analysis:

1. **Read the manifest** — `.contextdx/boards/manifest.json` lists all boards and their hierarchy (parent/child relationships, layer levels)
2. **Discover child boards** — nodes in the primary board may have a `layerBoardSlug` field pointing to a child board. Read each child board's data file at `.contextdx/boards/<layerBoardSlug>.json`
3. **Cross-board references via scope** — boards do not appear inline on findings/paths/suggestions. Instead, every board you touch gets one row in `insights.scope.boards` (with a short `alias`), and every element you cite gets one row in `insights.scope.elements` (with a short `key` plus the alias of its board). Findings, path steps, and suggestions then reference elements by `key` only. See [report-output-format.md](report-output-format.md#scope) for the full schema.
4. **Read sibling boards** — when the primary board is an L1 child, also read sibling L1 boards (other children of the same parent in the manifest). Use the manifest's parent-child relationships to identify all siblings.

### Primary Board Selection

See the Primary Board Selection section in [execution-protocol.md](../execution-protocol.md) for selection criteria. Store the result as `{{primaryBoardSlug}}` — this goes in the top-level `boardSlug` of the push command. All other boards your analysis covers get registered in `scope.boards`. The CLI injects `rootBoardSlug` automatically from config; do not include it in the payload.
