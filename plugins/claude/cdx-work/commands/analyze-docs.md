---
category: map
description: "Map · Analyze a document/knowledge set into a layered knowledge board"
argument-hint: [--clean | --drill <parent-board-slug>/<node-slug> | --all]
allowed-tools: Read, Glob, Grep, Write, Bash(node:*), AskUserQuestion
---

Perform progressive knowledge analysis with layered board support.

This is the documents/knowledge analog of codebase analysis: it scans a document set (markdown, wikis, specs, RFCs, meeting notes, policies, design docs) and produces a graph of **knowledge nodes** (concepts, documents, sections, decisions, policies, processes, stakeholders, requirements, terms) and the **relationships** between them (references, cross-links, citations, depends-on, part-of, defines, supersedes, owned-by). The output is the same wire model the code plugin emits — only the analysis brain is different.

## Board Layer Strategy

Analysis produces layered boards for managing large knowledge sets:

| Layer | Name      | Scope                              | Target Nodes |
| ----- | --------- | ---------------------------------- | ------------ |
| L0    | Overview  | Entire knowledge base / doc corpus | 10-30        |
| L1    | Domain    | One subject area / doc collection  | 10-40 each   |
| L2    | Document  | One document or spec drill-down    | 5-20 each    |
| L3    | Detail    | Deep section/decision internals    | 5-15 each    |

All board data lives in `.contextdx/boards/`:

- `manifest.json` — tracks all boards and their relationships
- `<board-slug>.json` — analysis data per board
- `stores/<board-slug>.store.json` — sync state per board

## Analysis Modes

### Default: Incremental Analysis

```
/analyze-docs
```

**If board data already exists** (`.contextdx/boards/<board-slug>.json` with nodes/edges):

1. Read the existing board's `analyzedAtCommit` from metadata. For a knowledge set this is a **content digest** of the analyzed doc files (or a date stamp), not necessarily a git commit — documents are often un-versioned wikis, exports, or shared drives.
2. Recompute the digest of the current document set (hash of file paths + mtimes + sizes, or the union of per-file content hashes). Compare against the stored `analyzedAtCommit`.
   - If the doc set lives in a git repo, you may instead use `git diff --name-only <analyzedAtCommit> HEAD` filtered to document extensions.
3. Determine the change set:
   - **Added/changed docs**: files whose content hash differs from the store, or that are new since the last digest.
   - **Removed docs**: tracked source paths that no longer exist on disk.
4. If no changes detected, report "Board is up to date — no documents changed since last analysis" and skip.
5. If changes found:
   a. Load existing board data (nodes + edges)
   b. Re-analyze ONLY the changed/added documents (Steps 3-6 scoped to those files)
   c. Merge results: replace nodes whose `path` source document matches a changed file, add new nodes
   d. Remove nodes whose `path` document was deleted
   e. Remove edges where source or target node was removed
   f. Re-run knowledge-linking for changed nodes (Step 6)
   g. Write merged result to board JSON with updated `analyzedAt` and `analyzedAtCommit` (the new digest)
   h. Update manifest

**If no board data exists** (fresh knowledge base): run full analysis (Steps 0-9).

**If `analyzedAtCommit` is missing** (old board data without digest tracking): fall back to full analysis.

### Clean: Full Re-Analysis

```
/analyze-docs --clean
```

Ignores existing board data. Deletes the board's JSON and store file, then runs full analysis from scratch (Steps 0-9). Use when the knowledge set has been restructured significantly or the incremental result looks stale.

### Drill-Down: Create Child Board

```
/analyze-docs --drill <parent-board-slug>/<node-slug>
```

Creates a child board by drilling into a specific node from a parent board — for example, drilling into a `Document` node to expose its sections, or into a `Concept` node to expose the decisions and requirements that elaborate it. The node must exist in the parent's analysis data. Incremental mode applies to drill-down boards too — if the child board already exists, only changed documents within its scope are re-analyzed.

### Full Progressive: All Layers

```
/analyze-docs --all
```

Runs L0 first, then prompts for review before creating L1 boards for each drill-down node. Repeats for L2 if applicable. Each board uses incremental mode if it already exists.

## Analysis Workflow

### Step -1: Archetype precondition check

