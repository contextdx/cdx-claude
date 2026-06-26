# Knowledge Board Layer Strategy

## Overview

Large knowledge sets are analyzed progressively using layered boards. Each board represents a scope of the corpus at appropriate granularity — from a 10-30 node overview down to a single document's internal structure.

## Board Root and Subject Grouping (All Layers)

The board itself is always the root container. Do not create a single all-encompassing `domain_group` that wraps every node. However, **multiple subject `domain_group` nodes for logical grouping ARE expected**.

**DON'T** — one wrapper around everything: `{ "slug": "handbook", "type": "domain_group" }` with all nodes as children.
**DON'T** — everything flat with no grouping at all.
**DO** — create subject groups based on natural boundaries (e.g., "Security", "Billing & Revenue", "Onboarding") sitting directly on the board (no `parentSlug`), with documents/concepts nested inside via `parentSlug`.

See `references/document-patterns.md` → "Subject Grouping" for full Do/Don't examples.

## Container vs. Drill-down Nodes (Critical — All Layers)

**A node must NEVER be both a container (with visible children) AND a drill-down target (with `layerBoardSlug`).**

- **Drill-down node** (`layerBoardSlug` set): Opaque — no other node on this board has `parentSlug` pointing to it. Its internals live on the child board.
- **Container node** (other nodes have `parentSlug` pointing to it): Groups visible children on the current board. Must NOT have `layerBoardSlug`.

If you need both grouping AND drill-down for a subject area, choose drill-down. The child board can use its own containers for internal grouping.

### Why this matters

When a `domain_group` container has visible children AND drills down, the documents appear on both the parent board and the child board — duplicating nodes across layers.

### Grouping threshold

Use `domain_group` containers when a board has **more than ~8 nodes**. This applies to any layer — L0, L1, L2, or L3. Below ~8 nodes, flat layout is acceptable.

## Layer Definitions

### L0 — Corpus Overview

- **Scope**: Entire knowledge set
- **Target**: 10-30 nodes
- **Node types**: Major subject areas (as opaque drill-down nodes), keystone documents, cross-cutting `Concept`s, top-level `Policy`s. Use `domain_group` containers only for small clusters that won't drill down (e.g., a couple of reference glossaries).
- **When**: Default analysis, first run

### L1 — Subject Drill-down

- **Scope**: A single subject area / document collection
- **Target**: 10-40 nodes per board
- **Node types**: `Document`s, `Decision`s, `Policy`s, `Process`es, `Concept`s within the subject; a `Glossary` container for its terms
- **Grouping**: Organize nodes into `domain_group` containers by genre (Specs, Decisions, Runbooks) or sub-topic when the board exceeds ~8 nodes. If an L1 node drills to L2, it must be opaque.
- **When**: User drills into an L0 subject node

### L2 — Document Drill-down

- **Scope**: A single document or spec
- **Target**: 5-20 nodes per board
- **Node types**: `Section`s, the `Requirement`s/`Decision`s it contains, the `Term`s it defines
- **Grouping**: Use `domain_group` containers if the board exceeds ~8 nodes; flat is fine below that
- **When**: User drills into an L1 document node

### L3 — Detail (opt-in)

- **Scope**: Deep internals of a single section or decision
- **Target**: 5-15 nodes
- **Node types**: Sub-points, acceptance criteria, prerequisites, the precise statements
- **When**: User explicitly requests deep analysis

## File Organization

```
.contextdx/boards/
  manifest.json                                   # Master index of all boards
  handbook-overview.json                          # L0 analysis
  handbook-overview--security-domain.json         # L1 analysis
  handbook-overview--security-domain--auth-spec.json  # L2 analysis
  stores/
    handbook-overview.store.json                  # L0 sync state
    handbook-overview--security-domain.store.json # L1 sync state
```

## Drill-Down Candidates

A node is a good drill-down candidate when:

1. It is a subject area with 5+ documents
2. It is a large document/spec with many sections, requirements, or decisions
3. It is a `Concept` elaborated across many decisions/requirements that the current layer flattens

Mark candidates by:

- Setting `layerBoardSlug` on the node
- Adding the node slug to `drillDownNodes` in the analysis output

## Board Slug Resolution

Board slugs are resolved from the server whenever possible:

1. **L0 (root board)**: Read from config `boardSlug` field (set during `/configure`). This is the root board created in the ContextDX UI.
2. **L1+ (child boards)**: Check the server board map (fetched via `cdx-boards.js`):
   - If a child board exists on the server for this parent board + parent node → use the server's slug
   - If no match → generate locally as `<parent-slug>--<node-slug>` (will be created on the server during `/sync`)

### Slug Format for Locally Generated Slugs

```
<parent-board-slug>--<node-slug>
```

Examples:

- L0: `handbook-overview` (from server/config — not generated locally)
- L1: `handbook-overview--security-domain`, `handbook-overview--billing-domain`
- L2: `handbook-overview--security-domain--auth-spec`

## Incremental Re-Analysis

Documents are often un-versioned (shared wikis, exported drives), so change detection uses a **content digest** rather than only git:

1. On first analysis, store `analyzedAtCommit` = a digest of the document set (hash of file paths + per-file content hashes; or `git rev-parse HEAD` when the docs are git-tracked).
2. On re-analysis, recompute the digest and diff against the stored one:
   - **Changed/added documents**: per-file content hash differs, or the file is new.
   - **Removed documents**: a tracked source path no longer exists.
3. Re-analyze only changed documents; replace their nodes; drop nodes/edges for removed documents; re-link changed nodes.
4. Update `analyzedAtCommit` to the new digest.

If `analyzedAtCommit` is missing (old board data), fall back to a full re-analysis.

## Manifest Structure

The manifest at `.contextdx/boards/manifest.json` tracks all boards:

```json
{
  "version": 2,
  "projectName": "handbook",
  "updatedAt": "ISO-timestamp",
  "boards": {
    "handbook-overview": {
      "boardSlug": "handbook-overview",
      "name": "Handbook Overview",
      "layer": 0,
      "parentBoardSlug": null,
      "parentNodeSlug": null,
      "analysisFile": ".contextdx/boards/handbook-overview.json",
      "storeFile": ".contextdx/boards/stores/handbook-overview.store.json",
      "lastAnalyzedAt": "ISO-timestamp",
      "lastSyncedAt": null,
      "nodeCount": 18,
      "edgeCount": 14
    }
  }
}
```

> **CRITICAL:** The board display name field is `name` (NOT `boardName`). The `--ensure-boards` CLI reads `name` to create missing child boards on the server.
