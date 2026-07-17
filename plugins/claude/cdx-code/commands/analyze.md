---
category: map
description: "Map · Analyze codebase architecture with layered board support"
argument-hint: [--clean | --drill <parent-board-slug>/<node-slug> | --all]
allowed-tools: Read, Glob, Grep, Write, Bash(node:*, git:*), AskUserQuestion
---

Perform progressive architecture analysis with layered board support.

## Board Layer Strategy

Analysis produces layered boards for managing large codebases:

| Layer | Name      | Scope                       | Target Nodes |
| ----- | --------- | --------------------------- | ------------ |
| L0    | Overview  | Entire project              | 10-30        |
| L1    | Domain    | Domain/workspace drill-down | 10-40 each   |
| L2    | Component | Service/module drill-down   | 5-20 each    |
| L3    | Detail    | Deep internals (opt-in)     | 5-15 each    |

All board data lives in `.contextdx/boards/`:

- `manifest.json` — tracks all boards and their relationships
- `<board-slug>.json` — analysis data per board
- `stores/<board-slug>.store.json` — sync state per board

## Analysis Modes

### Default: Incremental Analysis

```
/analyze
```

**If board data already exists** (`.contextdx/boards/<board-slug>.json` with nodes/edges):

1. Read the existing board's `analyzedAtCommit` hash from metadata
2. Take the worklist from the Step -0.5 coverage ledger — stale nodes, pending files, orphaned references (Step 1.5 has the mechanics); git is used only to confirm deletions and as the ledger-failure fallback
3. If the worklist is empty, report "Board is up to date — nothing changed since last analysis" and skip
4. If changes found:
   a. Load existing board data (nodes + edges)
   b. Re-analyze ONLY the changed/added files (Steps 3-6 scoped to those files)
   c. Merge results: replace nodes whose `coveredFiles` contain a changed file, add new nodes
   d. Remove nodes all of whose `coveredFiles` (or whose `path`) match deleted files
   e. Remove edges where source or target node was removed
   f. Re-run relationship detection for changed nodes (Step 6)
   g. Write merged result to board JSON with updated `analyzedAt` and `analyzedAtCommit`
   h. Update manifest

**If no board data exists** (fresh project): run full analysis (Steps 0-9).

**If `analyzedAtCommit` is missing** (no commit anchor — incremental is impossible): fall back to full analysis.

### Clean: Full Re-Analysis

```
/analyze --clean
```

Ignores existing board data. Deletes the board's JSON and store file, then runs full analysis from scratch (Steps 0-9). Use when the codebase has changed significantly or the incremental result looks stale.

Combine with `--drill` to rebuild one child board from scratch: `/analyze --drill <parent-board-slug>/<node-slug> --clean` — this is the recovery path when the coverage dashboard marks a specific drill-down board `coverage: unknown`.

### Drill-Down: Create Child Board

```
/analyze --drill <parent-board-slug>/<node-slug>
```

Creates a child board by drilling into a specific node from a parent board. The node must exist in the parent's analysis data. Incremental mode applies to drill-down boards too — if the child board already exists, only changed files within its scope are re-analyzed.

### Full Progressive: All Layers

```
/analyze --all
```

Runs L0 first, then prompts for review before creating L1 boards for each drill-down node. Repeats for L2 if applicable. Each board uses incremental mode if it already exists.

When building several boards **in parallel** (subagents), give every intermediate/scratch file a board-slug prefix — parallel agents share one scratchpad directory and generic filenames silently clobber each other.

In `--all` mode the per-board review prompts above govern the middle of the run — run Step 8.6 (the next-area question) **once, after the final board**, not per board.

## Analysis Workflow

### Step -1: Archetype precondition check

`/analyze` operates as Phase 2 of the two-phase workflow. Phase 1 (`/analyze-archetypes`) settles the archetype catalogue first so every node gets a fit archetype rather than a misfit. The precondition is **enforced by a script, not by prose** — you must run it and react to its exit code; do not decide on your own whether Phase 1 has been satisfied.

