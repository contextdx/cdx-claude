# Proposal Quality Rules — Edge Cases

Detailed examples and edge cases for archetype proposals. See [`../SKILL.md`](../SKILL.md) for the core heuristics.

## Edge cases for NEW archetypes

### "Almost the same as an existing archetype"

If the proposed archetype overlaps ≥70% with an existing one, prefer an **improvement** (split/redescribe) instead of a new archetype. Example:

- Existing: `queue` (description: "Message broker").
- Tempting proposal: `event_bus` (description: "Pub/sub event broker").
- Better: file a `redescribe` improvement on `queue` if the existing description is too narrow, OR a `split` improvement if both concepts genuinely coexist in your codebase.

### "It's the same archetype but used in a different layer"

L0/L1/L2/L3 boards re-use the same archetypes. Don't propose `l0_service` vs `l1_service`. If a service shown at L0 needs different visual treatment than at L2, that's a board styling concern, not an archetype concern.

### "Several nodes share an unusual property"

A shared property (language, framework, vendor) usually belongs in **tags**, not a new archetype. Archetypes describe *what something is*; tags describe *attributes of it*.

Examples of property-fit:
- "These five nodes are all written in Rust" → tag `rust`, not archetype `rust_service`.
- "Three nodes use Kafka" → tag `kafka`, not archetype `kafka_consumer`.
- "Four nodes are deprecated" → tag `deprecated`, not archetype `legacy_service`.

## Edge cases for IMPROVEMENTS

### Split with unbalanced populations

If 9 nodes fit one branch and 1 node fits the other, don't propose a split — propose **redescribe** on the dominant archetype and let the outlier remain a misfit (or file a separate new-archetype proposal).

Heuristic: split is justified when the smaller branch covers ≥3 nodes AND ≥20% of the total population.

### Rename vs redescribe — which to use

- **Rename**: the name is wrong. *"`service` is always HTTP; rename to `http_service`."*
- **Redescribe**: the name is OK but the docs lie. *"`gateway` is described as 'API gateway' but our usage is always 'BFF'."*

If both apply, file two separate improvements (one rename, one redescribe). They get reviewed independently.

### Merge with three or more

`merge` only supports merging *into* one target. If you have three near-duplicates `cache`, `kv_store`, `keyval_cache`, file two separate `merge` improvements:

1. `kv_store` → `cache`
2. `keyval_cache` → `cache`

Sequencing matters: the second merge runs against a smaller archetype list, so reviewer ergonomics improve. Sort merges by population (most-used target last).

## What never gets proposed

These should never appear in a proposal payload, even if a naive scan suggests them:

| Pattern | Why skip |
| --- | --- |
| Single-letter or two-letter names (`db`, `q`) | Reviewer can't tell intent from name alone |
| Names with version numbers (`auth_v2_service`) | Versioning is a lifecycle concern, not identity |
| Names containing punctuation (`bff-api`) | Server convention is `snake_case` only |
| Names ≥50 characters | Likely a description, not a name |
| `affectedNodeSlugs` referencing nodes from boards you didn't analyze this run | Stale — the codebase may have changed |
| Proposals with empty `exampleNodeSlugs` and empty `detectionRules` | Reviewer has nothing to verify against |

## Cross-board consistency

When proposing from a multi-board manifest (L0/L1/L2), prefer one proposal that covers all boards over many board-scoped duplicates. The `sourceContext.boardSlug` should be the L0 board if the pattern spans levels.

## When to defer to a human

If any of these are true, **don't include the candidate in the auto-generated proposals payload** — leave it out and let the user manually edit `.contextdx/proposed-archetypes.json` if they want to propose it:

- The same components plausibly fit ≥2 existing archetypes (ambiguity).
- The pattern depends on runtime behaviour you can't see in static analysis (e.g., "this *acts as* a cache at runtime").
- You'd need to invent the detection rule from scratch with no observable code-side signal.

In `/analyze-archetypes`, the user has a `Edit first` option in the confirmation prompt — they can review and add ambiguous cases by hand before the submission step runs.
