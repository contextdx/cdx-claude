# Knowledge Node Archetypes

## Overview

Archetypes categorize knowledge units into functional roles on the board. Classification uses a priority-based system where more specific patterns take precedence.

**Important:** Archetype names are defined by the server. Before analysis, fetch available archetypes via the `cdx-archetypes.js` CLI (see `/analyze-docs` Step 0). The categories below (Document, Section, Concept, …) are detection heuristics — the `type` field in the output must use a valid server archetype name from the fetched list, not these internal category names. The work-board catalogue is server-defined per board "kind" and may still be settling; pick the closest fit and let `/analyze-archetypes` propose gaps.

## Semantic Detection Categories

### Document

**Definition**: A whole page or file with a clear subject — the unit a reader opens.

**Detection Priority (highest to lowest)**:
1. A file with a single `# Title` and substantive prose
2. A file whose genre isn't one of the more specific categories below (it's "just a doc")
3. A wiki page or exported article

**Examples**: `onboarding.md` → "Onboarding Guide", `architecture.md` → "System Architecture"

---

### Section

**Definition**: A meaningful sub-part of a document — used mainly at L2/L3 when decomposing a document.

**Detection Priority**:
1. An `##`/`###` (Markdown), `==`/`===` (AsciiDoc), or underlined (RST) heading
2. With substantive prose under it (not a one-line divider or a pure list of links)

**Examples**: `auth.md#token-rotation` → "Token Rotation", `spec.md#error-handling` → "Error Handling"

> At L0/L1, do **not** emit Section nodes — keep one `Document` node per file. Decompose into sections only when drilling into the document at L2/L3.

---

### Concept

**Definition**: An idea referenced across the corpus — the noun phrases the knowledge set is "about".

**Detection Priority**:
1. A defined term ("X is …", "We define X as …", glossary entry)
2. A "What is X?" / "Overview of X" section
3. A noun phrase that recurs across ≥2 documents and is central to the subject

**Examples**: "Idempotency", "Tenant Isolation", "Eventual Consistency"

---

### Decision

**Definition**: A recorded choice with rationale — an ADR or RFC.

**Detection Priority**:
1. A file under `adr/` or `rfc/`, or named `NNNN-*.md`
2. Front-matter `status: proposed|accepted|superseded|rejected`
3. "Decision" / "Context" / "Consequences" headings
4. Prose "we chose X over Y because …"

**Examples**: `0014-rotation.md` → "Rotate Tokens Every 15m", `rfc-007-eventing.md` → "Adopt Event Sourcing"

---

### Policy

**Definition**: A rule of conduct or governance requirement.

**Detection Priority**:
1. A file under `policies/`, or "Policy" in the title
2. "must / required / prohibited" governance language
3. Compliance/legal framing (data retention, access control, code of conduct)

**Examples**: `data-retention.md` → "Data Retention Policy", `access-control.md` → "Access Control Policy"

---

### Process

**Definition**: A procedure or runbook — how to do something, step by step.

**Detection Priority**:
1. A file under `runbooks/` or `how-to/`
2. Ordered/numbered steps with imperative verbs
3. "Prerequisites" + "Steps" structure

**Examples**: `deploy.md` → "Deploy Process", `incident-response.md` → "Incident Response Runbook"

---

### Requirement

**Definition**: A normative obligation in a spec.

**Detection Priority**:
1. RFC-2119 keywords ("MUST / SHALL / SHOULD")
2. Numbered requirement IDs (REQ-12, FR-3)
3. Acceptance-criteria lists ("Given/When/Then")

**Examples**: "REQ-12: Tokens MUST rotate every 15m", "FR-3: Export MUST be CSV"

---

### Stakeholder

**Definition**: A person or team that owns or is accountable for knowledge.

**Detection Priority**:
1. Front-matter `owner:` / `team:`
2. `Owner:` / `Maintainer:` line in the body
3. RACI table "Accountable" column
4. Consistent author by-line that implies ownership

**Examples**: "Security Team", "Platform Guild", "Jane Doe (DRI)"

---

### Term / Glossary

**Definition**: A `Term` is a single definition; a `Glossary` is the container of terms.

