# Document Genres and Inclusion Patterns

## Overview

Before extracting nodes, profile each document's **genre** — it determines which node archetypes you extract and how. A spec yields `Requirement`s; an ADR yields a `Decision`; a glossary yields `Term`s. This file lists genre signals per format and the inclusion/exclusion/grouping rules that run before any node is created.

## Genre Detection

| Genre | Path signals | Front-matter / heading signals | Prose signals |
| ----- | ------------ | ------------------------------ | ------------- |
| **Spec / standard** | `/specs/`, `/standards/` | "Specification" in title, numbered sections | RFC-2119 "MUST/SHOULD/MAY", numbered requirements |
| **Decision (ADR/RFC)** | `/adr/`, `/rfc/`, `NNNN-*.md` | `status: proposed/accepted/superseded`, "Decision"/"Context"/"Consequences" headings | "we chose X over Y", "Superseded by" |
| **Runbook / how-to** | `/runbooks/`, `/how-to/`, `/playbooks/` | "Prerequisites", "Steps" headings | ordered imperative steps |
| **Policy** | `/policies/`, `/governance/` | "Policy" in title | "must / required / prohibited", compliance framing |
| **Meeting note** | `/notes/`, `/meetings/` | `date:` + `attendees:` front-matter, "Action Items" | dated discussion, "TODO/owner" lines |
| **Glossary** | `/glossary/` | "Glossary" title, definition lists | "X — definition", "X means …" |
| **Design doc** | `/designs/`, `/proposals/` | "Goals/Non-Goals", "Alternatives Considered" | architecture prose, trade-off discussion |
| **Reference / guide** | `/docs/`, `/guides/` | descriptive headings | explanatory prose (the default genre) |

When several signals conflict, prefer the most specific genre (Decision > Policy > Reference). A file under `adr/` with `status: accepted` is a Decision even if it reads like a guide.

## Format-Specific Parsing

### Markdown / MDX
- Title: first `# H1` or front-matter `title:`
- Sections: `##`/`###` headings (slug from the heading text)
- Front-matter: YAML between `---` fences — read `title`, `status`, `owner`/`team`, `date`, `tags`
- Links: `[text](path)`, `[[wikilinks]]`, reference-style `[text][ref]`
- Definitions: bold-term lines `**Term** — …`, or `<dl>`/definition lists

### reStructuredText
- Title: top section underlined with `===`
- Sections: underlined headings (`---`, `~~~`)
- Cross-refs: `:doc:`, `:ref:`, `` `text <url>`_ ``
- Directives: `.. note::`, `.. glossary::` (glossary directive → `Glossary` container)

### AsciiDoc
- Title: `= Document Title`
- Sections: `== `, `=== `
- Cross-refs: `xref:other.adoc[]`, `<<anchor,text>>`
- Attributes: `:status:`, `:owner:` document attributes

### PDF
- Read extractable text; treat each top-level heading as a section boundary
- No extractable text (scanned image): emit a single `Document` node noting contents weren't extractable

### Wiki exports (Confluence / Notion)
- Title: page title in the export metadata or first heading
- Links: resolve internal page references to corpus nodes by title
- Preserve the live URL in `metadata.docUrl`

---

## Exclusion and Grouping Rules

**CRITICAL: Apply these rules BEFORE creating any nodes. They override the classification patterns.**

### Files / Units to EXCLUDE from Node Creation

These must NOT produce nodes. Still read them for relationship inference (links, "see also") and metadata enrichment.

| Pattern | Reason |
|---------|--------|
| Generated tables of contents (`SUMMARY.md`, `_sidebar.md`, `toc.md`) | Navigation, not knowledge |
| Index / redirect stubs (a page that only links elsewhere) | No content of its own — resolve through it |
| License / boilerplate (`LICENSE`, `CODE_OF_CONDUCT` if templated) | Not project-specific knowledge |
| Changelogs without decisions (`CHANGELOG.md` that just lists versions) | Release log, not knowledge (keep it if entries record decisions) |
| Empty headings / dividers (a heading with no prose) | Layout, not a section |
| Asset captions, image-only pages | No prose |
| Auto-generated API reference dumps | Describe code, not human knowledge — out of scope for the work plugin |
| Front-matter-only / redirect files | No body |

### Units to GROUP Under a Container (Glossary)

**Layer scope:** grouping applies at the **overview and domain layers (L0/L1)**. At the **document/detail layers (L2/L3)**, do the opposite — emit one `Term` node per definition so the glossary's structure is visible.