`/analyze-docs` operates as Phase 2 of the two-phase workflow. Phase 1 (`/analyze-archetypes`) settles the archetype catalogue first so every node gets a fit archetype rather than a misfit. The precondition is **enforced by a script, not by prose** — you must run it and react to its exit code; do not decide on your own whether Phase 1 has been satisfied.

1. Run the precondition script:

   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-precondition.js --kind knowledge
   ```

2. Parse the JSON output. The `status` field + exit code drive behaviour:

   | status            | exit | requiresPrompt | action                                                                                                       |
   | ----------------- | ---- | -------------- | ------------------------------------------------------------------------------------------------------------ |
   | `ok`              | 0    | false          | Proceed silently to Step 0.                                                                                   |
   | `pending`         | 0    | false          | Print the `reason` from the JSON as a warning, then proceed.                                                  |
   | `no_config`       | 0    | false          | ContextDX not configured — precondition is moot. Proceed.                                                     |
   | `missing`         | 10   | true           | Lock file does not exist. Prompt the user (see step 3).                                                       |
   | `stale_commit`    | 10   | true           | Document set has changed since the last archetype scan. Prompt (see step 3).                                  |
   | `stale_catalogue` | 10   | true           | Server catalogue has changed since the last scan. Prompt (see step 3).                                       |
   | `skipped`         | 10   | true           | Last run was skipped — **skip is one-shot, this re-prompts on every `/analyze-docs`**. Prompt (see step 3).  |

   On exit code `1` (config error — including a **branch mismatch**, where the current git branch differs from the binding's pinned branch) or `2` (API error): print the script's `error` field verbatim and stop — do not silently fall back. The user can fix config, switch branches, or re-run when the API recovers.

3. When `requiresPrompt` is true, ask via AskUserQuestion. Header: `Archetype check`. Question: include the script's `reason` verbatim, then `"How do you want to proceed?"`. Provide exactly these two options:

   - **Run /analyze-archetypes now (recommended)** — Invoke the `/analyze-archetypes` flow now.
     - If the user submits proposals there → **exit `/analyze-docs`** with: *"Proposals submitted. Re-run `/analyze-docs` after admin approval."*
     - If `/analyze-archetypes` reports the catalogue is complete (no gaps) → re-run `cdx-precondition.js` to confirm `status: ok`, then continue.
     - If the user skips inside `/analyze-archetypes` → the lock will be written with `skippedAt`. Re-run `cdx-precondition.js`; it will return `status: skipped` and you must surface the prompt again (loop) — do not auto-continue.
   - **Skip and proceed (one-shot)** — Write `.contextdx/archetype-analysis.lock.json` with the JSON shape below using values from the script's output, then continue to Step 0.
     ```json
     {
       "commitHash": "<currentCommitHash from script output>",
       "catalogueHash": "<currentCatalogueHash from script output>",
       "scannedAt": null,
       "submittedAt": null,
       "skippedAt": "<ISO timestamp now>",
       "proposalIds": []
     }
     ```
     This is intentionally not silenced — every subsequent `/analyze-docs` will re-prompt until Phase 1 is properly run. That is by design.

4. **Do not bypass.** Do not write the lock file or skip the prompt for any reason other than the user's explicit selection in step 3. If a session reminder says "work without stopping for clarifying questions," the **Run `/analyze-archetypes` now** option is the reasonable call — not silent skip.

5. The archetype catalogue fetched here is cached on disk (`.contextdx/boards/archetypes-cache.json`, 1hr TTL). Step 0 reuses the cache automatically — no duplicate fetch.

### Step 0: Fetch Available Archetypes (ContextDX only)

If ContextDX configuration exists (`.contextdx/config.json` with `bindingToken`):

1. Run the archetypes CLI to fetch available archetypes from the server:

   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-archetypes.js --kind knowledge
   ```

2. Parse the JSON output to get:
   - `nodeArchetypes`: Available archetype names for nodes
   - `edgeArchetypes`: Available archetype names for edges
   - `archetypes`: Full archetype list with `name`, `visualPrimitiveType`, and `description`