1. Run the precondition script:

   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-precondition.js --kind code
   ```

2. Parse the JSON output. The `status` field + exit code drive behaviour:

   | status            | exit | requiresPrompt | action                                                                                                                                                       |
   | ----------------- | ---- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
   | `ok`              | 0    | false          | Proceed silently to Step 0.                                                                                                                                  |
   | `pending`         | 0    | false          | Print the `reason` from the JSON as a warning, then proceed.                                                                                                 |
   | `no_config`       | 0    | false          | ContextDX not configured — precondition is moot. Proceed.                                                                                             |
   | `missing`         | 10   | true           | Lock file does not exist. Prompt the user (see step 3).                                                                                                      |
   | `stale_commit`    | 10   | true           | Codebase has moved since the last archetype scan. Prompt (see step 3).                                                                                       |
   | `stale_catalogue` | 10   | true           | Server catalogue has changed since the last scan. Prompt (see step 3).                                                                                       |
   | `skipped`         | 10   | true           | Last run was skipped — **skip is one-shot, this re-prompts on every `/analyze`**. Prompt (see step 3).                                                       |

   On exit code `1` (config error — including a **branch mismatch**, where the current git branch differs from the binding's pinned branch) or `2` (API error): print the script's `error` field verbatim and stop — do not silently fall back. The user can fix config, switch branches, or re-run when the API recovers.

3. When `requiresPrompt` is true, ask via AskUserQuestion. Header: `Archetype check`. Question: include the script's `reason` verbatim, then `"How do you want to proceed?"`. Provide exactly these two options:

   - **Run /analyze-archetypes now (recommended)** — Invoke the `/analyze-archetypes` flow now.
     - If the user submits proposals there → **exit `/analyze`** with: *"Proposals submitted. Re-run `/analyze` after admin approval."*
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
     This is intentionally not silenced — every subsequent `/analyze` will re-prompt until Phase 1 is properly run. That is by design.

4. **Do not bypass.** Do not write the lock file or skip the prompt for any reason other than the user's explicit selection in step 3. If a session reminder says "work without stopping for clarifying questions," the **Run `/analyze-archetypes` now** option is the reasonable call — not silent skip.

5. The archetype catalogue fetched here is cached on disk (`.contextdx/boards/archetypes-cache.json`, 1hr TTL). Step 0 reuses the cache automatically — no duplicate fetch.

### Step -0.5: Coverage baseline (all modes)

Coverage is the run's frame of reference — refresh it BEFORE any analysis so the worklist comes from fresh data and the closing dashboard shows exactly what this run changed:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-prepass.js --coverage
```

Tell the user the starting point in one line from the JSON: `Coverage baseline: <percent>% analysed · <mappedOnly> mapped · <pending> pending · <staleNodes> stale.` If there are no boards yet: `No coverage yet — starting from zero.` If the script fails, say so and continue — coverage is reporting, never a gate. Step 1.5 takes its worklist from this ledger, and each Step 8.5 refresh shows the ▲/▼ delta since the previous refresh (this baseline on the first pass; the prior pass once Step 8.6 loops).

### Step 0: Fetch Available Archetypes (ContextDX only)

If ContextDX configuration exists (`.contextdx/config.json` with `bindingToken`):

