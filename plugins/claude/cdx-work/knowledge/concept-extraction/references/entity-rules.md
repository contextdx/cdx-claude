# Entity & Concept Extraction Rules — Edge Cases

Detailed rules for turning prose into clean, deduplicated nodes. See [`../SKILL.md`](../SKILL.md) for the core heuristics, and `../../document-analysis/references/node-archetypes.md` for the archetype vocabulary.

## Concept resolution

### Synonyms and aliases

The same concept is often named several ways ("multi-tenancy", "tenant isolation", "tenanting"). Emit **one** `Concept` node for the canonical name and:

- Pick the name used by the **defining** document as canonical
- Record the aliases in `metadata.aliases` (comma-separated)
- Link other mentions with `references`, not a second `Concept` node

### Concept vs Term

- **Term** (short glossary definition, one or two sentences) → group under a `Glossary` container at L0/L1.
- **Concept** (an idea elaborated across multiple sections/documents) → its own node, often a drill-down candidate.
- If a glossary `Term` and a `Concept` describe the same thing, keep the `Concept` node and have the glossary `defines` it.

### Over-extraction guard

Do not promote every capitalized phrase to a Concept. A phrase qualifies only if it is **defined** somewhere and **referenced ≥2 times**. Headings like "Overview" or "Introduction" are never concepts.

## Stakeholder resolution

### Name normalization

The same owner appears as "Security", "Security Team", "@security", "sec-team". Normalize to one `Stakeholder` node:

- Prefer the fullest human-readable form ("Security Team")
- Record handles/aliases in `metadata.aliases`
- A person and the team they lead are **different** stakeholders unless the corpus uses them interchangeably

### Individuals vs teams

- Prefer **team** stakeholders over individuals when both could own a doc — teams are stabler owners
- Emit an individual stakeholder only when the corpus consistently assigns ownership to a named person (a DRI model)

### Unowned documents

If a document/policy/process states no owner, leave it unowned. Do **not** guess a stakeholder from folder names or the most frequent author — a wrong `owned-by` edge is worse than a missing one.

## Document resolution

### One file, multiple genres

A file that is mostly a Decision but ends with a runbook:
- Top-level node = the primary genre (Decision)
- The secondary genre becomes a `Section`/`Process` node only when drilling into the document at L2

### Duplicated content

Copy-pasted sections across docs:
- Emit one node for the canonical source (the defining/earliest doc)
- If both copies are kept, link the copy to the canonical with `references`
- Don't emit two `Concept`/`Decision` nodes for the same underlying content

### Wikilink resolution

`[[Page Name]]` resolves by matching the page **title** in the corpus:
- Exact title match → link to that node
- Multiple matches → link to the closest in scope (same subject area first), note the ambiguity in the summary
- No match → it's a broken/forward link; skip the edge and note it

## What never gets proposed as an archetype

Even if a naive scan suggests them, these never appear in a proposal payload:

| Pattern | Why skip |
| --- | --- |
| Single-letter or vague names (`doc`, `note` when `Document` exists) | Reviewer can't tell intent; likely a synonym |
| Names with version numbers (`policy_v2`) | Versioning is lifecycle, not identity |
| Names with punctuation/spaces (`design doc`, `how-to`) | Server convention is `snake_case` only |
| Names ≥50 characters | Likely a description, not a name |
| Status-prefixed names (`draft_*`, `archived_*`, `deprecated_*`) | Lifecycle belongs in `metadata.status`/tags |
| `affectedNodeSlugs` referencing nodes from a corpus you didn't analyze this run | Stale — the corpus may have changed |
| Proposals with empty `exampleNodeSlugs` and empty `detectionRules` | Reviewer has nothing to verify against |

## When to defer to a human

If any of these is true, **leave the candidate out** of the auto-generated proposals payload — the user can add it via the `Edit first` option in `/analyze-archetypes`:

- The same documents plausibly fit ≥2 existing archetypes (ambiguity).
- The distinction depends on reader intent you can't observe statically (e.g., "this *is used as* a checklist").
- You'd need to invent the detection rule with no observable signal in the documents.

## Cross-board consistency

When proposing from a multi-board manifest (L0/L1/L2), prefer **one** proposal that covers all boards over many board-scoped duplicates. Set `sourceContext.boardSlug` to the L0 board when the pattern spans levels.