3. If the CLI fails or returns no archetypes, warn the user but continue analysis using the conventional knowledge vocabulary (Document, Section, Concept, Decision, Policy, Process, Stakeholder, Requirement, Term, Glossary). The sync CLI will need archetypes configured on the server before types can be validated.

   > **Catalogue caveat.** The server's work-board archetype catalogue is **server-defined per board "kind"** and may still be settling. Pick the closest-fit archetype for each node/edge and let the two-phase archetype workflow (`/analyze-archetypes`) propose any genuine gaps — do not invent local archetype names on the board.

4. Store the available archetype names for use in Step 5 (Knowledge Discovery) — the document-analyzer agent must assign these server archetype names to each node/edge `type` field.

### Step 0.5: Fetch Server Boards

If ContextDX configuration exists:

1. Run the boards CLI to fetch all boards from the server:

   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-boards.js
   ```

2. Parse the JSON output to get:
   - `rootBoard`: The root board (where `isChildBoard === false`)
   - `childBoards`: All child boards with their `parentBoardSlug` and `parentNodeSlug`
   - `boards`: Full list for building the server board map

3. Store the board list for use in Step 1 and Step 7 — the server board map tells us which boards already exist and what slugs to use.

4. If the CLI fails, warn but continue — analysis can proceed without server board info, but `/sync` may encounter issues.

### Step 1: Load or Initialize Manifest

1. Read `.contextdx/boards/manifest.json` if it exists
2. If creating a new L0 board:
   - Read `boardSlug` from config (`.contextdx/config.json` → `boardSlug` field)
   - If config has no `boardSlug`, make the **connect-now offer** — ask with **AskUserQuestion** "Connect to ContextDX now?" (**Connect now** / **Not now**):
     - **Connect now** → run the browser login here, printing each JSON `display` verbatim: `node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-login.js --start`, then `node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-login.js --poll --analyze-cmd analyze-docs` (generous Bash timeout, e.g. 250s). On `status: "complete"`, continue; anything else — stop, the display explains.
     - **Not now** → stop: "ContextDX not configured — run `/login` (browser) or `/configure` (manual) first"
   - Use the config `boardSlug` as the L0 board slug (this is the root board on the server)
3. If drilling down, validate that:
   - The parent board exists in the manifest
   - The target node exists in the parent's analysis data
   - Check if a matching child board already exists on the server (from Step 0.5 board list)
   - If found on server → use the server's board slug
   - If not found → generate a child `boardSlug` locally (e.g., `<parent-slug>--<node-slug>`)
4. Check if board data already exists at `.contextdx/boards/<board-slug>.json` — if so, load it for incremental mode

### Step 1.5: Change Detection (Incremental Mode)

If board data exists AND `--clean` was NOT passed AND `analyzedAtCommit` (the doc-set digest) is present in metadata:

1. Recompute the digest of the current document set (see Default mode above). For git-tracked docs, optionally use `git diff --name-only <analyzedAtCommit> HEAD` filtered to document extensions.
2. Determine added/changed documents (content hash differs or new file) and removed documents (tracked source path gone).
3. Filter to relevant document files (see Step 3 for the format list; exclude `node_modules/`, build output, asset binaries, and `.git/`).
4. If no changes: report "Board is up to date" and stop here
5. If changes found: continue to Steps 2+ but scope analysis to changed documents only

If `--clean` was passed: delete existing board JSON and store file, proceed with full analysis.

### Step 2: Configuration Check

Read settings from `.contextdx/config.json` if it exists to get portal configuration and analysis preferences (e.g. `includeSourceReferences`, `excludePaths`, `docRoots`).

### Step 3: Document-Set Detection

Identify the shape of the knowledge set:

1. Discover document roots — common locations are `docs/`, `wiki/`, `rfcs/`, `adr/`, `specs/`, `policies/`, `notes/`, and the repo root `README`/`*.md` files. Honour any `docRoots` in config.
2. Glob for document files by extension: `.md`, `.mdx`, `.markdown`, `.rst`, `.txt`, `.adoc`/`.asciidoc`, exported wiki pages, and `.pdf` (read text where extractable). Skip generated output, vendored docs, and changelogs unless they carry decisions.
3. Detect collection boundaries: a `docs/` tree with subfolders per subject area, an ADR/RFC directory, per-team wiki spaces, or a single flat folder. These boundaries become the L1 domains.

**Incremental:** This step runs unchanged — the document-set shape is always detected fresh.

### Step 4: Corpus Profiling

For each document collection:

1. Read front-matter and headings to learn each document's title, owner, status, and date where present (YAML front-matter, `# Title`, `Owner:`/`Status:` lines, ADR `Status:` fields).
2. Identify the dominant document genres present — specs, RFCs/ADRs, runbooks, policies, meeting notes, glossaries, design docs — so the analyzer can apply genre-appropriate node extraction.
3. Create collection-level parent nodes (one `domain_group` per subject area / doc collection) when the board will exceed ~8 nodes.