1. Run the archetypes CLI to fetch available archetypes from the server:

   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-archetypes.js --kind code
   ```

2. Parse the JSON output to get:
   - `nodeArchetypes`: Available archetype names for nodes
   - `edgeArchetypes`: Available archetype names for edges
   - `archetypes`: Full archetype list with `name`, `visualPrimitiveType`, and `description`

3. If the CLI fails or returns no archetypes, warn the user but continue analysis using conventional archetype names (service, database, api, library, queue, external, domain_group, infrastructure, external_system). The sync CLI will need archetypes configured on the server before types can be validated.

4. Store the available archetype names for use in Step 5 (Component Discovery) — the analysis agent must assign these server archetype names to each node/edge `type` field

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
     - **Connect now** → run the browser login here, printing each JSON `display` verbatim **in your reply** (the Bash output panel is collapsed for the user): `node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-login.js --start`, then `node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-login.js --poll --analyze-cmd analyze` (generous Bash timeout, e.g. 250s). On `status: "complete"`, continue; anything else — stop, the display explains.
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

If board data exists AND `--clean` was NOT passed AND `analyzedAtCommit` is present in metadata:

1. Use the Step -0.5 ledger — it is fresh this run; do NOT re-run the coverage script. Read `.contextdx/coverage.json` and take this board's entry. The worklist is:
   - `boards[].staleNodes[]` — nodes whose covered files changed since analysis → re-analyze these nodes from their listed `changedFiles`
   - `pendingFiles[]` — files no node covers yet → new components to place
   - `boards[].orphanedFiles[]` — covered files that no longer exist → remove/shrink their nodes
2. Run `git diff --name-only --diff-filter=D <analyzedAtCommit> HEAD` to confirm deleted files
3. If the worklist is empty (no stale nodes, no pending files, nothing deleted): report "Board is up to date", print the Step -0.5 `display` markdown verbatim, and stop here
4. Otherwise: continue to Steps 2+ scoped to the worklist files only
5. **Fallback:** if the Step -0.5 script failed, scope from a raw `git diff --name-only --diff-filter=ACMR <analyzedAtCommit> HEAD` instead (exclude `node_modules/`, `dist/`, `.git/`, `coverage/`, test files). If the ledger marks this board `coverage: unknown` (its nodes carry no `coveredFiles`), incremental merge is impossible — stop and tell the user to run `/analyze --clean` for this board

If `--clean` was passed: delete existing board JSON and store file, proceed with full analysis.

### Step 2: Configuration Check

Read settings from `.contextdx/config.json` if it exists to get portal configuration and analysis preferences.

### Step 3: Project Detection

Identify project structure:

1. Read root `package.json` for project metadata
2. Detect monorepo configuration (workspaces, lerna.json, turbo.json, pnpm-workspace.yaml)
3. Identify workspace boundaries if monorepo

**Incremental:** This step runs unchanged — project structure is always detected fresh.

### Step 4: Tech Stack Detection

For each workspace/project:

1. Analyze `package.json` dependencies for framework indicators
2. Check for framework-specific config files
3. Create parent nodes for each detected tech stack

**Incremental:** This step runs unchanged — tech stack detection is lightweight and always runs.

### Step 4.5: Structural Prepass (deterministic skeleton)

Run the prepass CLI to get a deterministic structural skeleton — the candidate-node inventory and the resolved `imports` graph — so the analysis does not reconstruct them from raw file reads:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-prepass.js --out .contextdx/skeletons/repo.json --summary
```

