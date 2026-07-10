---
category: understand
description: "Understand · Run server-defined insight analysis on your architecture board"
argument-hint: [<prompt> | --select | --list | --all | <skill-slug>]
allowed-tools: Read, Glob, Grep, Write, Bash(node:*), AskUserQuestion
---

Run server-defined insight analysis skills against your architecture board. The server defines **what** to analyse and **how** — the plugin fetches these definitions at runtime and executes them.

## Workflow

### Step 0: Validate Prerequisites

Before doing anything else, validate that configuration and board data exist. Read the boardSlug from `.contextdx/config.json` (`boardSlug` field) — this is the **primary board** but insights can target any layer board. Also read `.contextdx/boards/manifest.json` (if it exists) to discover available layer boards for cross-board analysis. Then run:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-insights.js --list-insight-skills --board-slug <boardSlug>
```

Check the exit code and JSON output:
- **Exit code 1** → not configured — make the **connect-now offer** (see Error Handling)
- **Exit code 2** → stop and tell the user: "No board data found — run `/analyze` first to build your architecture graph"
- **Exit code 3** → stop and report the API error from the JSON `error` field. If the JSON `errorType` is `auth_invalid`, the credentials were rejected (revoked binding or rotated secret) — make the **connect-now offer** (see Error Handling).
- If `featureAvailable` is `false` → stop and tell the user: "No insight skills available for this account"
- If `skills` is empty → stop and tell the user: "No insight skills configured — contact your workspace admin"

**Do NOT proceed to skill execution if any check fails.**

On success, the output contains the `skills` array (precis — slug, name, category, description, duration only, no instructions or references) to use in the next steps.

### Step 1: Resolve Which Skills to Run

How skills are selected depends on `$ARGUMENTS`:

---

#### Mode A — Agent-inferred (natural-language prompt)

When `$ARGUMENTS` is a natural-language string (not a flag):

1. Read the `skills[]` precis from Step 0 — slug, name, description, and category
2. Semantically match the user's prompt to the skills that best fit the intent
3. Select one or more skills and explain the choice to the user (one sentence per skill, e.g. "Running **security-analysis** — matches your request to check for vulnerabilities")
4. Store the full prompt as `{{userPrompt}}` for use in Step 2

If no skills clearly match, list the available skills and ask the user to clarify or pick.

---

#### Mode B — User-selection (`--select` or no arguments)

When `$ARGUMENTS` is `--select` or empty:

1. Display the skills table:

   | Slug | Name | Category | Duration | Description |
   |---|---|---|---|---|
   | ... | ... | ... | ... | ... |

2. Ask the user both questions together:
   > "Which skill(s) would you like to run? Also describe your analysis focus (e.g., 'check auth service for security issues') — a focus prompt is required."

3. Do **not** proceed until the user provides both a skill selection and a focus prompt
4. Store the focus prompt as `{{userPrompt}}`

---

#### Legacy arguments (unchanged behaviour)

| Argument | Behaviour |
|---|---|
| `--list` | Print the skills table and stop — no execution |
| `--all` | Run all available skills; `{{userPrompt}}` is empty |
| `<skill-slug>` | Run only the named skill directly; `{{userPrompt}}` is empty |

---

### Step 1.5: Fetch Full Skill

After selecting which skill(s) to run, fetch the full skill data (instructions + references) for each:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-insights.js --get-insight-skill <skill-slug>
```

Check the exit code:
- **Exit code 1** → configuration error — make the **connect-now offer** (see Error Handling); stop if declined
- **Exit code 3** → skill not found or API error, skip this skill and report the error (if `errorType` is `auth_invalid`, credentials were rejected — make the **connect-now offer**)
- On success, the output contains the `skill` object with `instructions` and `references[]` to use in execution

For `--all`, fetch each skill's full data one at a time before executing it.

### Step 1.6: Build the deterministic context pack