**Incremental:** This step runs unchanged — corpus profiling is lightweight and always runs.

### Step 5: Knowledge Discovery

**CRITICAL — No root wrapper nodes.** The board itself is the implicit root container. Do NOT create a single `domain_group` or wrapper node that contains all other nodes. Top-level nodes (subject areas, key documents, cross-cutting concepts) must have **no `parentSlug`** — they sit directly on the board. Use `metadata.description` for corpus-level context instead of a wrapper node.

Delegate the bulk of this step to the **document-analyzer** agent, which classifies the document set into nodes and applies the heuristics in [`${CLAUDE_PLUGIN_ROOT}/knowledge/document-analysis/SKILL.md`](../knowledge/document-analysis/SKILL.md) and [`${CLAUDE_PLUGIN_ROOT}/knowledge/concept-extraction/SKILL.md`](../knowledge/concept-extraction/SKILL.md).

**For L0 (Overview):** Identify the major subject areas, the keystone documents, and the cross-cutting concepts. Keep to 10-30 nodes. Mark nodes that are good candidates for drill-down by setting `layerBoardSlug` to a proposed slug.

**For L1+ (Drill-down):** Scope analysis to the documents/sections covered by the parent node. Go deeper into that subject area's documents, sections, decisions, and terms.

**Container vs. drill-down (all layers):** Nodes with `layerBoardSlug` must NOT be `domain_group` containers with visible children. Their internals belong on the child board. Use `domain_group` containers only for grouping nodes that won't drill down. Use domain groups when the board has more than ~8 nodes.

**Incremental:** Only read and analyze the changed/added documents from Step 1.5. Keep existing nodes from unchanged documents as-is. For deleted documents, mark their nodes for removal.

Apply these rules (see the document-analysis SKILL for full detail):

- **Exclude non-knowledge files**: auto-generated tables of contents, changelogs without decisions, link-only stub pages, license/boilerplate files, asset captions.
- **Group glossary terms**: bundle a glossary's individual term entries into a single `Glossary` container at L0/L1; expose individual `Term` nodes only when drilling into the glossary at L2/L3.
- **Detect subject boundaries**: one `domain_group` per subject area / doc collection when applicable at this layer.
- **Classify by archetype**: using server archetype names (Document, Section, Concept, Decision, Policy, Process, Stakeholder, Requirement, Term, …).
- **Generate slugs**: kebab-case from the document title or concept name.

### Step 6: Knowledge Linking

Delegate to the **knowledge-linker** agent to build edges scoped to this board's nodes only. It parses links, anchors, citations, and prose to detect:

- `references` / `cites`: a doc or section links to / quotes another (Markdown links, `[[wikilinks]]`, footnote citations, "see also")
- `part-of`: a section belongs to a document, a document to a collection
- `defines`: a glossary/section establishes the canonical meaning of a concept or term
- `depends-on`: a requirement/process relies on a prerequisite concept, policy, or decision
- `supersedes`: a newer decision/RFC replaces an older one (ADR "Superseded by", version bumps)
- `owned-by`: a document/policy/process is owned by a stakeholder or team

**Incremental:** Re-detect relationships for changed nodes. Remove edges where source or target node was removed. Keep edges between unchanged nodes as-is.

### Step 7: Identify Drill-Down Candidates

For nodes that represent substantial subsystems of knowledge (a subject area with many documents, a large spec with many sections, a concept elaborated across many decisions), mark them as drill-down candidates:

- Set `layerBoardSlug` on the node — resolve using the server board map from Step 0.5:
  - Check if a child board already exists on the server for this parent board + node slug
  - If found → use the server's existing board slug for `layerBoardSlug`
  - If not found → generate a slug locally (e.g., `<parent-slug>--<node-slug>`). It will be created on the server during `/sync`.
- Add the node slug to the `drillDownNodes` array

