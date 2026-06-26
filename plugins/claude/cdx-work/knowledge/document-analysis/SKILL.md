---
name: document-analysis
user-invokable: false
description: Analyzes a document/knowledge set (markdown, wikis, specs, RFCs, ADRs, runbooks, policies, meeting notes, design docs) to extract knowledge nodes, their hierarchy, and relationships for a knowledge board. Use when user asks to "analyze documentation", "map our knowledge base", "structure this wiki", "extract concepts from docs", or "build a knowledge board". Emits the same node/edge wire model as code architecture analysis, but for documents — never code.
license: MIT
compatibility: Claude Code plugin. Requires Node.js 18+ for bundled scripts.
metadata:
  author: ContextDx
  version: 0.1.0
---

# Knowledge Analysis for Document Visualization

## Overview

This skill provides guidance for analyzing a document/knowledge set to extract its architecture: the documents, the concepts they carry, the decisions and policies they record, and the relationships between them. The analysis produces nodes (knowledge units) and edges (relationships) suitable for a knowledge board — the documents/knowledge analog of a C4-style architecture diagram.

The output wire model is **identical** to the code plugin's: `metadata`, `nodes[]`, `edges[]`, `drillDownNodes[]`, written to `.contextdx/boards/<board-slug>.json` and synced via the same engine. Only the analysis brain differs — concepts and documents instead of services and imports.

## Supported Document Formats

| Format | Extensions | Typical content |
| ------ | ---------- | --------------- |
| **Markdown / MDX** | `.md`, `.mdx`, `.markdown` | Wikis, READMEs, RFCs, ADRs, design docs |
| **reStructuredText** | `.rst` | Sphinx / Python documentation |
| **AsciiDoc** | `.adoc`, `.asciidoc` | Technical manuals, books |
| **Plain text** | `.txt` | Notes, exports |
| **Wiki exports** | `.md`/`.html` from Confluence, Notion | Team knowledge spaces |
| **PDF** | `.pdf` | Specs, policies (extractable text only) |

## What Counts as a Node

A node is a unit of knowledge worth showing on the board — a document, a meaningful section, a concept, a decision, a policy, a process, a requirement, a stakeholder, or a term. **Not** every heading and not every paragraph: navigation chrome, generated tables of contents, license boilerplate, and link-only stubs are excluded. See `references/document-patterns.md` for the full inclusion/exclusion rules.

The granularity depends on the layer:

- **L0/L1**: coarse — one `Document` per file, one `Concept` per cross-cutting idea, one `Glossary` per glossary.
- **L2/L3**: fine — decompose a single document into its `Section`s, `Decision`s, `Requirement`s, and `Term`s.

## The Work Archetype Vocabulary

These are the **detection categories** for knowledge nodes. The actual `type` value written to the board must be a valid **server-defined** archetype name fetched in Step 0 of `/analyze-docs` — pick the closest fit. The catalogue is server-defined per board "kind" and may still be settling; `/analyze-archetypes` proposes genuine gaps.

| Category | Purpose | Signals |
| -------- | ------- | ------- |
| `Document` | A whole page/file with a clear subject | A titled file of prose |
| `Section` | A meaningful sub-part of a document | An `##`/`===` heading with substantive prose |
| `Concept` | A defined idea referenced across the corpus | "What is X", recurring noun phrase, a defined term |
| `Decision` | A recorded choice (ADR/RFC) | "Decision", `status: accepted`, "we chose X over Y" |
| `Policy` | A rule/requirement of conduct | "must/required", governance/compliance language |
| `Process` | A procedure / runbook | Ordered steps, "to do X: 1… 2… 3…" |
| `Requirement` | A normative obligation | "MUST/SHALL", REQ-IDs, acceptance criteria |
| `Stakeholder` | A person/team that owns knowledge | `Owner:`/`Team:` fields, RACI tables, by-lines |
| `Term` | A glossary definition | Definition lists, "X means …" |
| `Glossary` | A container of terms (L0/L1 grouping) | A glossary file / definition section |
| `domain_group` | A subject-area container | A subject folder / topic cluster |

See `references/node-archetypes.md` for detection priority, granularity-by-layer rules, and slug generation.

## How to Layer Knowledge Boards

Large knowledge sets are analyzed progressively. Each board scopes a portion of the corpus at appropriate granularity:

