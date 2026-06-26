# Board Layer Strategy Reference

## Overview

Large codebases are analyzed progressively using layered boards. Each board represents a scope of analysis with appropriate granularity.

## Board Root and Domain Grouping (All Layers)

The board itself is always the root container. Do not create a single all-encompassing domain_group that wraps every other node. However, **multiple domain_group nodes for logical grouping ARE expected**.

**DON'T** — one wrapper around everything: `{ "slug": "my-project", "type": "domain_group" }` with all nodes as children.
**DON'T** — everything flat with no grouping at all.
**DO** — create domain groups based on natural boundaries (e.g., "Backend Services", "Frontend", "External Integrations") sitting directly on the board (no `parentSlug`), with child components nested inside via `parentSlug`.

See `references/archetype-rules.md` → "Board Root and Domain Grouping" for full Do/Don't examples.

## Container vs. Drill-down Nodes (Critical — All Layers)

**A node must NEVER be both a container (with visible children) AND a drill-down target (with `layerBoardSlug`).**

- **Drill-down node** (`layerBoardSlug` set): Opaque — no other node on this board has `parentSlug` pointing to it. Its internals live on the child board.
- **Container node** (other nodes have `parentSlug` pointing to it): Groups visible children on the current board. Must NOT have `layerBoardSlug`.

If you need both grouping AND drill-down for a subsystem, choose drill-down. The child board can use its own containers for internal grouping.

### Why this matters

When a domain_group container has visible children AND drills down, the children appear on both the parent board and the child board — duplicating nodes across layers.

### Grouping threshold

Use `domain_group` containers to organize nodes when the board has **more than ~8 nodes**. This applies to any layer — L0, L1, L2, or L3. Below ~8 nodes, flat layout is acceptable.

## Layer Definitions

### L0 — Project Overview

- **Scope**: Entire project/monorepo
- **Target**: 10-30 nodes
- **Node types**: Major systems (as opaque drill-down nodes), shared infrastructure, external dependencies. Use domain_group containers only for small clusters that won't drill down.
- **When**: Default analysis, first run

### L1 — Domain Drill-down

- **Scope**: Single domain, workspace, or major service
- **Target**: 10-40 nodes per board
- **Node types**: Services, controllers, modules within the domain
- **Grouping**: Organize nodes into `domain_group` containers based on natural domain boundaries when the board exceeds ~8 nodes. Same container vs. drill-down rule applies — if an L1 node drills to L2, it must be opaque.
- **When**: User drills into an L0 node

### L2 — Component Drill-down

- **Scope**: Single service or module
- **Target**: 5-20 nodes per board
- **Node types**: Individual classes, handlers, internal modules
- **Grouping**: Use domain_group containers if the board exceeds ~8 nodes. For smaller boards, flat layout is fine.
- **When**: User drills into an L1 node

### L3 — Detail (opt-in)

- **Scope**: Deep internals of a single component
- **Target**: 5-15 nodes per board
- **Node types**: Methods, internal flows, data transformations
- **When**: User explicitly requests deep analysis

## File Organization

```
.contextdx/boards/
  manifest.json                      # Master index of all boards
  my-project-overview.json           # L0 analysis
  my-project-auth-domain.json        # L1 analysis
  my-project-auth-user-service.json  # L2 analysis
  stores/
    my-project-overview.store.json   # L0 sync state
    my-project-auth-domain.store.json # L1 sync state
```

## Drill-Down Candidates

A node is a good drill-down candidate when:

1. It represents a domain/service with 5+ internal source files
2. It contains sub-domains or distinct internal modules
3. The current layer's granularity hides important internal architecture

Mark candidates by:

- Setting `layerBoardSlug` on the node
- Adding the node slug to `drillDownNodes` in the analysis output

## Board Slug Resolution

Board slugs are resolved from the server whenever possible:

1. **L0 (root board)**: Read from config `boardSlug` field (set during `/configure`). This is the root board slug created in the ContextDx UI.
2. **L1+ (child boards)**: Check the server board map (fetched via `cdx-boards.js`):
   - If a child board exists on the server for this parent board + parent node → use the server's slug
   - If no match → generate locally as `<parent-slug>--<node-slug>` (will be created on the server during `/sync`)

### Slug Format for Locally Generated Slugs

```
<parent-board-slug>--<node-slug>
```

Examples:

- L0: `root` (from server/config — not generated locally)
- L1: `root--auth-domain`, `root--payments-domain`
- L2: `root--auth-domain--user-service`

## Manifest Structure

The manifest at `.contextdx/boards/manifest.json` tracks all boards:

```json
{
  "version": 2,
  "projectName": "my-app",
  "updatedAt": "ISO-timestamp",
  "boards": {
    "my-app-overview": {
      "boardSlug": "my-app-overview",
      "name": "My App Overview",
      "layer": 0,
      "parentBoardSlug": null,
      "parentNodeSlug": null,
      "analysisFile": ".contextdx/boards/my-app-overview.json",
      "storeFile": ".contextdx/boards/stores/my-app-overview.store.json",
      "lastAnalyzedAt": "ISO-timestamp",
      "lastSyncedAt": null,
      "nodeCount": 15,
      "edgeCount": 22
    }
  }
}
```
