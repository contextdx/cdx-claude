---
description: Generate a few demonstrative, path-rich insights on a board to showcase the insights feature
argument-hint: "[count] [--board <slug>] [focus prompt]"
allowed-tools: Read, Glob, Grep, Write, Bash(node:*)
---

Generate a small set of **demonstrative** insights — each with edge-grounded paths that connect multiple nodes — so a board makes an immediate visual impression. This is the showcase counterpart to `/insights`: where `/insights` runs an analysis to completion, `/demo-insights` deliberately picks path-friendly skills and emphasises legible, multi-node paths over exhaustive findings.

Use it to seed a board for a demo, a screenshot, or a walkthrough. It reuses the same server-defined skills and the same push pipeline as `/insights` — only the selection and authoring priorities differ.

Read the methodology in [knowledge/demonstrative-insights/SKILL.md](../knowledge/demonstrative-insights/SKILL.md) and the path recipes in [knowledge/demonstrative-insights/references/path-recipes.md](../knowledge/demonstrative-insights/references/path-recipes.md) before authoring. The payload schema is the same one `/insights` uses — see [knowledge/insights/references/report-output-format.md](../knowledge/insights/references/report-output-format.md#scope).

## Workflow

### Step 0: Validate Prerequisites

Read `boardSlug` from `.contextdx/config.json` and `.contextdx/boards/manifest.json` (if present) to discover layer boards. Then list the server-defined skills:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-insights.js --list-insight-skills --board-slug <boardSlug>
```

Handle the result exactly as `/insights` does:
- **Exit 1** → "ContextDX not configured — run `/configure` first" and stop
- **Exit 2** → "No board data found — run `/analyze` first" and stop
- **Exit 3** → report the API `error` field and stop
- `featureAvailable: false` → "No insight skills available for this account" and stop
- empty `skills` → "No insight skills configured — contact your workspace admin" and stop

### Step 1: Parse Arguments

From `$ARGUMENTS`:
- **count** — leading integer = how many demonstrative insights to create. Default **3**; clamp to **2–4** (a demo board stays legible).
- **`--board <slug>`** — target board. Default: the config `boardSlug` (the root/L0 board, which usually has the richest edge set for paths).
- **focus prompt** — any remaining natural-language text becomes `{{focus}}`, an optional theme that biases skill choice and path subjects. Omit if empty.

### Step 2: Select Path-Friendly Skills (distinct polarities)

Demonstrative value comes from **variety**, not volume. Consult the skill → shape mapping in the methodology skill and pick `count` skills that each produce a different *kind* of path and a different polarity.

Preferred picks when available, in order: **feature-journey** (observation flow), **blast-radius** (risk cascade), **hidden-dependency** (risk/observation chokepoint), then **how-does-it-work** / **onboarding-map** / **future-readiness**. If `{{focus}}` names a concern (e.g. "security", "performance"), include the matching skill and still pair it with at least one path-producing skill.

Fall back to any skills in the `discovery`, `reliability`, or `architecture_health` categories if the preferred set is unavailable. Explain each pick in one sentence. Then fetch each chosen skill's full definition:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-insights.js --get-insight-skill <skill-slug>
```

Note each skill's `resultsMode` (`append` vs `replace`) and tell the user — it matters when re-running a demo. (`replace` overwrites the prior run of that skill; `append` adds to it.)

### Step 3: Index the Graph (the source of truth for paths)

Read the chosen board's `.contextdx/boards/<board>.json` (and any `layerBoardSlug` children if a cross-board path is intended). Build two indexes in your head:
- **nodes**: `slug → {name, type/archetype, description}`
- **edges**: an adjacency list from `edges[]` (`sourceSlug → targetSlug`, with `type` + `description`)

Every path step you author must traverse a real edge from this list. Do **not** invent connections. Extract context variables per [knowledge/insights/references/graph-context.md](../knowledge/insights/references/graph-context.md).

### Step 4: Author One Demonstrative Insight per Skill

For each chosen skill, build a single push payload following the recipe in `references/path-recipes.md` and the schema in `report-output-format.md`:

1. **Scope first.** Register the target board(s) in `scope.boards` (short alias) and every cited node in `scope.elements` exactly once (short `key`, `slug`, board alias, `role` = `focus`/`context`).
2. **1–3 findings.** Just enough to anchor the path — each path's key step should carry a `findingRef`. Use `recommendation` for `risk`/`opportunity`, `context` for `observation`/`strength` (never both).
3. **At least one multi-node path** — this is the point of the command:
   - 3–6 nodes on the main line; every consecutive pair backed by a real edge.
   - Prefer a **branching fan-out** (`branches[]`) on a high-degree node — it reads as a hub on the board and is the most visually compelling.
   - Never repeat an element key in consecutive steps.
   - Set `defaultBoard` to the alias most steps belong to.
4. **Optional: one suggestion** (`add`/`modify`/`remove`) to show structural proposals render.
5. Give the insight a **distinct polarity** from the others so the board shows a spread of colours.
6. Write a tight markdown `content` report and a `title` / `description`.

### Step 5: Validate and Push

Write each payload to a temp file and push:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-insights.js --save-insight /tmp/demo-insight-<slug>.json --board-slug <board> --push
```

The CLI runs Zod validation + `validateScopeReferences` (every ElementKey/BoardAlias/findingRef must resolve; `recommendation`/`context` are mutually exclusive). On **exit 3**, read `validationErrors[]`, fix the payload, rewrite the temp file, and retry.

### Step 6: Summary

Print a table and a share hint:

```
| Skill             | Polarity    | Findings | Paths | Nodes in paths | Status |
| feature-journey   | observation |    3     |   2   |       6        | pushed |
| blast-radius      | risk        |    3     |   1   |       9        | pushed |
| hidden-dependency | risk        |    3     |   3   |      11        | pushed |
```

Then tell the user the board is ready to open/share, and remind them which skills used `replace` (re-running overwrites) vs `append` (re-running adds).

## Error Handling

Same as `/insights`: no config → `/configure`; no board data → `/analyze`; a skill with no instructions → skip and report; push fails or endpoint unavailable → save locally and report "Saved locally — push failed: <error>".