| Layer | Scope | Target nodes |
| ----- | ----- | ------------ |
| **L0** | Whole corpus — subject areas, keystone docs, cross-cutting concepts | 10-30 |
| **L1** | One subject area / document collection | 10-40 per board |
| **L2** | One document or spec — its sections, decisions, requirements | 5-20 per board |
| **L3** | Deep detail of one section/decision (opt-in) | 5-15 per board |

The board itself is the root container — never wrap everything in one `domain_group`. Use multiple subject groups for logical grouping when a board exceeds ~8 nodes. A node that drills down (`layerBoardSlug` set) must be **opaque** — no other node has `parentSlug` pointing to it. See `references/layer-strategy.md` for full layering rules, slug resolution, and the manifest structure.

## Relationship Detection

The knowledge-linker agent builds edges. Detection categories:

| Relationship | Detection pattern |
| ------------ | ----------------- |
| `references` | Markdown/wiki links, `xref:`, "see also" |
| `cites` | Footnote citations, quoted sources |
| `part-of` | Section→document, document→collection, term→glossary |
| `defines` | Glossary/section establishes a concept's meaning |
| `depends-on` | "Prerequisites/Requires/Builds on" a concept/policy/decision |
| `supersedes` | ADR "Superseded by", versioned replacement (newer → older) |
| `owned-by` | `owner:`/`team:` fields, RACI "Accountable" |

## Source References

When `includeSourceReferences` is enabled in `.contextdx/config.json`, each node and edge should carry a **document source reference** so a reader can trace a claim back to the text:

- **`path`** (node): the source document plus optional anchor — e.g. `docs/security/auth.md#token-rotation`. This is a document path/anchor, **not** a git ref or code path.
- **`metadata.docUrl`** (node): a link to the live document (wiki/Notion/Confluence URL) when known.
- **`detailedDescription`** excerpt: a short representative quote from the source, with its section anchor. Excerpts are quoted **document text** — never code snippets, never file contents that contain secrets.
- **`metadata.anchor` / `metadata.citation`** (edge): the anchor or `doc §section` the relationship was derived from.

> **Privacy note.** Source references send document paths, anchors, URLs, and short excerpts to ContextDX. If the corpus is sensitive, set `includeSourceReferences: false` in config — analysis still runs; only the excerpts/paths are omitted.

## Handling Large Document Sets

For corpora with hundreds of documents:

1. **Layer aggressively.** Keep L0 to 10-30 nodes — one node per subject area, the handful of keystone documents, and the cross-cutting concepts. Push everything else to L1 drill-downs.
2. **Group, don't enumerate.** At L0/L1, group glossary terms under one `Glossary` container; group a folder of similar docs under one subject `domain_group` or a single opaque drill-down node.
3. **Profile before extracting.** Read front-matter and headings first (cheap); only read full bodies for the documents you'll turn into multi-node L2 boards.
4. **Use incremental mode.** After the first full analysis, `/analyze-docs` re-analyzes only documents whose content hash changed since the last run (tracked via the doc-set digest in `analyzedAtCommit`). See `references/layer-strategy.md` → "Incremental Re-Analysis".
5. **Exclude noise.** Generated TOCs, changelogs, redirect stubs, and license files never become nodes.

## Analysis Workflow

### Step 1: Document-Set Detection
1. Glob document roots (`docs/`, `wiki/`, `rfcs/`, `adr/`, `specs/`, `policies/`, `notes/`, root `*.md`); honour `docRoots` in config
2. Enumerate files by supported extension; skip generated output and vendored docs
3. Identify collection boundaries — these become L1 domains

### Step 2: Corpus Profiling
1. Read front-matter and headings for title, owner, status, date
2. Detect each document's genre (spec / ADR / runbook / policy / note / glossary / design doc)
3. Create subject `domain_group` containers when the board will exceed ~8 nodes

### Step 3: Knowledge Discovery
1. Apply exclusion/grouping rules first
2. Classify remaining knowledge units by archetype using server names
3. Build the hierarchical node structure (subject → document → section/decision/term)

### Step 4: Relationship Mapping
1. Parse links, anchors, citations, ownership fields
2. Resolve targets to node slugs
3. Classify relationship types (references / part-of / defines / depends-on / supersedes / owned-by)

