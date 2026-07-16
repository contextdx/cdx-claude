# Insight Skill Execution Protocol

This document describes the step-by-step process for executing a server-defined InsightSkill.

## Overview

An InsightSkill is a server-defined analysis task. The server provides the instructions and references; the plugin executes them using Claude as the analysis engine. The existing architecture board provides the context.

The output is an `InsightsRoot` object built around a **Scope** (the boards + elements this analysis covers) and three optional arrays referencing scope by short keys: `insights[]`, `paths[]`, `suggestions[]`. There is no `affectedElements` array — scope plus per-finding `relatedElements` does that job.

## Execution Steps

### 1. Fetch Skill List (Precis)

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-insights.js --list-insight-skills
```

Parse the JSON output:
- `featureAvailable === false` → report "Insights not available for this account" and stop
- `skills === []` → report "No insight skills configured" and stop
- Otherwise, use the `skills[]` precis data (slug, name, description, category, duration) for skill selection

The precis list is used in two ways depending on how the command was invoked:
- **Agent-inferred mode**: Claude semantically matches the user's natural-language prompt to skill names and descriptions to select the best-fit skill(s)
- **User-selection mode**: Claude displays the skills list and collects an explicit user choice plus a mandatory focus prompt before proceeding

### 1b. Fetch Full Skill

Once a skill is selected, fetch its full content (instructions + references):

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-insights.js --get-insight-skill <slug>
```

Parse the JSON output:
- On success, the `skill` field contains the full skill with `instructions` and `references[]`
- Exit code 3 with 404 → skill not found, skip it
- If `skill.instructions` is null → skip and report "Insight skill has no instructions"

For `--all`, fetch each skill's full data one at a time before executing it.

### 2. Extract Board Context

**Preferred:** run the context prepass (`cdx-insights.js --build-context --board-slug <boardSlug> --out .contextdx/insights/<boardSlug>.context.json`) and read the pack. This canonical path is also what `--save-insight` loads as the oracle for its quality gates. It resolves the board universe (insights mode: root + child subtree + siblings; demo mode `--demo`: start board + direct children only) and emits the skill variables, the keyed element index, the edge adjacency, and a degree table — so you don't read every board JSON or mint scope keys by hand. The manual walk below is the **fallback** when the pack is unavailable.

Fallback — read the board's analysis data from `.contextdx/boards/<boardSlug>.json` and extract skill variables — see [graph-context.md](graph-context.md) for details. Also read `.contextdx/boards/manifest.json` (if it exists) to discover child/layer boards. For nodes that have a `layerBoardSlug`, read that child board's data file too to enable cross-board analysis. Also read any sibling boards discovered from the manifest to enable cross-domain paths.

- `{{boardSlug}}` — the root board slug from config (used as default primary board)
- `{{primaryBoardSlug}}` — the board slug to use as the top-level primary for this insight (defaults to `{{boardSlug}}`, see Primary Board Selection below)
- `{{techStacks}}` — from `metadata.techStacks`
- `{{detectedLanguages}}` — from `metadata.languages`
- `{{nodeArchetypes}}` — unique archetype names (node `type` field) from nodes
- `{{focusNodes}}` — node slugs with their archetypes and descriptions

#### Primary Board Selection

Determine `{{primaryBoardSlug}}` — the board to use as the top-level primary for this insight:

1. **Default** — use the root board from config (`{{boardSlug}}`)
2. **User prompt match** — if `{{userPrompt}}` names a domain or component that matches a board in the manifest, use that board
3. **Skill scope** — if the skill's instructions explicitly target a specific layer or domain, use the matching board
4. **Finding concentration** — if during analysis the majority of findings relate to elements on a single child board, switch to it

The primary board's slug goes in the top-level `boardSlug` of the push command. Elements on sibling/child boards are still legal — they live in `scope.elements` with a different board alias.

### 3. Read Skill Instructions

The skill's `instructions` field contains the primary analysis task. This is the "skill body" — Claude follows it verbatim.