Run the prepass once to get a precomputed **context pack** — the resolved board universe, per-board context variables, and a flattened element/edge index with **pre-assigned scope keys and board aliases**. Consuming it means you do **not** read every board JSON by hand or mint scope keys/aliases yourself, which is the main source of scope-validation failures on push.

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-insights.js --build-context --board-slug <boardSlug> --out .contextdx/insights/<boardSlug>.context.json --summary
```

- The summary prints to stdout; read the **full pack** from `.contextdx/insights/<boardSlug>.context.json`. This canonical path is where `--save-insight` looks for the oracle when it runs the quality gates (Step 2.11). If you switch the primary board later, rebuild the pack for that board too.
- **Exit 0** → use the pack for Steps 2 (context vars), 5 (scope), and 7 (paths) below.
- **Exit 1/2 or any error** → fall back to reading `.contextdx/boards/<boardSlug>.json` (+ `manifest.json` + `layerBoardSlug` children) directly and mint keys/aliases by hand, per `references/execution-protocol.md`.
- **Skip when trivial:** for a single board under ~30 nodes with no manifest/child boards, reading that one board JSON directly is simpler — skip the prepass.

Pack shape: `boards[]` (`{slug, alias, layer, parentBoardSlug, context:{techStacks,languages,archetypes}, nodeCount, edgeCount}`), `scopeBoards[]` (copy-ready `scope.boards` rows), `elements[]` (`{key, board, slug, type, name, description}` — keys ≤12, aliases ≤20, pre-validated; **aliases are the normalized board slug, not short mnemonics**), `edges[]` (`{board, sourceKey, targetKey, type, description}`), `degree[]` (`{key, board, fanIn, fanOut}`, ranked by **combined** fan-in+fan-out, most-connected first), `primaryBoardDefault`, `stats` (`{boardCount, elementCount, edgeCount, droppedEdges, duplicateSlugs, unresolved[]}`). A non-zero `droppedEdges` means some board edges had unresolved endpoints and were omitted — don't assume two nodes are unconnected solely because no `pack.edges` row links them.

### Step 2: Execute Each Selected Skill

For each skill, follow the execution protocol in `references/execution-protocol.md`:

1. **Read the context pack** from `.contextdx/insights/<boardSlug>.context.json` (Step 1.6) instead of reading board JSONs. The board universe, the skill variables, the element index, and the edge adjacency all come from the pack: skill vars from `pack.boards[]`, the element index from `pack.elements[]`, edges from `pack.edges[]`. (Fallback only — if the pack is unavailable: read `.contextdx/boards/<boardSlug>.json` + `manifest.json` + `layerBoardSlug` children directly per `references/graph-context.md`.)
1b. **Determine the primary board** — decide which board to use as the top-level `boardSlug` in the payload:
   - **Default**: use `pack.primaryBoardDefault` (the board the pack was built for)
   - If `{{userPrompt}}` or the skill's instructions name a domain/component matching a board in `pack.boards`, use that board instead
   - If findings concentrate on a single child board during analysis, switch to it
   - When switching, the chosen board must have a row in `pack.scopeBoards` and **not** appear in `pack.stats.unresolved` (a board the pack couldn't load) — pick only from `pack.boards`
   - Store the result as `{{primaryBoardSlug}}` — this replaces `{{boardSlug}}` in the payload and CLI command
2. **Interpolate skill variables** — replace `{{boardSlug}}`, `{{techStacks}}`, `{{detectedLanguages}}`, `{{nodeArchetypes}}`, `{{focusNodes}}` in the skill's `instructions`. Source these from the primary board's pack entry: `{{techStacks}}`/`{{detectedLanguages}}`/`{{nodeArchetypes}}` from the `pack.boards[]` entry whose `slug` equals `{{primaryBoardSlug}}` (its `.context`), and `{{focusNodes}}` formatted from `pack.elements` (slug, type, description) for that board
3. **Inject user focus** — if `{{userPrompt}}` is non-empty, append the following at the end of the interpolated instructions:
   ```
   ## User Analysis Focus
   {{userPrompt}}
   ```
   Use this to prioritise findings, narrow scope, or highlight areas the user explicitly cares about. Omit this section if `{{userPrompt}}` is empty.
4. **Execute analysis** following the interpolated instructions:
   - Use Read, Glob, Grep to examine source files
   - When instructions say "see `<name>`", read the matching entry from the skill's `references[]` array
5. **Build scope first (copy from the pack).** Copy `pack.scopeBoards` straight into `scope.boards` (its aliases are the normalized board slugs — copy them verbatim, do **not** shorten to mnemonics like the schema examples). For each element you cite — anchor of a finding, step of a path, target of a suggestion, or relevant context — take its `pack.elements` row and emit `{ key, slug, board }` **verbatim** plus a `role` (`focus` for elements you anchor findings/paths on, `context` for surrounding context) and an optional `emphasis` for context elements (drop `type`/`name`/`description` — they aren't scope fields). Never re-mint keys/aliases or look up which board a slug lives on — the pack already did, and copying verbatim is what makes the payload pass scope validation first try. Rules:
   - **Cite only what you use** (plus deliberate context) — don't dump the whole index into scope.
   - **All-or-nothing boards:** every element you cite must have its board's row in `scope.boards`. Copying `pack.scopeBoards` whole satisfies this; never prune a board you still reference.
   - **Discovered in source?** If you find a component in the source that has **no** row in `pack.elements`, do not invent a key for it — express it as a `GraphSuggestion` with `action: "add"` and `element: null`, never as a cited finding.
   Everything else references scope by `key`/`alias`. See [knowledge/insights/references/report-output-format.md](../knowledge/insights/references/report-output-format.md#scope) for the full schema. (Fallback only — no pack: mint short `key`/`alias` tokens by hand per that schema.)
6. **Produce findings** — create `ElementInsight` objects per `references/report-output-format.md`:
   - Required: `id`, `name` (≤ 100), `insight` (5–500), `polarity` (`risk` | `strength` | `opportunity` | `observation`), `priority` (`critical` | `high` | `medium` | `low`), `confidence` (`verified` | `likely` | `inferred` | `speculative`)
   - `element` — ElementKey from `scope.elements`; omit/null for board-wide findings
   - Optional: `relatedElements` (ElementKey[]), `impact`, `effort`, `measurement` (quantitative supporting data, attachable to any polarity), `tags`, `relatedFindings`
   - Populate `recommendation` OR `context`, **not both** — the CLI rejects payloads that set both. Use `recommendation` for actionable risks/opportunities, `context` for observations or risks without a concrete action.
7. **Trace insight paths** — create `InsightPath` objects for execution flows, blast radius chains, or dependency paths (when the skill calls for it). Paths can span multiple boards via scope:
   - Required: `id`, `title` (≤ 100), `polarity`, `priority`, `defaultBoard` (BoardAlias — the most common board across steps), `steps` (min 2)
   - Each step has `element` (ElementKey), optional `label`, `annotation`, `findingRef` (id of an `ElementInsight` in this analysis — the step inherits its polarity/priority/recommendation), `branches` (recursive sub-steps for non-linear flows)
   - **Path quality:** Only create paths when tracing connected flows through the graph's edges. Edge-ground every consecutive step pair against `pack.edges` (a real edge within a board; cross-board transitions are valid via scope), and use `pack.degree` (ranked fan-in/fan-out) to find hubs and chokepoints. Set `defaultBoard` to an alias from `pack.scopeBoards`. Never repeat the same element key in consecutive steps; an element may reappear later if it plays a genuinely different role.
8. **Propose graph suggestions** — create `GraphSuggestion` objects for recommended structural changes (when the skill calls for it):
   - Required: `id`, `action` (`add` | `remove` | `modify`), `targetType` (`node` | `edge` | `container`), `name`, `rationale` (5–500), `polarity`, `priority`
   - Optional: `element` (ElementKey for remove/modify), `fromElement`/`toElement` (ElementKeys for edges), `tags`
9. **Write markdown report** — compose a detailed report for the `content` field
10. **Assemble PushInsightsCommand** — build the full JSON payload. `scope` is required inside `insights`. The CLI injects `rootBoardSlug` automatically — do not include it:
   ```json
   {
     "boardSlug": "<primaryBoardSlug>",
     "insightSkillSlug": "<skill.slug>",
     "insights": {
       "scope": {
         "boards": [
           { "slug": "<primaryBoardSlug>", "alias": "ovw" },
           { "slug": "auth-domain", "alias": "auth" }
         ],
         "elements": [
           { "key": "e1", "slug": "auth-service", "board": "auth", "role": "focus" },
           { "key": "e2", "slug": "api-gateway",  "board": "ovw", "role": "focus" }
         ]
       },
       "insights": [
         { "id": "sec-001", "element": "e1", "name": "Hardcoded JWT Secret", "insight": "JWT secret is a string literal in src/auth/login.ts:42.", "polarity": "risk", "priority": "critical", "confidence": "verified", "recommendation": "Read JWT_SECRET from env; rotate via deployment." }
       ],
       "paths": [
         { "id": "path-001", "title": "Auth Flow", "polarity": "observation", "priority": "high", "defaultBoard": "ovw", "steps": [{ "element": "e2", "label": "Receives login" }, { "element": "e1", "label": "Validates credentials", "findingRef": "sec-001" }] }
       ],
       "suggestions": [
         { "id": "sug-001", "action": "add", "targetType": "node", "name": "Add secrets manager", "rationale": "Centralise secret storage to eliminate hardcoded values.", "polarity": "opportunity", "priority": "high" }
       ]
     },
     "content": "<markdown report>",
     "title": "<skill.name> — <date>",
     "description": "<summary>"
   }
   ```
11. **Write to temp file** and save/push. **First ensure the pack exists for `{{primaryBoardSlug}}`** — if you switched the primary board away from the one you built the pack for in Step 1.6, rebuild it now (`--build-context --board-slug <primaryBoardSlug> --out .contextdx/insights/<primaryBoardSlug>.context.json`). Then save with `--require-pack` so a missing pack fails loudly instead of silently skipping the pack gates:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-insights.js --save-insight /tmp/insight-<slug>.json --board-slug <primaryBoardSlug> --require-pack --push
   ```
   The CLI gates the payload through (a) Zod structural validation, (b) `validateScopeReferences` (every ElementKey/BoardAlias/findingRef resolves; unique ids; no self-reference; no consecutive-duplicate path steps; finite measurements; recommendation/context mutual exclusion), and (c) `validateInsightContent` against the context pack (every cited element/board exists in the pack; path steps are edge-grounded). Two channels:
   - **`validationErrors[]` + exit 3 (blocking)** — fix the listed fields and retry. The errors are exact (JSON path + value + fix); for a "did you mean" hint, copy the suggested pack row verbatim.
   - **`warnings[]` + exit 0 (non-blocking, saved)** — review them once (e.g. unbacked `verified`, unreferenced scope rows, ungrounded `/insights` path). Improve if cheap, but **do not loop** on warnings — they don't block.
