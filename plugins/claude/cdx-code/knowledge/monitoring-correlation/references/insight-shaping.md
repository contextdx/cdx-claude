# Insight Shaping — making findings intent-ready

When an architect promotes a finding, the platform maps it **mechanically** onto an intent — so
finding quality IS intent quality. The exact mapping:

| Finding field | Becomes on the intent | Authoring rule |
|---|---|---|
| `name` | intent **name** | Imperative work item: "Fix TypeError in CheckoutSession.finalize" — never "Error observed in checkout" |
| `insight` | description + directive ¶1 | Evidence only: what fails, where, how often, since when. No opinions. |
| `recommendation` | directive ¶2 | **The concrete corrective action a developer executes.** Always set it (except `unmatched`/pure-observation findings, which get `context` instead — never both). |
| `context` | directive ¶3 | Blast radius, related deploys, trend notes. |
| `element` + `relatedElements` | intent **anchors** | Primary match + implicated neighbours. Anchors are what `/intents --show` resolves back to source files — keep them tight. |
| `priority`, `effort` | carried verbatim | **Set both on every actionable finding.** |
| `id` | `origin.findingIds` | The skeleton already set it from the signal fingerprint — never change it. |

## Per-finding checklist (skeleton → intent-ready)

1. **Verify before claiming.** Read the matched element's source (from its `sourceReferences` /
   the signal's stack frames). Only upgrade `confidence` to `verified` after reading the code;
   if the match looks wrong, say so in `context` and leave confidence at `likely`/`inferred` —
   or fix the mapping via the teach-once loop instead of shipping a mis-anchored finding.
2. **Name = the work.** ≤100 chars, imperative, specific.
3. **Insight = the evidence.** Counts, window, sample error, users affected. The measurement
   carries the primary number; the prose carries the story.
4. **Recommendation = the directive.** One concrete action ("Guard `session.customer` against
   null before `finalize()`; add the regression test"), not a category ("improve error handling").
5. **Effort** from scope of the fix: `trivial` (guard/config), `small` (one component),
   `medium` (component + tests + migration), `large`/`epic` (cross-component).
6. **Priority**: keep the skeleton's severity-derived value unless evidence changes it. Escalate
   one level when the trend is `increasing` across runs, when `usersAffected` is material, or for
   cost signals whose delta exceeds the configured threshold multiple times over.

## Paths and suggestions — only when they earn their place

- **InsightPath** (blast radius): for `critical` findings on high-fan-in elements, trace the
  dependents 2–4 steps using the context pack's `edges`/`degree` (edge-ground every consecutive
  pair; `findingRef` the anchor finding). This is what makes the portal overlay explain impact.
- **GraphSuggestion**: only when signals reveal a **structural** truth the board is missing — a
  recurring timeout on a dependency that has no edge, a resource generating cost with no node.
  `action: "add"` with the rationale citing the signal evidence. Never suggest structure to
  "fix" a mapping problem — that is what `map.json` is for.

## Unmatched findings

Keep them (they are real production facts), leave `recommendation` empty, and put in `context`
what would anchor them next run — usually one `map.json` entry or a tag on the node. If the same
signal stays unmatched across runs, propose the mapping to the user again with the accumulated
evidence.