**Detection Priority**:
1. A file named/titled "Glossary", or a definition-list section → `Glossary` container
2. Each `**Term** — definition` / definition-list entry → a `Term` (L2/L3 only)

**Examples**: `glossary.md` → "Security Glossary"; entries "JWT", "Refresh Token", "Nonce"

---

## Granularity by Layer

| Layer | Document | Section | Concept | Decision/Policy/Process | Requirement | Term |
| ----- | -------- | ------- | ------- | ----------------------- | ----------- | ---- |
| **L0** | one node per keystone doc only | — | cross-cutting only | one node per major one | — | grouped in `Glossary` |
| **L1** | one node per doc | — | per-subject | one node each | grouped per doc | grouped in `Glossary` |
| **L2** | the drilled doc | one per heading | per-section | one node each | one per REQ | one per `Term` |
| **L3** | — | one per sub-section | per-point | the drilled decision | one per acceptance criterion | one per `Term` |

Rule of thumb: coarser at the top, finer as you drill. Never emit hundreds of `Section`/`Term` nodes on an L0 board.

---

## Classification Algorithm

### Step 1: Genre then Pattern
1. Determine the document's genre (see `document-patterns.md`)
2. Within that genre, match the unit to a category by path → front-matter → headings → prose

### Step 2: Context Consideration
If ambiguous, consider:
- What does this document link to, and what links to it?
- What is the parent folder's subject?
- Is this defining something (Concept/Term) or recording a choice (Decision)?

### Step 3: LLM Fallback
For documents that don't match patterns:
1. Read the body
2. Classify by purpose (is it deciding, requiring, defining, instructing, or describing?)
3. Provide the parent folder as context

### Step 4: Manual Override
Allow front-matter overrides:
- `archetype: Decision` in YAML front-matter
- `<!-- contextdx:archetype=Policy -->` comment

---

## Slug Generation

### Algorithm

1. **Source**: Start from the document title (`# Title`, front-matter `title:`) or the defined concept/term name.
2. **Convert to kebab-case**: "Auth Token Rotation" → `auth-token-rotation`, "Data Retention Policy" → `data-retention-policy`.
3. **Sections**: `<document-slug>-<heading-slug>` → `auth-token-rotation` for `auth.md#token-rotation`.
4. **Decisions**: keep the ADR/RFC number for stability → `adr-0014-rotation`, `rfc-007-eventing`.
5. **Subject containers**: `<subject>-domain` → `security-domain`, `billing-domain`.
6. **Glossary**: `<subject>-glossary` → `security-glossary`.
7. **Fallback**: `<folder>-<filename>` without extension → `/security/auth.md` → `security-auth`.
8. **Max length**: 60 characters — truncate long titles.
9. **Never** use raw file paths, anchors, hashes, or opaque identifiers as slugs.

### Name Field

- Use the human-readable title: "Auth Token Rotation", "Data Retention Policy", "Security Glossary".
- Derived from the document title or term, in title case with spaces.
- Never use raw file names like `0014-rotation.md` as the display name — use the decision's title.

---

## Edge Cases

### Hybrid Documents
A document that both decides and instructs (an ADR with a runbook appended):
- Prefer the primary purpose for the top-level node (Decision)
- Emit the runbook as a `Process` section node when drilling into it at L2

### Notes That Decide
A meeting note that records an accepted decision:
- Emit a `Decision` node for the decision itself (so it shows in decision views)
- Optionally keep the note as a `Document` node and link `decision references note`

### Concept vs Term
- `Term`: a short glossary definition (one or two sentences) → grouped under `Glossary`
- `Concept`: an idea elaborated across sections/documents → its own node, often a drill-down target

---

## Relationship Inference from Detection Categories

| Source Category | Target Category | Likely Relationship |
|-----------------|-----------------|---------------------|
| Section | Document | `part-of` |
| Document | Subject group | `part-of` |
| Term | Glossary | `part-of` |
| Glossary / Section | Concept | `defines` |
| Process / Requirement | Concept / Policy | `depends-on` |
| Decision | Decision (older) | `supersedes` |
| Document / Policy / Process | Stakeholder | `owned-by` |
| Document | Document | `references` / `cites` |

**Note:** Edge `type` values must also use valid server archetype names for edges (fetched from the archetypes CLI).
