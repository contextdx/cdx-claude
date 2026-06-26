---
name: demonstrative-insights
description: How to craft a small, high-impact set of demonstrative insights that showcase the insights feature on a board — choosing path-friendly skills for visual variety, building edge-grounded multi-node paths, and applying reusable path recipes. Used by /demo-insights.
user-invokable: false
metadata:
  author: ContextDx
  version: 0.1.0
---

# Demonstrative Insights — Methodology

`/demo-insights` invokes this skill to seed a board with a few insights that look great immediately — the goal is **demonstration**, not exhaustive analysis. The schema and push pipeline are identical to `/insights` (see [../insights/references/report-output-format.md](../insights/references/report-output-format.md)); what differs is *what you optimise for*.

## Analytical vs demonstrative

| | `/insights` (analytical) | `/demo-insights` (demonstrative) |
|---|---|---|
| Goal | Find what's true and actionable | Make the board legible and impressive in one glance |
| Findings | As many as warranted | 1–3 per insight — just enough to anchor a path |
| Paths | When the skill calls for them | **Always** — at least one multi-node path per insight |
| Coverage | Thorough; read source as needed | Graph-first and fast; read source only to verify a claim |
| Variety | Driven by evidence | Deliberate — distinct polarities and path shapes across the set |
| Size | Whatever the analysis yields | 2–4 insights total; small enough to take in at once |

## What makes a good demonstrative insight

1. **Path-first.** The path *is* the demo. Each insight ships ≥1 `InsightPath` connecting several nodes. Findings exist mainly to give path steps a `findingRef` (colour + priority).
2. **Edge-grounded.** Every consecutive pair of path steps must traverse a real edge from the board's `edges[]`. A path that invents connections is worse than no path — it misrepresents the architecture. Cross-board hops are fine when the flow genuinely continues across boards (register both boards in scope).
3. **Visually varied.** Across the set, use different **polarities** (observation / risk / opportunity) so the board shows a spread of colour, and different **path shapes** (linear flow, fan-out cascade, chokepoint chain).
4. **Legible.** 3–6 nodes on a path's main line. Use `branches[]` to fan out from a high-degree node — a hub-and-spokes branch reads instantly and is the most compelling shape on a board.
5. **Fast.** The board JSON already carries node descriptions and edges. Trust it. Only open source files to confirm a specific number you want to cite (e.g. "imported ~125 times").

## Skill → polarity → path shape

Pick skills that each produce a *different* kind of path:

| Skill | Natural polarity | Path shape | Recipe |
|---|---|---|---|
| `feature-journey` | observation | Linear execution flow, entrypoint → engine → leaf | Execution Journey |
| `how-does-it-work` | observation | Linear request trace | Execution Journey |
| `blast-radius` | risk | SPOF root → hub → fan-out to dependents | Blast-Radius Cascade |
| `hidden-dependency` | risk / observation | Many callers → one chokepoint (fan-in) | Hidden-Dependency Chokepoint |
| `onboarding-map` | observation | Importance-ordered tour | Execution Journey (broadened) |
| `future-readiness` | opportunity | Seam → strained area → proposed change | any + a `GraphSuggestion` |

If a focus prompt names a concern (security, performance, cost), include that skill too — but still pair it with at least one path-producing skill so the demo has a path.

## Building a path (the checklist)

- **Scope before steps.** Register every node you'll cite in `scope.elements` once, with a short `key`. Paths/findings reference keys, never raw slugs.
- **Pick the hub from the graph.** Compute fan-in (inbound edge count) and fan-out (outbound) from `edges[]`. The node with the highest degree is your branch point for a fan-out path; a node with high fan-in is your chokepoint for a hidden-dependency path.
- **Main line: 3–6 nodes**, each consecutive pair a real edge. Direction can follow or reverse an edge — what matters is that the edge exists.
- **Branches for fan-out.** Attach `branches[]` to the hub step, one branch per dependent — each branch element must also share a real edge with the hub.
- **No consecutive duplicates.** An element may reappear later in a genuinely different role (distinct `label`), never back-to-back.
- **Anchor with `findingRef`.** Put the insight's main finding on the hub/origin step so the path inherits its colour and priority.
- **`defaultBoard`** = the board alias most steps belong to.

## Re-running a demo

Each skill has a `resultsMode`: `replace` (a new run overwrites the previous run of that skill) or `append` (a new run adds alongside). Surface this to the user — for a repeatable demo, `replace` skills stay clean across runs while `append` skills accumulate.

## References

- [references/path-recipes.md](references/path-recipes.md) — three reusable, archetype-agnostic path recipes with worked examples
- [../insights/references/report-output-format.md](../insights/references/report-output-format.md) — Scope, ElementInsight, InsightPath, GraphSuggestion schemas (shared with `/insights`)
- [../insights/references/graph-context.md](../insights/references/graph-context.md) — extracting node/edge context from board JSON
