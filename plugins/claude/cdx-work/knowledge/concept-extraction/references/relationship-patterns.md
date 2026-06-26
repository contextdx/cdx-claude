# Relationship Extraction Patterns

The full signal catalogue for turning links, anchors, citations, and prose into edges. See [`../SKILL.md`](../SKILL.md) for the extraction overview and `../../document-analysis/references/node-archetypes.md` for relationship inference from node categories. The knowledge-linker agent applies these patterns.

## The six core relationships

| Type | Direction | One-line meaning |
| ---- | --------- | ---------------- |
| `references` | citing → cited | A doc/section points at another |
| `cites` | quoting → source | A doc quotes/footnotes another as a source |
| `part-of` | child → parent | Containment (section→doc, doc→collection, term→glossary) |
| `defines` | definer → concept | Establishes a concept/term's canonical meaning |
| `depends-on` | dependent → prerequisite | Relies on a concept/policy/decision being true/read first |
| `supersedes` | newer → older | Replaces an earlier decision/spec |
| `owned-by` | artifact → stakeholder | Accountability for a doc/policy/process |

## Link & citation signals (references / cites)

| Signal | Example | Edge |
| ------ | ------- | ---- |
| Markdown link to another doc | `[auth spec](../security/auth.md)` | `references` |
| Wikilink | `[[Auth Spec]]`, `[[Auth Spec#Rotation]]` | `references` |
| RST/AsciiDoc cross-ref | `:doc:\`auth\``, `xref:auth.adoc[]` | `references` |
| "see also", "per", "as described in [doc]" | "see also the rotation policy" | `references` |
| Footnote citation | `[^1]` → `[^1]: NIST SP 800-63B` (external) | external — record in metadata, no node unless the source is in-corpus |
| Block quote attributed to a doc | `> … — auth.md §3` | `cites` |

Filter out navigation chrome (TOC, pagers, breadcrumbs, "edit this page") before emitting.

## Containment signals (part-of)

| Signal | Edge |
| ------ | ---- |
| A `##`/`===` heading's section node | `Section → Document` |
| A file inside a subject folder | `Document → subject domain_group` |
| A glossary term entry | `Term → Glossary` |
| A nested numbered item (REQ-1.2 under REQ-1) | `Requirement → Requirement` |

`part-of` edges are usually emitted implicitly from the hierarchy the document-analyzer built (`parentSlug`), but the knowledge-linker should still emit explicit `part-of` edges where containment crosses the document boundary (e.g. document → subject area).

## Definition signals (defines)

| Signal | Edge |
| ------ | ---- |
| Glossary/term entry for a concept | `Glossary/Term → Concept` |
| "X is …", "X means …", "We define X as …" | the containing `Section → Concept` |
| A canonical "What is X?" section | that `Section → Concept X` |

Only the **first/canonical** definition emits `defines`. Later restatements emit `references` to avoid competing definitions.

## Dependency signals (depends-on)

| Prose cue | Edge |
| --------- | ---- |
| "Prerequisites:", "Requires:", "Before you begin" | `Process/Requirement → prerequisite` |
| "Assumes you have read [doc]" | `Document → prerequisite Document` |
| "Builds on [decision]", "per the [policy]" | `node → cited policy/decision` |
| A runbook step that needs a concept defined elsewhere | `Process → Concept` |

Distinguish `depends-on` (a real prerequisite) from `references` (a passing mention). "See the glossary" is `references`; "you must first complete onboarding" is `depends-on`.

## Supersession signals (supersedes)

| Signal | Edge (always newer → older) |
| ------ | --------------------------- |
| ADR front-matter `Supersedes: 0012` | `this → 0012` |
| ADR front-matter `Superseded by: 0014` | `0014 → this` (follow the pointer) |
| `status: superseded` + "Superseded by [link]" | follow the link; `newer → this` |
| "This replaces …", "Deprecates RFC-7" | `source → named target` |
| Versioned titles (`Policy v2`) when both versions are present | `v2 → v1` |

Supersession chains (0012 ← 0014 ← 0021): emit one edge per adjacent pair (0021→0014, 0014→0012), never transitive shortcuts. If two decisions each claim to supersede the other, keep the one supported by the newer date/status and flag the conflict.

## Ownership signals (owned-by)

| Signal | Edge |
| ------ | ---- |
| Front-matter `owner:` / `team:` | `Document → Stakeholder` |
| `Owner:` / `Maintainer:` line in body | same |
| RACI table "Accountable" column | `artifact → accountable Stakeholder` |
| Consistent author by-line implying ownership | `Document → author Stakeholder` |

Resolve the named owner to a single normalized `Stakeholder` node (see `entity-rules.md` → "Stakeholder resolution"). If the owner can't be resolved to a node, skip the edge and note it — don't invent a stakeholder.

## Edge filtering (applies to all types)

1. **Deduplicate** — one edge per unique `source → target → type`.
2. **Skip navigation-only links** — TOC, pagers, breadcrumbs, "edit this page".
3. **Resolve through index/redirect stubs** to the real target.
4. **Skip edges to excluded nodes** (TOC, license, stub).
5. **Redirect to grouped containers at L0/L1** — a link to a glossary term targets the `Glossary` container; at L2/L3 it targets the individual `Term`.
6. **Hub suppression** — a "Home/Index" page with >15 inbound `references` is a navigation hub; suppress those `references` edges (keep `defines`/`depends-on`/`supersedes`/`owned-by` regardless of fan-in).
7. **Board scope** — only emit edges between nodes that exist on the current board; skip cross-board links.

## Capturing provenance

Every edge should carry the signal it came from, for traceability:

```json
{
  "sourceSlug": "incident-response",
  "targetSlug": "session-management",
  "type": "depends-on",
  "detailedDescription": "The incident-response runbook requires the session-management concept (step 3 invalidates sessions).",
  "metadata": { "anchor": "#step-3", "citation": "incident-response.md §Steps" }
}
```