### Step 5: Output
1. Write nodes + edges + metadata to the board JSON
2. Record the doc-set digest as `analyzedAtCommit`
3. Update the manifest

## Output Format

### Node Format

```json
{
  "slug": "auth-token-rotation",
  "name": "Auth Token Rotation",
  "type": "Decision",
  "description": "ADR-014 — rotate access tokens every 15 minutes.",
  "path": "docs/security/auth.md#token-rotation",
  "parentSlug": "security-domain",
  "layerBoardSlug": null,
  "detailedDescription": "## Auth Token Rotation\n\nADR-014 establishes a 15-minute rotation window for access tokens.\n\n### Key Points\n- Tokens rotate at least every 15 minutes\n- Refresh handled by the session service\n\n### Source\n- **Document:** `docs/security/auth.md` §3.2\n- **Status:** accepted\n\n> Tokens MUST be rotated at least every 15 minutes.",
  "metadata": {
    "docUrl": "https://wiki/security/auth",
    "docType": "adr",
    "status": "accepted"
  }
}
```

**Required fields:** `slug`, `name`, `type`, `description`, `detailedDescription`
**Optional fields:** `path`, `parentSlug`, `layerBoardSlug`, `metadata`

### Edge Format

```json
{
  "sourceSlug": "auth-token-rotation",
  "targetSlug": "adr-0012-jwt",
  "type": "supersedes",
  "detailedDescription": "ADR-014 supersedes ADR-012's token-lifetime decision, shortening the window from 24h to 15m.",
  "metadata": {
    "citation": "0014-rotation.md front-matter: Supersedes: 0012"
  }
}
```

### Description Fields

**`description`** (required, top-level): Brief one-line summary, max 500 characters. Displayed as subtitle in the UI.

**`detailedDescription`** (required, top-level): Rich **Markdown** content providing full context. Every node and edge MUST have one.

**For node detailedDescription, include:**
- What the document/section/decision says and why it matters
- Key points or the specific choice made
- Source document path + section, status/owner where known
- A short quoted excerpt (when `includeSourceReferences` is on)

**For edge detailedDescription, include:**
- The nature of the relationship (reference, containment, definition, dependency, supersession, ownership)
- Direction and the anchor/citation it was derived from

> **Note:** Do NOT put `description` inside `metadata`. Both `description` and `detailedDescription` are top-level node fields.

## Examples

### Example 1: Analyze an engineering handbook
User says: "Analyze our docs folder"

Actions:
1. Fetch available archetypes from ContextDX
2. Detect document roots and collections (`docs/security/`, `docs/billing/`, `docs/onboarding/`)
3. Profile genres (specs, ADRs, runbooks, policies)
4. Discover knowledge nodes and classify by archetype
5. Map references, part-of, defines, depends-on, supersedes, owned-by edges
6. Write analysis to `.contextdx/boards/<board-slug>.json`

Result: A knowledge overview board with 15-25 nodes (subject areas, keystone docs, cross-cutting concepts) and relationship edges, saved to the board JSON.

### Example 2: Incremental re-analysis after edits
User says: "Re-analyze the docs"

Actions:
1. Load existing board data and the doc-set digest (`analyzedAtCommit`)
2. Recompute the digest; find documents whose content hash changed
3. Re-analyze only changed documents, merge into existing board data
4. Update the digest

Result: Updated analysis with minimal re-processing — only changed documents' nodes updated.

## Troubleshooting

### Error: No archetypes available
**Cause:** ContextDX configuration missing or API unreachable
**Solution:** Run `/configure` to set up credentials, then retry

### Error: No board slug configured
**Cause:** Configuration exists but `boardSlug` field is missing
**Solution:** Run `/configure` — the root board will be auto-discovered from the server

### Error: Analysis produces no nodes
**Cause:** Document roots may all be in excluded paths, or the corpus is empty of supported formats
**Solution:** Check `docRoots` / `excludePaths` in `.contextdx/config.json` and adjust

## Additional Resources

### Reference Files

- **`references/node-archetypes.md`** — node archetype vocabulary, detection priority, granularity by layer, slug generation
- **`references/document-patterns.md`** — genre detection, inclusion/exclusion and grouping rules per format
- **`references/layer-strategy.md`** — board layering, drill-down candidates, slug resolution, manifest, incremental re-analysis