If the skill has no `instructions` (null), skip it and report "Insight skill has no instructions".

### 4. Interpolate Skill Variables

Replace `{{variable}}` placeholders in the instructions with values from the board context (step 2) and the user's prompt:

| Variable | Source | Example Value |
|---|---|---|
| `{{boardSlug}}` | `metadata.boardSlug` | `my-app-overview` |
| `{{techStacks}}` | `metadata.techStacks` joined by `, ` | `react, node, postgres` |
| `{{detectedLanguages}}` | `metadata.languages` joined by `, ` | `typescript` |
| `{{nodeArchetypes}}` | Unique `type` values from `nodes[]` | `Service, Database, Queue` |
| `{{focusNodes}}` | Formatted node list | `- auth-service (Service): Handles login` |
| `{{userPrompt}}` | User-provided focus prompt (empty string if not provided) | `check the auth service for OWASP risks` |

After replacing all `{{variable}}` placeholders, if `{{userPrompt}}` is non-empty, append the following section at the end of the instructions:

```
## User Analysis Focus
{{userPrompt}}
```

Use this focus to prioritise findings, narrow scope, or highlight areas the user explicitly cares about. Omit this section if `{{userPrompt}}` is empty.

### 5. Execute Analysis

Follow the interpolated instructions. Typically this involves:
- Reading source files via Read/Glob/Grep tools
- Scanning for patterns described in the instructions
- Consulting references when the instructions say "see `<reference-name>`"

### 6. Consult References On Demand

When instructions reference a named document (e.g., "see `owasp-patterns`"), find the matching entry in the skill's `references[]` array by `name` and read its `content`.

References are named markdown documents that provide detailed detection patterns, classification rules, or domain knowledge the analysis needs.

### 7. Build the Scope dictionary

**Author this first**, before findings/paths/suggestions — everything else references it.