12. **Report result**: pushed to server OR saved locally

### Step 3: Summary

After all skills complete, display a summary table:

```
| Skill               | Findings | Paths | Suggestions | Critical | High | Status  |
| security-analysis   |    12    |   2   |      1      |    3     |  5   | pushed  |
| quality-checks      |     8    |   0   |      2      |    0     |  4   | saved   |
```

## Error Handling

- **No config** / **credentials rejected** (`errorType: "auth_invalid"`): make the **connect-now offer** (below)
- **No board data**: Report "No board data found — run /analyze first"
- **Skill has no instructions**: Skip it and report "Insight skill '<slug>' has no instructions"
- **Validation errors (exit code 3)**: Read the `validationErrors` array from the JSON output. Fix the payload fields listed in the errors (wrong field names, missing required fields, invalid enum values), rewrite the temp file, and retry the save/push
- **Push fails**: Save locally and report "Saved locally — push failed: <error>"
- **Push endpoint not available**: Save locally and report "Saved locally — server push not yet available"

### Connect-now offer

Used whenever ContextDX is not configured or the credentials were rejected (`errorType: "auth_invalid"`). Ask with **AskUserQuestion** — "Connect to ContextDX now?" (**Connect now** / **Not now**):

- **Connect now** → run the browser login here, printing each JSON `display` verbatim: `node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-login.js --start`, then `node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-login.js --poll --analyze-cmd analyze` (generous Bash timeout, e.g. 250s). On `status: "complete"`, resume this command from the step that failed; anything else — stop, the display explains.
- **Not now** → stop with the canonical message: "ContextDX not configured — run `/login` (browser) or `/configure` (manual) first" (or, when credentials were rejected: "Your ContextDX credentials were rejected — run `/login` to reconnect").