For an L1+ drill-down board, scope the emitted nodes to the parent node's subtree (imports may still target files anywhere under the repo root), and write it under the board's own name so it never clobbers the repo-wide skeleton:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-prepass.js --scope-path <parent-node-path> --out .contextdx/skeletons/<board-slug>.json --summary
```

`--summary` prints counts to stdout; the full skeleton is written to the `--out` path (all skeletons live in `.contextdx/skeletons/`). Read that file. It contains:

- `nodes[]` — candidate source files (all languages), already excluding `*.d.ts`/types/dto/test/barrel files. Each has a repo-relative `path`, a `tempId` (= `path`), a suggested `slug`/`name`, and `language`. Nodes with an **`artifact`** field are **agent-native markdown artifacts** — prompt-ware components (`artifact.kind`: `skill` | `command` | `agent`) detected deterministically from YAML frontmatter; `artifact.description` carries the frontmatter description as seed context.
- `edges[]` — `{ fromTempId, toTempId, type, count }`. `type: "imports"` is the resolved graph for **JS/TS files only** (tsconfig path aliases and barrel re-exports already resolved, type-only imports dropped, duplicates collapsed, popular-helper hubs suppressed). `type: "references"` is deterministic artifact wiring — an artifact's body names another skeleton file by path (a command running a bundled script, a skill pointing at a doc).
- `stats` + `unresolvedSamples` — coverage numbers; a large `importsUnresolved` means some edges were missed and may need filling from file reads. `artifactNodes`/`referenceEdges` count the artifact layer.

**Use the skeleton in Steps 5–6:**

- Treat `nodes[]` as the ground-truth file inventory — do NOT re-glob or re-apply exclusion rules (already applied).
- Treat `edges[]` as the authoritative `imports` edges for JS/TS — do NOT re-parse JS/TS imports by hand. For **non-JS/TS** files, detect imports yourself in Step 6.
- The skeleton is **file-granular**. At **L2/L3** its nodes map ~1:1 to board nodes. At **L0/L1**, **aggregate** files into coarse domain/component nodes and **roll up** each file→file `imports` edge onto the coarse nodes (map each `tempId` to the slug of the node you fold it into; drop self-loops).
- **Persist the mapping — coverage provenance.** The tempId→node-slug rollup you just made IS the coverage relation; record it on every node as `coveredFiles` (repo-relative paths, or directory globs like `src/billing/**` when a node owns a whole subtree — prefer globs for large subtrees). Every skeleton file must end up in exactly one node's `coveredFiles`, OR in the board metadata's `waivedFiles` (files you judge non-architectural — never silently drop them), OR deliberately unclaimed (it will surface as *pending* in coverage reports). **Hard rules the coverage dashboard enforces/surfaces:** never claim the same file from two nodes (double claims are flagged as defects); a node claiming **≥30 files** must either set `layerBoardSlug` (drill-down candidate — its files count as *mapped, not analysed* until the child board analyses them) or be split into finer nodes (else it's flagged as a broad claim); waive **exact paths only, never globs** — waiving shrinks the denominator and the dashboard lists what was waived.
- The prepass does NOT classify archetypes, group the database layer, write descriptions, or detect non-import edges — those remain your job in Steps 5–6.

Run this on every analysis (full and incremental); it is deterministic and fast, and always reflects current HEAD.

### Step 5: Component Discovery

**CRITICAL — No root wrapper nodes.** The board itself is the implicit root container. Do NOT create a single `domain_group` or wrapper node that contains all other nodes. Top-level nodes (workspaces, services, data stores, external integrations) must have **no `parentSlug`** — they sit directly on the board. Use `metadata.description` for project-level context instead of a wrapper node.

**For L0 (Overview):** Identify high-level domains, services, and major components. Keep to 10-30 nodes. Mark nodes that are good candidates for drill-down by setting `layerBoardSlug` to a proposed slug.

**For L1+ (Drill-down):** Scope analysis to the files/directories covered by the parent node. Go deeper into that domain's internal components.

**Container vs. drill-down (all layers):** Nodes with `layerBoardSlug` must NOT be `domain_group` containers with visible children. Their internals belong on the child board. Use `domain_group` containers only for grouping nodes that won't drill down. Use domain groups when the board has more than ~8 nodes.

**Incremental:** Only read and analyze the changed/added files from Step 1.5. Keep existing nodes from unchanged files as-is. For deleted files, mark their nodes for removal.

Apply these rules (start from the skeleton's `nodes[]` — file discovery and exclusion are already done):

- **Exclude non-architectural files**: already applied in the skeleton (`*.d.ts`, types/dto, tests, barrels). Only re-check files you discover outside the skeleton (e.g. non-JS/TS).
- **Agent-native artifacts are components, not docs**: skeleton nodes with `artifact.kind` (skills/commands/agents) are first-class architecture — group them like any other component family (e.g. a commands group, a knowledge/skills group, per plugin or domain), seed their `description` from `artifact.description`, and classify them with a fitting server archetype. If the catalogue has no fit for prompt-ware kinds, that is an archetype **gap** — Phase 1 (`/analyze-archetypes`) should have proposed archetypes such as `agent_command`/`agent_skill`; fall back to the closest existing archetype meanwhile and never silently waive artifacts.
- **Group database files**: into a single `database-layer` container node at L0/L1 — the skeleton lists these as individual files, so you group them.
- **Detect domain boundaries**: if applicable at this layer
- **Classify by archetype**: using server archetype names — the skeleton does NOT classify, this is your job
- **Generate slugs**: use the skeleton's suggested `slug` as a starting point; refine from the primary class/export name

### Step 6: Relationship Detection

- **`imports` edges (JS/TS):** take these from the Step 4.5 skeleton's `edges[]` — do NOT re-parse JS/TS imports. Map each edge's `fromTempId`/`toTempId` (file paths) to the slug of the board node that file belongs to, then dedupe and drop self-loops. For non-JS/TS files, parse imports yourself.
- **`references` edges (artifacts):** map the skeleton's `type: "references"` edges the same way, emitting them as `uses` edges between the resulting board nodes (a command *uses* the script it runs, a skill *uses* the doc it loads). Add further artifact relationships you find by reading bodies (e.g. a command that says "load the X skill" without a path).
- **Semantic edges (read the relevant files):** the skeleton does not detect these — derive them by reading the files of the nodes involved:
  - `db_read`/`db_write`: Repository/ORM operations
  - `api_call`: HTTP client usage (external or cross-service)
  - `uses`: internal service-to-service calls
  - `publishes`/`subscribes`: Queue/event patterns
  - cross-language calls: API URLs / service names between services

Scope all edges to this board's nodes only.

**Incremental:** Re-detect relationships for changed nodes. Remove edges where source or target node was removed. Keep edges between unchanged nodes as-is.

### Step 7: Identify Drill-Down Candidates

For nodes that represent significant subsystems (domains, services with many internal components), mark them as drill-down candidates:

- Set `layerBoardSlug` on the node — resolve using the server board map from Step 0.5:
  - Check if a child board already exists on the server for this parent board + node slug
  - If found → use the server's existing board slug for `layerBoardSlug`
  - If not found → generate a slug locally (e.g., `<parent-slug>--<node-slug>`). It will be created on the server during `/sync`.
- Add the node slug to the `drillDownNodes` array

This tells the user which nodes can be expanded into child boards.

**Validate mutual exclusion:** No drill-down candidate node should have other nodes referencing it via `parentSlug`. If a node was initially created as a container with children but is now marked for drill-down, promote its children to board root level or move them under a different container — the children belong on the drill-down board, not on this board.

### Step 8: Output Generation

Write analysis results to `.contextdx/boards/<board-slug>.json`.

**Incremental:** Merge new/changed nodes into existing board data. Replace nodes whose `coveredFiles` contain a changed file. Remove nodes whose covered files were all deleted. Remove edges referencing removed nodes.

Always record the current git commit hash via `git rev-parse HEAD` as `analyzedAtCommit`. Every node carries `coveredFiles` and the metadata carries `waivedFiles` (from Step 4.5):

```json
{
  "metadata": {
    "analyzedAt": "ISO-timestamp",
    "analyzedAtCommit": "abc123def456",
    "projectName": "from-package.json",
    "languages": ["typescript"],
    "techStacks": ["nextjs", "nestjs"],
    "boardSlug": "my-project-overview",
    "layer": 0,
    "waivedFiles": ["scripts/dev-seed.ts"]
  },
  "nodes": [
    {
      "slug": "api-service",
      "name": "API Service",
      "type": "service",
      "description": "Handles HTTP requests",
      "path": "src/api",
      "coveredFiles": ["src/api/**"],
      "parentSlug": null,
      "layerBoardSlug": null,
      "metadata": {}
    }
  ],
  "edges": [
    {
      "sourceSlug": "api-service",
      "targetSlug": "database",
      "type": "db_read",
      "description": "Reads user data via repository pattern.",
      "metadata": {}
    }
  ],
  "drillDownNodes": ["auth-domain", "payments-domain"]
}
```

For child boards, include parent references:

```json
{
  "metadata": {
    "boardSlug": "my-project-auth-domain",
    "layer": 1,
    "parentBoardSlug": "my-project-overview",
    "parentNodeSlug": "auth-domain",
    ...
  }
}
```

### Step 8.5: Refresh Coverage Ledger + show the dashboard

After writing the board JSON, refresh the deterministic coverage ledger so `/status`, the next incremental run, and `/sync` (which reports coverage to the platform) all see current numbers:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-prepass.js --coverage
```

Print the returned `display` markdown **verbatim — do not reformat, reorder, or summarise** (it carries the progress bar, the delta since the previous run, and the ranked "Where to go next" list). If the script fails, note it and continue — coverage is reporting, never a gate (and skip Step 8.6).

### Step 8.6: Offer the next area (interactive loop)

The Step 8.5 JSON also carries `recommendations` — the deterministic next-step list, ranked: stale boards → drill-downs → pending areas → broad claims → unknown-coverage boards. The script owns those facts; **you own the coordination** — spend judgment connecting them to this session. Which area to analyse next is a genuine user decision:

1. If `recommendations` is empty: skip to Step 9.
2. **Give your read first** (1–3 sentences of judgment, after the verbatim dashboard): connect the recommendations to what you know — which stale node maps to the files just edited, whether a pending area looks load-bearing or like glue, what the user has been working on. Never restate or recompute the script's numbers.
3. Ask with **AskUserQuestion** — header `Next area`; question: `Coverage is at <percent>%. Analyse another area now, or sync what you have?` Options, in order:
   - The first 3 `recommendations`: label from `label` (append "(Recommended)" to the first), description from `detail` — you may append a short session-informed rationale to a description, and you may reorder these three when session context clearly changes the priority (say why in the description).
   - **Triage swap:** if an area's pending files are plainly non-architectural (generated code, fixtures, one-off scripts), replace the third slot with **Waive non-architectural files** — on selection, propose the exact `coverage.ignore` globs via AskUserQuestion (user adjusts via Other), append the confirmed globs to `coverage.ignore` in `.contextdx/config.json`, re-run `cdx-prepass.js --coverage`, print the new `display` verbatim, and re-ask.
   - Always last: **Sync what I have** — description: "Stop analysing; push the boards + this coverage snapshot to the platform."
4. If the user picks a recommendation, run another incremental pass scoped to it, then **return to Step 8.5** (refresh, dashboard, ask again — the loop ends when the user syncs or nothing is left):
   - `stale-board` → re-analyze that board's `staleNodes[].changedFiles` (Steps 5–8 scoped to those files)
   - `drill-down` → build (or re-run) the child board: the `--drill <boardSlug>/<nodeSlug>` flow for the recommendation's node — this is what converts *mapped* files into *analysed* ones
   - `pending-area` → analyze the pending files under its `path` (take them from the ledger's `pendingFiles`; if `pendingTotal` exceeds the listed files, derive the remainder from `.contextdx/skeletons/repo.json` minus covered/waived) and place the resulting nodes on the board that owns that scope (L0, or the matching drill-down board)
   - `broad-claim` → re-analyze that node's subtree, splitting it into finer nodes with their own `coveredFiles` — or set `layerBoardSlug` on it to defer honestly to a drill-down
   - `unknown-board` → re-run that board with the `--clean` behaviour (delete its JSON + store, full re-analysis)
5. If the user picks **Sync what I have**: proceed to Step 9 and end the final report with: `Run /sync to push the boards and this coverage snapshot.`

### Step 9: Update Manifest

Update `.contextdx/boards/manifest.json` with the new/updated board entry. The manifest must conform to this exact structure:

```json
{
  "version": 2,
  "projectName": "my-project",
  "updatedAt": "ISO-timestamp",
  "boards": {
    "my-project-overview": {
      "boardSlug": "my-project-overview",
      "name": "My Project Overview",
      "layer": 0,
      "parentBoardSlug": null,
      "parentNodeSlug": null,
      "analysisFile": ".contextdx/boards/my-project-overview.json",
      "storeFile": ".contextdx/boards/stores/my-project-overview.store.json",
      "lastAnalyzedAt": "ISO-timestamp",
      "lastSyncedAt": null,
      "nodeCount": 15,
      "edgeCount": 12
    }
  }
}
```

**CRITICAL:** The board display name field is `name` (NOT `boardName`). The `--ensure-boards` CLI reads `name` to create missing child boards on the server — using `boardName` will cause board creation to fail with an empty name.

## Target Path

If $ARGUMENTS is `--clean`, run full re-analysis from scratch (delete existing board data first).
If $ARGUMENTS starts with `--drill`, parse `<parent-board-slug>/<node-slug>` and drill into that node; a trailing `--clean` deletes that child board's JSON + store first.
If $ARGUMENTS is `--all`, run full progressive analysis (each board uses incremental if it already exists).
Otherwise, run L0 overview analysis with incremental mode (or full if no board data exists).

## Output Format

The report is **script-rendered — never hand-assemble counts into prose.** After Step 9, for each board written this run:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-prepass.js --board-report <board-slug>
```

Print its `display` **verbatim** (nodes-by-archetype bars, edges by type, per-board file accounting, isolated nodes, drill-down candidates, board file path). Then add ONLY what the script cannot know:

- Analysis mode (incremental or full); if incremental, the changed/added/deleted files analysed
- Judgment calls worth flagging — max 5 bullets (rule deviations, split/merge decisions, why isolated nodes are genuinely isolated vs missed edges)
- The **final** Step 8.5 coverage dashboard, verbatim (if Step 8.6 looped, one dashboard — the last — not one per pass)
- Which next-area choices the user made, if any passes looped

Never restate numbers the board report or coverage dashboard already shows.
