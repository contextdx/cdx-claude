---
name: concept-extraction
user-invokable: false
description: Heuristics for extracting concepts, entities, definitions, decisions, and the relationships between them from prose — and for deciding when a knowledge set needs a NEW server archetype or when an EXISTING one is being stretched/duplicated. Used by /analyze-docs (knowledge discovery) and by /analyze-archetypes (Phase 1 vocabulary check) before /analyze-docs. Defines what counts as a concept, how to phrase rationales, and what to skip.
license: MIT
metadata:
  author: ContextDx
  version: 0.1.0
---

# Concept Extraction — Heuristics

This skill has two jobs:

1. **Extraction.** Pull `Concept`s, entities, definitions, decisions, and their relationships out of prose for the document-analyzer (`/analyze-docs` Step 3 / knowledge-linker Step 6).
2. **Vocabulary check.** When `/analyze-archetypes` runs, the document-analyzer invokes this skill in `--archetypes-only` mode to decide what archetype proposals (if any) the knowledge set warrants.

Archetypes are server-managed and approved by humans — a noisy proposal queue burns admin attention, so be selective. The work-board catalogue is server-defined per board "kind" and may still be settling; that is exactly why Phase 1 exists.

---

## Part 1 — Extracting Knowledge from Prose

### What counts as a Concept

A `Concept` is an idea the knowledge set is *about* — something defined and then referenced. Promote a noun phrase to a Concept when it clears these bars:

1. **Defined somewhere.** There is a section, glossary entry, or sentence that says what it *is* ("Idempotency is …", "We define a tenant as …").
2. **Referenced ≥2 times across the corpus.** A one-off phrase is just prose, not a concept worth a node.
3. **Central, not incidental.** It carries weight in the subject — "Tenant Isolation" in a multi-tenancy doc, not "the database" mentioned in passing.

Skip: passing nouns, UI labels, vendor product names used as flavor, and synonyms of a concept you already extracted (link them with `defines`/`references` instead of duplicating).

### Extracting Entities

Entities are the named things the knowledge describes — stakeholders, systems-as-described, documents, and the defined concepts above. Heuristics:

- **Stakeholders**: `owner:`/`team:` fields, RACI "Accountable", author by-lines, "the X team is responsible for".
- **Defined terms**: glossary entries, definition lists, "X — …", "X means …".
- **Named artifacts**: "the Onboarding Guide", "RFC-7", "the Data Retention Policy" — emit as the corresponding `Document`/`Decision`/`Policy` node and link by name.

Do **not** invent entities the text doesn't name. If a process clearly needs an owner but none is stated, leave it unowned rather than guessing a stakeholder.

### Extracting Definitions

A definition establishes the canonical meaning of a concept/term:

- Glossary entry → `Glossary`/`Term` **defines** the `Concept`
- "What is X?" / "X is defined as …" section → that `Section` **defines** X
- The **first** authoritative definition wins; later restatements `reference` the canonical one rather than re-defining it

### Extracting Decisions

A decision is a recorded choice with rationale:

- ADR/RFC files, `status:` front-matter, "Decision/Context/Consequences" structure
- Prose "we chose X over Y because …", "we will adopt …", "deprecating …"
- Capture the **outcome** in `description` (what was decided) and the rationale + alternatives in `detailedDescription`
- A decision that replaces another → the knowledge-linker emits `supersedes` (newer → older)

### Extracting Relationships

See [`references/relationship-patterns.md`](references/relationship-patterns.md) for the full signal catalogue. The core six: `references`/`cites`, `part-of`, `defines`, `depends-on`, `supersedes`, `owned-by`. Detection comes from links/anchors/citations and a small set of prose cues ("Prerequisites", "Superseded by", "Owner:", "see also"). See [`references/entity-rules.md`](references/entity-rules.md) for entity-resolution rules (deduplicating names, resolving wikilinks, merging synonyms).

---

## Part 2 — Proposing Archetypes (Phase 1)

### What makes a good NEW archetype

A proposal should clear all four bars:

1. **Coverage.** It applies to **≥2 distinct nodes** in the analyzed corpus. A one-off doesn't justify a new archetype — use an existing close-fit.
2. **Semantic role.** A clear answer to "what *kind of knowledge* is this on the board." Good: `meeting_note`, `runbook`, `requirement`. Bad: `misc`, `stuff`, `other`.
3. **Observable detection pattern.** Something a future analyzer can detect mechanically — folder convention, front-matter field, heading structure, RFC-2119 language. If a human couldn't write the detection rule in one sentence, the archetype is too vague.
4. **No existing close fit.** Scan the fetched archetype list for synonyms first. If `Decision` exists, don't propose `adr`. If `Document` exists, don't propose `page` unless you're splitting (then use an improvement).