**From the pack (preferred):** copy `pack.scopeBoards` into `scope.boards` (its aliases are normalized board slugs — copy verbatim, don't shorten to mnemonics like the examples below). For each cited element, emit `{ key, slug, board }` **verbatim** from its `pack.elements` row plus `role`/`emphasis` (drop `type`/`name`/`description`). This is what guarantees the payload passes scope validation on the first try. Three rules:
- **Cite only what you use** (plus deliberate `context` elements) — do not dump the whole index.
- **All-or-nothing boards:** every cited element's board must be present in `scope.boards` (copying `pack.scopeBoards` whole satisfies this); never prune a board you still reference.
- **Discovered in source?** A component you find in the source that has no `pack.elements` row must become a `GraphSuggestion` (`action:"add"`, `element:null`) — never invent a key and cite it.

**By hand (fallback, no pack):** for each board your analysis touches, register an entry in `scope.boards`. For each element you'll cite (anchor of a finding, step of a path, target of a suggestion, or referenced as context), register an entry in `scope.elements` exactly once.

```json
{
  "scope": {
    "boards": [
      { "slug": "my-project-overview", "alias": "ovw" },
      { "slug": "auth-domain", "alias": "auth" }
    ],
    "elements": [
      { "key": "e1", "slug": "auth-service", "board": "auth", "role": "focus" },
      { "key": "e2", "slug": "api-gateway",  "board": "ovw", "role": "focus" },
      { "key": "e3", "slug": "user-db",      "board": "auth", "role": "context" }
    ]
  }
}
```

Conventions:
- **`alias`** — short token, regex `^[a-z0-9_-]+$`, max 20 chars. Pick something memorable from the slug (e.g. `ovw` for `my-project-overview`, `auth` for `auth-domain`). Boards reference each other only by alias inside this payload.
- **`key`** — short token, regex `^[a-z0-9_-]+$`, max 12 chars. Either sequential (`e1`, `e2`) or semantic (`auth`, `gw`, `db`). Keys are referenced from findings, paths, and suggestions.
- **`role`** — `focus` for elements your analysis anchors findings or paths on; `context` for elements referenced only for surrounding context. Default is `focus` if omitted.
- **`emphasis`** — optional, only meaningful for `role: context` elements; for focus elements the renderer derives emphasis from the highest-priority pinned finding. Valid values: `none`, `highlight`, `pulse`, `glow`, `outline`, `focus`.
- **One row per element** — no duplicates. Use the same key everywhere you reference it.

### 8. Produce ElementInsight Objects

For each finding, create an `ElementInsight` referencing scope by element key:

```json
{
  "id": "sec-001",
  "element": "e1",
  "name": "Hardcoded JWT Secret",
  "insight": "JWT secret key is hardcoded as a string literal in src/auth/login.ts:42; rotation requires code changes.",
  "polarity": "risk",
  "priority": "critical",
  "confidence": "verified",
  "impact": "Compromise of source access reveals signing key, allowing arbitrary token forgery.",
  "effort": "small",
  "recommendation": "Read the secret from JWT_SECRET environment variable; rotate via deployment, not commit.",
  "tags": ["security", "secrets"]
}
```

Field guide:
- **`id`** — unique within this analysis (e.g., `sec-001`, `perf-003`).
- **`element`** — ElementKey from `scope.elements`. Null/omit for board-wide findings that don't anchor to a single element.
- **`relatedElements`** — array of ElementKeys also implicated. The diagram highlights all of them together.
- **`name`** — short label (≤ 100 chars).
- **`insight`** — evidence-driven description (5–500 chars). State *what* you found and *why* it matters. Opinion lives in `recommendation`.
- **`polarity`** — one of `risk`, `strength`, `opportunity`, `observation`. (No "metric" — measurements are a separate field, see below.)
- **`priority`** — one of `critical`, `high`, `medium`, `low`. Orthogonal to polarity (a strength can still be high priority to highlight).
- **`confidence`** — one of `verified` (read the code), `likely` (strong evidence), `inferred` (derived from patterns), `speculative` (pattern-match guess). Be honest; the renderer surfaces this.
- **`impact`** — optional. For risks/opportunities: consequence if left unaddressed. For strengths: what is gained by leveraging it. Max 300 chars.
- **`effort`** — optional. Relative work to act on the finding: `trivial`, `small`, `medium`, `large`, `epic`. Only meaningful when `recommendation` is set.
- **`measurement`** — optional. Quantitative supporting data. See "Measurements" below.
- **`tags`** — classification tags for grouping/filtering (max 10).
- **`recommendation`** — concrete action to take (max 500 chars). Populate when polarity is `risk` or `opportunity` and there's an actionable next step.
- **`context`** — supplementary background (max 500 chars). Populate for `observation`/`strength`, or `risk` without a concrete action.
- **Mutual exclusion** — populate `recommendation` **OR** `context`, not both. The CLI rejects payloads that set both.
- **`relatedFindings`** — array of other finding `id`s this one connects to (amplifies, depends on, follows from).

#### Measurements

When a finding has a quantitative dimension, attach a `measurement` rather than using a separate signal type:

```json
{
  "id": "perf-002",
  "element": "e2",
  "name": "Auth endpoint p99 latency",
  "insight": "Auth endpoint p99 latency is 850ms at peak, dominated by bcrypt comparison.",
  "polarity": "observation",
  "priority": "medium",
  "confidence": "likely",
  "measurement": { "value": 850, "unit": "ms", "baseline": 200, "threshold": 500, "trend": "increasing" },
  "context": "Bcrypt cost factor is 14, set in 2019; modern hardware supports 12 without weakening security."
}
```

`measurement` attaches to any polarity. Use `baseline` for the target/SLA value, `threshold` for the value beyond which the measurement is noteworthy, and `trend` for direction over time if known.

### 9. Trace Insight Paths

Create `InsightPath` objects only when the analysis traces connected flows through the graph's edges — execution paths, blast radius chains, or dependency cascades. If the skill's analysis produces point findings without tracing flows between them, omit paths entirely. Zero paths is a valid outcome.

```json
{
  "id": "path-001",
  "title": "User Authentication Flow",
  "description": "Critical path from login request to session creation.",
  "polarity": "observation",
  "priority": "high",
  "defaultBoard": "ovw",
  "steps": [
    { "element": "e2", "label": "Receives login request", "annotation": "Rate limited 10 req/s" },
    { "element": "e1", "label": "Validates credentials", "findingRef": "sec-001" },
    { "element": "e3", "label": "Reads user record" }
  ],
  "tags": ["auth", "latency"]
}
```

Field guide:
- **`id`**, **`title`**, **`description`** — as before. Title ≤ 100 chars, description ≤ 500.
- **`polarity`**, **`priority`** — overall nature of the path.
- **`defaultBoard`** — BoardAlias from `scope.boards`. The most common board across the steps; used for fast UI lookup. Each step's element resolves to its own board via `scope.elements` regardless of this default.
- **`steps`** — ordered, minimum 2.
  - **`element`** — required ElementKey.
  - **`label`** — what happens at this step (≤ 100).
  - **`annotation`** — extra context like latency or load (≤ 300).
  - **`findingRef`** — optional id of an `ElementInsight` in this same analysis. If set, the step inherits the finding's polarity/priority/recommendation; don't duplicate the prose.
  - **`branches`** — optional array of sub-steps for non-linear flows (conditional branches, fan-outs). Recursive — branches can have their own branches.

#### Path quality rules

- **Edge-grounded** — ground every consecutive step pair against `pack.edges` (fallback: `edges[]` from the board data). Each pair should correspond to an actual edge (direct or within 1-2 hops); use `pack.degree` to locate hubs/chokepoints worth tracing. Do not invent connections that don't exist in the graph. Edge-grounding applies within each board; cross-board transitions are valid when the flow continues across board boundaries.
- **No consecutive duplicates** — never place the same `element` key in back-to-back steps. An element may reappear later if the flow genuinely revisits it in a different role (with a distinct `label`). If revisits make the path hard to follow, split into separate forward/return paths.

#### Branches example

```json
{
  "id": "path-blast-001",
  "title": "Payment failure blast radius",
  "description": "Where a payment-service outage propagates.",
  "polarity": "risk",
  "priority": "high",
  "defaultBoard": "ovw",
  "steps": [
    { "element": "pay", "label": "payment-service outage" },
    {
      "element": "ord", "label": "order-service blocks on retries",
      "branches": [
        { "element": "ntf", "label": "notification-service skips confirmation" },
        { "element": "anly", "label": "analytics pipeline misses event" }
      ]
    },
    { "element": "user", "label": "user sees error" }
  ]
}
```

### 10. Propose Graph Suggestions

When the analysis identifies structural improvements to the board, create `GraphSuggestion` objects. All element references are ElementKeys.

```json
{
  "id": "sug-001",
  "action": "add",
  "targetType": "node",
  "name": "Add Redis cache layer",
  "rationale": "Auth service queries user-db on every request. A cache layer would cut p99 latency by ~80%.",
  "polarity": "opportunity",
  "priority": "high",
  "tags": ["performance", "caching"]
}
```

Field guide:
- **`action`** — `add`, `remove`, or `modify`.
- **`targetType`** — `node`, `edge`, or `container`.
- **`element`** — ElementKey of the element to remove or modify. Null/omit for `add` actions.
- **`fromElement`**, **`toElement`** — ElementKeys for the source and target of an edge suggestion.
- **`name`** — what is being suggested (≤ 100).
- **`rationale`** — why (5–500).
- **`polarity`**, **`priority`** — same enums as ElementInsight.

For adding a new element that doesn't yet exist in scope, omit `element` and describe the addition in `name`+`rationale`. For an edge between two existing elements, set both `fromElement` and `toElement` to their ElementKeys (and those elements must be in `scope.elements`).

### 11. Write Markdown Report

Compose a markdown report for the `content` field:
- Summary with finding counts by priority and polarity
- Detailed findings grouped by element or category, mentioning each finding's confidence and (where set) measurement
- Paths traced through the architecture
- Suggested structural changes
- Recommendations for actionable findings

### 12. Assemble and Save

Build the `PushInsightsCommand` JSON. Every reference inside `insights`/`paths`/`suggestions` must resolve to a row in `scope.elements` or `scope.boards`:

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
      {
        "id": "sec-001",
        "element": "e1",
        "name": "Hardcoded JWT Secret",
        "insight": "JWT secret is a string literal in src/auth/login.ts:42.",
        "polarity": "risk",
        "priority": "critical",
        "confidence": "verified",
        "recommendation": "Read JWT_SECRET from env; rotate via deployment."
      }
    ],
    "paths": [
      {
        "id": "path-001",
        "title": "Auth Flow",
        "polarity": "observation",
        "priority": "high",
        "defaultBoard": "ovw",
        "steps": [
          { "element": "e2", "label": "Receives login" },
          { "element": "e1", "label": "Validates credentials", "findingRef": "sec-001" }
        ]
      }
    ],
    "suggestions": [
      {
        "id": "sug-001",
        "action": "add",
        "targetType": "node",
        "name": "Add secrets manager",
        "rationale": "Centralise secret storage to eliminate hardcoded values.",
        "polarity": "opportunity",
        "priority": "high"
      }
    ]
  },
  "content": "<markdown report>",
  "title": "<skill.name> — <date>",
  "description": "<summary line>",
  "info": "<one-line audit summary of what this analysis surfaced, ≤350 chars>"
}
```

Note:
- `insights.scope` is **required**. `insights.insights`, `insights.paths`, `insights.suggestions` are all optional — include only what the analysis produces.
- Do not set `insights.name` — the data layer fills it from the parent record's title at render time.
- `info` is a short (≤ 350 char) human-readable line describing **what this run surfaced** — e.g. `"3 auth risks incl. a hardcoded JWT secret; missing rate-limit on the payment path"`. It is stored on the push's audit thread so the pushed insight is traceable back to this analysis run and its source binding. Be specific and concrete; if omitted, the CLI falls back to a generic `Insights: <skill> → <board>` label.

Write to a temp file, then:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-insights.js --save-insight <path> --board-slug <primaryBoardSlug> --push
```