This tells the user which nodes can be expanded into child boards.

**Validate mutual exclusion:** No drill-down candidate node should have other nodes referencing it via `parentSlug`. If a node was initially created as a container with children but is now marked for drill-down, promote its children to board root level or move them under a different container — the children belong on the drill-down board, not on this board.

### Step 8: Output Generation

Write analysis results to `.contextdx/boards/<board-slug>.json`.

**Incremental:** Merge new/changed nodes into existing board data. Replace nodes whose source `path` matches a changed document. Remove nodes whose source document was deleted. Remove edges referencing removed nodes.

Always record the current document-set digest as `analyzedAtCommit` (for git-tracked docs, the output of `git rev-parse HEAD` is acceptable):

```json
{
  "metadata": {
    "analyzedAt": "ISO-timestamp",
    "analyzedAtCommit": "docset-sha256-7f3a…",
    "projectName": "from config or doc-root name",
    "boardSlug": "engineering-handbook-overview",
    "layer": 0,
    "description": "Engineering handbook — onboarding, architecture decisions, and operational policies.",
    "detailedDescription": "## Engineering Handbook\n\n…"
  },
  "nodes": [
    {
      "slug": "auth-token-rotation",
      "name": "Auth Token Rotation",
      "type": "Decision",
      "description": "ADR-014 — rotate access tokens every 15 minutes.",
      "path": "docs/security/auth.md#token-rotation",
      "parentSlug": "security-domain",
      "layerBoardSlug": null,
      "metadata": { "docUrl": "https://wiki/…/auth", "docType": "ADR", "status": "accepted" }
    }
  ],
  "edges": [
    {
      "sourceSlug": "auth-token-rotation",
      "targetSlug": "session-management",
      "type": "depends-on",
      "detailedDescription": "Token rotation relies on the session-management concept for refresh semantics.",
      "metadata": { "anchor": "#refresh", "citation": "auth.md §3.2" }
    }
  ],
  "drillDownNodes": ["security-domain", "data-governance-domain"]
}
```

For child boards, include parent references:

```json
{
  "metadata": {
    "boardSlug": "engineering-handbook-security-domain",
    "layer": 1,
    "parentBoardSlug": "engineering-handbook-overview",
    "parentNodeSlug": "security-domain",
    ...
  }
}
```

### Step 9: Update Manifest

Update `.contextdx/boards/manifest.json` with the new/updated board entry. The manifest must conform to this exact structure:

```json
{
  "version": 2,
  "projectName": "engineering-handbook",
  "updatedAt": "ISO-timestamp",
  "boards": {
    "engineering-handbook-overview": {
      "boardSlug": "engineering-handbook-overview",
      "name": "Engineering Handbook Overview",
      "layer": 0,
      "parentBoardSlug": null,
      "parentNodeSlug": null,
      "analysisFile": ".contextdx/boards/engineering-handbook-overview.json",
      "storeFile": ".contextdx/boards/stores/engineering-handbook-overview.store.json",
      "lastAnalyzedAt": "ISO-timestamp",
      "lastSyncedAt": null,
      "nodeCount": 18,
      "edgeCount": 14
    }
  }
}
```

**CRITICAL:** The board display name field is `name` (NOT `boardName`). The `--ensure-boards` CLI reads `name` to create missing child boards on the server — using `boardName` will cause board creation to fail with an empty name.

## Target Path

If $ARGUMENTS is `--clean`, run full re-analysis from scratch (delete existing board data first).
If $ARGUMENTS starts with `--drill`, parse `<parent-board-slug>/<node-slug>` and drill into that node.
If $ARGUMENTS is `--all`, run full progressive analysis (each board uses incremental if it already exists).
Otherwise, run L0 overview analysis with incremental mode (or full if no board data exists).

## Output Format

Report summary after analysis:

- Analysis mode (incremental or full)
- If incremental: number of changed/added/removed documents analyzed
- Board slug and layer
- Number of document collections / subject areas detected
- Number of nodes by archetype (total, and how many new/updated/removed if incremental)
- Number of relationships by type
- Drill-down candidates identified
- Location of output file
- Suggest running `/sync` to push to ContextDX

When the analysis is written, tell the user to run `/sync` to push the knowledge board to ContextDX Portal, and `/insights` to run server-defined analyses against it.