### What makes a good IMPROVEMENT

Four shapes (the `suggestedChange` enum):

| Change | When to use | Required field |
| --- | --- | --- |
| `rename` | Existing name is misleading for actual usage. E.g., `Document` always means a formal spec in this corpus. | `newName` |
| `split` | Same archetype covers ≥2 clearly different sub-populations. Identify the dividing axis. | `splitInto` (≥2 targets) |
| `redescribe` | Description doesn't match how it's used. The name is fine; the docs are misleading. | `newDescription` |
| `merge` | Two archetypes are near-duplicates with no meaningful difference on the board. | `mergeIntoName` |

### How to phrase rationales

Three sentences max. Each does one thing:

1. **Pattern** — what you observed. *"30 nodes typed `Document` split cleanly into normative specs and operational runbooks."*
2. **Impact** — what's worse without the change. *"Today they share an icon, hiding the difference between 'what is true' and 'how to do it'."*
3. **Proposed change** — what specifically would be done. *"Split into `spec` and `runbook`."*

No essays. No marketing language. No "for clarity" without saying *what* clarity, *for whom*.

### What NOT to propose

These all fail review:

- **Project/team/vendor names** as archetypes: `platform_doc`, `notion_page`, `confluence_export`. The archetype describes the *kind of knowledge*, not where it lives or who wrote it. (`runbook` is fine; `sre_team_doc` is not.)
- **Single-node coverage.** If only one document fits the proposed archetype, defer.
- **Archetypes already on the server.** Always check the fetched list first.
- **Board/layer concepts** dressed up as archetypes: `l0_overview`, `subject_board`. Boards have their own hierarchy.
- **Status/lifecycle** masquerading as archetypes: `draft_doc`, `archived_policy`, `deprecated_decision`. Status belongs in tags / `metadata.status`; archetypes describe what a thing *is*, not its lifecycle stage.

### Examples

#### Good — new archetype proposal

```json
{
  "name": "runbook",
  "visualPrimitiveType": "node",
  "description": "An operational procedure — ordered steps to accomplish or recover a task, with prerequisites.",
  "detectionRules": "Files under `/runbooks/` or `/how-to/`, or documents with 'Prerequisites' + ordered imperative steps.",
  "exampleNodeSlugs": ["deploy-process", "incident-response", "db-failover"],
  "sourceContext": { "boardSlug": "overview", "proposedBy": "cdx-work-plugin" }
}
```

Why it passes: ≥2 nodes; clear role (operational procedure); a one-sentence detection rule; `Process` exists but the corpus distinguishes runbooks sharply enough to warrant the split — or, if `Process` already covers it, file a `redescribe` instead.

#### Good — split improvement

```json
{
  "existingArchetypeName": "Document",
  "suggestedChange": "split",
  "rationale": "30 nodes typed `Document` split cleanly into 18 normative specs (RFC-2119 language, numbered requirements) and 12 operational runbooks (ordered steps, 'Prerequisites'). They read and are owned very differently, but share one icon today.",
  "splitInto": [
    { "name": "spec", "description": "A normative specification stating requirements (MUST/SHOULD).", "visualPrimitiveType": "node" },
    { "name": "runbook", "description": "An operational procedure with ordered steps and prerequisites.", "visualPrimitiveType": "node" }
  ],
  "affectedNodeSlugs": ["auth-spec", "export-spec", "…", "deploy-process", "incident-response", "…"],
  "sourceContext": { "boardSlug": "overview", "proposedBy": "cdx-work-plugin" }
}
```

Why it passes: clear dividing axis (normative vs operational); balanced population (18 vs 12); both targets are real archetypes.

#### Bad — too narrow / lifecycle

```json
{
  "name": "draft_design_doc",
  "visualPrimitiveType": "node",
  "description": "A design doc still in draft.",
  "exampleNodeSlugs": ["new-billing-design"]
}
```

Why it fails: lifecycle status (`draft_`) baked into identity; single-node coverage; already covered by a `design_doc` archetype with a `status` tag.

For more examples and edge cases, see [`references/entity-rules.md`](references/entity-rules.md) and [`references/relationship-patterns.md`](references/relationship-patterns.md).
