---
name: intent-gap-review
user-invokable: false
description: Review an architect-authored intent against current code reality before implementing it, then classify the gap as clean, minor, or blocking. Used by /intents Step 4.5 to decide whether to implement, or bounce the intent back to the architect for clarification. Provides the gap-table method, the blocking criteria, and how to draft the bounce-back note.
metadata:
  author: ContextDx
  version: 0.1.0
---

# Intent Gap Review — Methodology

An intent is the architect's picture of a change; the code is the reality the developer lives in. Between the moment the architect authored the intent and the moment you implement it, the two can drift. This skill runs **before any edit** (`/intents` Step 4.5): it decides whether the intent is safe to implement now, or whether the gap is the architect's to resolve.

The judgment is yours; the mechanics (`--clarify`, staleness flag, anchor resolution) belong to the CLI. Your job here is the comparison and the classification.

## 1. Build the gap table

For **each** piece of the intent's spec, find its counterpart in the code and record whether they agree. Cover every one that applies:

| Spec element | Where it lives on the intent | What to check in the code |
| --- | --- | --- |
| Anchors | `intent.anchors[]` / the `--show` anchor→file map | Does each anchor still resolve to a real file/element? |
| Directive | `intent.directive` | Are the components/behaviours it names actually present and shaped as described? |
| Proposed changes | `board_diff` `suggestions[]` | Is each add/remove/modify still applicable, or already done / impossible? |
| Attachments | downloaded files under `.contextdx/intents/attachments/<id>/` | Do they still match the contracts/shape of the code? |
| Baseline drift | `stale: true` | The server already flagged the anchor facts as drifted. |

Render it as a compact table the user can scan: **element · expected (architect) · found (code) · verdict** (`match` / `nit` / `gap`).

## 2. Classify

- **`clean`** — everything matches; implement.
- **`minor`** — only nits (renamed symbol, moved file, cosmetic drift) that you can bridge without guessing the architect's intent; implement, noting what you bridged.
- **`blocking`** — one or more true gaps by the criteria in [references/gap-criteria.md](references/gap-criteria.md). Do **not** implement; take it to the user.

When unsure between `minor` and `blocking`, treat it as `blocking` — a needless round-trip is cheaper than implementing the wrong thing against a moved target.

## 3. If blocking, draft the bounce-back note

The note is the **only** thing the architect receives, so it must stand alone. Keep it ≤1800 characters:

1. **One-line reason** — the single sentence that says why this can't be implemented as written.
2. **expected → found bullets** — one per gap: what the intent assumed, and what the code actually shows.
3. **The decision you need** — what the architect must change or confirm for the intent to become implementable.

Show the draft to the user for approval before sending. Then the command runs
`cdx-intents.js --clarify <intentId> --note "<approved note>"`. Never send an empty or auto-written note.

See [references/gap-criteria.md](references/gap-criteria.md) for the exact blocking criteria and worked note examples.