The CLI runs three validation gates before writing/pushing:
1. Zod schema (structural validity).
2. `validateScopeReferences` (every `element`/`fromElement`/`toElement` ElementKey resolves in `scope.elements`; every `scope.elements[].board` and every `defaultBoard` BoardAlias resolves in `scope.boards`; every `findingRef`/`relatedFindings` id matches a finding; **unique ids**; **no self-reference**; **no consecutive-duplicate path steps**; **finite measurement values**; no `ElementInsight` has both `recommendation` and `context`).
3. `validateInsightContent` against the context pack (when present): every cited `scope.elements` `{slug,board}` **exists in the pack**; the primary board is not in `pack.stats.unresolved`; same-board path step pairs are **edge-grounded** against `pack.edges` (HARD for `/demo-insights`, a warning for `/insights`).

Two channels: **`validationErrors[]` + exit 3** is blocking — fix the listed fields and retry (errors carry a JSON path, the bad value, and the fix; copy any "did you mean" pack row verbatim). **`warnings[]` + exit 0** is non-blocking and already saved — review once (unbacked `verified`, unreferenced scope rows, ungrounded `/insights` paths) and improve if cheap, but **do not loop** on warnings.

Self-check before pushing: every `findingRef`/`relatedFindings` id equals an `insights[].id`; every element key in steps **and `branches`** (walked recursively) has a `scope.elements` row; cited rows were copied from the pack.

### 13. Report Result

- If pushed successfully: "Pushed to server (insightId: abc-123-def)"
- If push not available: "Saved locally — server push not yet available"
- If push failed: "Saved locally — push failed: <error>"