At L0/L1, individual glossary term entries must NOT become individual nodes. Instead:

1. Create ONE `Glossary` container node for the glossary
2. List the term names in its `description` / `detailedDescription`
3. Any edge that would point to an individual term points to the container instead

**Correct container node:**

```json
{
  "slug": "security-glossary",
  "name": "Security Glossary",
  "type": "Glossary",
  "description": "Terms: JWT, refresh token, session, nonce, rotation, audience.",
  "path": "docs/security/glossary.md",
  "parentSlug": "security-domain",
  "detailedDescription": "## Security Glossary\n\nDefinitions for the security subject area.\n\n### Terms\n- **JWT** — JSON Web Token used for access tokens\n- **Refresh token** — long-lived token used to mint new access tokens\n- **Nonce** — single-use value preventing replay",
  "metadata": { "docType": "glossary" }
}
```

**Do NOT create individual term nodes at L0/L1 like this:**
```json
{ "slug": "jwt", "name": "JWT", "type": "Term", "path": "docs/security/glossary.md#jwt" },
{ "slug": "refresh-token", "name": "Refresh Token", "type": "Term", "path": "docs/security/glossary.md#refresh-token" }
```

**Edge targeting:** when a section cites a glossary term, the edge `targetSlug` is `"security-glossary"` (the container) at L0/L1, or the individual `Term` node at L2/L3.

---

## Subject Grouping

**The board itself is the root container at every layer.** Do not create a single all-encompassing `domain_group` wrapping every node — that is redundant. But **multiple subject `domain_group` nodes ARE expected** on most real corpora. Use the board's own `metadata.description`/`metadata.detailedDescription` for corpus-level context.

### DON'T — Single root wrapper
```json
{ "slug": "handbook", "name": "Handbook", "type": "domain_group" },
{ "slug": "auth-spec", "parentSlug": "handbook", ... },
{ "slug": "billing-guide", "parentSlug": "handbook", ... }
```
One container wrapping everything = redundant.

### DON'T — Everything flat
```json
{ "slug": "auth-spec", ... },
{ "slug": "billing-guide", ... },
{ "slug": "onboarding-guide", ... },
{ "slug": "data-retention-policy", ... }
```
No grouping = hard to read once you exceed ~8 nodes.

### DO — Multiple subject groups
```json
{ "slug": "security-domain", "name": "Security", "type": "domain_group" },
{ "slug": "billing-domain", "name": "Billing & Revenue", "type": "domain_group" },
{ "slug": "auth-spec", "parentSlug": "security-domain", ... },
{ "slug": "data-retention-policy", "parentSlug": "security-domain", ... },
{ "slug": "billing-guide", "parentSlug": "billing-domain", ... }
```
Subject groups sit directly on the board (no `parentSlug`). Documents nest inside via `parentSlug`. **Any board with more than ~8 nodes** uses subject groups.

### Detecting Subject Boundaries

| Signal | Example | Action |
|--------|---------|--------|
| Subject folders | `docs/security/`, `docs/billing/` | One container per folder |
| ADR/RFC collection | `adr/` directory | One "Decisions" container |
| Per-team wiki spaces | `wiki/platform/`, `wiki/growth/` | One container per space |
| Topic clusters | docs sharing headings/links/tags | One container per cluster |

### When NOT to Create Subject Containers
- A single flat folder of unrelated notes — no real subjects to group
- Fewer than 3 documents per potential subject — not worth the nesting
- Don't force artificial groupings

### Container vs. Drill-down: Mutual Exclusion (All Layers)

**CRITICAL:** If a subject node will drill down to a child board (`layerBoardSlug` set), it must NOT also be a `domain_group` container with visible children on the current board.

**DON'T** — container that also drills down (children duplicate across layers):
```json
{ "slug": "security-domain", "type": "domain_group", "layerBoardSlug": "root--security-domain" },
{ "slug": "auth-spec", "parentSlug": "security-domain", ... }
```

**DO** — opaque node that drills down:
```json
{ "slug": "security-domain", "type": "<server-archetype>", "layerBoardSlug": "root--security-domain" }
```
No other node has `"parentSlug": "security-domain"`. Its documents live on the child board only.

**DO** — container that groups without drill-down:
```json
{ "slug": "reference-glossaries", "type": "domain_group" },
{ "slug": "security-glossary", "parentSlug": "reference-glossaries", ... },
{ "slug": "billing-glossary", "parentSlug": "reference-glossaries", ... }
```
