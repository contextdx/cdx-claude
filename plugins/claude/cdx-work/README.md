# Cdx Work

The `cdx-work` plugin — knowledge analysis for [ContextDX Portal](https://contextdx.com). Discovers the concepts, documents, decisions, and policies in your document set, classifies them against your org's archetype catalogue, maps how they relate, and syncs the result as a layered **knowledge board** you can review and share.

It is the documents/knowledge analog of the `cdx-code` plugin: where Cdx Code analyzes a codebase into an architecture board, Cdx Work analyzes a knowledge set into a knowledge board — producing the **same** node/edge wire model and syncing through the same engine. The analysis brain is different (concepts, documents, sections, decisions, stakeholders — not imports, frameworks, services); the output JSON shape is identical. Cdx Work runs in **Claude Code** (and is tuned for Claude **Cowork**).

## Install

Add the ContextDX marketplace once, then install the plugin:

```bash
/plugin marketplace add contextdx/cdx-claude
/plugin install cdx-work@contextdx
```

Restart Claude Code so the commands load. Scope the install with `--scope user` (default), `--scope project`, or `--scope local`. Claude **Cowork** installs from the same marketplace.

> `cdx-work` is the install id — everywhere else it's **Cdx Work**.

## Configure

Two ways to connect this document set to a board — both write the same `.contextdx/config.json`:

**Browser login (fastest):** run `/login`. It signs you in through the ContextDX portal, lets you pick a workspace and a board that already has a Code Plugin binding, and writes the config for you — no tokens to copy. Use `/configure`'s "change board" option later to switch boards the same way.

**Manual:** get a **Binding Token** and **API Secret** from the ContextDX Portal (**Sources → Add Source → Board Builder** — saving generates the secret), then create `.contextdx/config.json` at the root of your document set:

```json
{
  "bindingToken": "your-base64url-binding-token",
  "apiSecret": "ck_cp_live_your_api_secret",
  "boardSlug": "engineering-handbook-overview",
  "branch": "main",
  "baseUrl": "https://platform.contextdx.com/api"
}
```

| Field | Required | Notes |
|---|---|---|
| `bindingToken` | yes | Base64url `orgId:bindingId` from the portal. Sent as `X-CodePlugin-Token`. |
| `apiSecret` | yes | Must start with `ck_cp_live_`. Sent as `X-CodePlugin-Secret`. |
| `boardSlug` | yes | Target knowledge board. `/configure` can discover and write it for you. |
| `branch` | yes | For git-tracked docs, must match the binding (or `/sync` returns `400 Branch Mismatch`). |
| `baseUrl` | no | Override for self-hosted (default `https://platform.contextdx.com/api`). |
| `excludePaths` | no | Paths skipped during analysis (e.g. `node_modules`, build output). |
| `includeSourceReferences` | no | Attach document path/anchor + excerpt to synced nodes/edges (default `true`). |

Run `/configure` to validate the config, test the connection, and add `.contextdx/` to your `.gitignore`. Credentials live only in this file — never logged, and sent only to `platform.contextdx.com`.

> **Testing against a non-production server:** set `CONTEXTDX_BASE_URL` (or pass `--base-url` to the CLI scripts) to point every command — including `/login`'s device handshake — at a staging or local API. The browser login and app URLs then follow from that server's configuration, so nothing is pinned to production. `baseUrl` in `.contextdx/config.json` overrides it per repo.

## Supported document formats

Automatically discovers documents across common formats and locations (`docs/`, `wiki/`, `rfcs/`, `adr/`, `specs/`, `policies/`, `notes/`, root `*.md`):

| Format | Extensions | Typical content |
|---|---|---|
| **Markdown / MDX** | `.md`, `.mdx`, `.markdown` | Wikis, READMEs, RFCs, ADRs, design docs |
| **reStructuredText** | `.rst` | Sphinx / Python documentation |
| **AsciiDoc** | `.adoc`, `.asciidoc` | Technical manuals, books |
| **Plain text** | `.txt` | Notes, exports |
| **Wiki exports** | `.md` / `.html` | Confluence, Notion spaces |
| **PDF** | `.pdf` | Specs, policies (extractable text) |

Mixed corpora (specs + ADRs + runbooks + notes in one tree) produce a unified board with cross-document relationships (references, citations, supersession, ownership).

## Quick start

The plugin uses a **two-phase workflow**: first settle the archetype vocabulary, then describe the knowledge set.

1. `/login` (browser) or `/configure` (manual) — connect to the portal (one-time per document set)
2. `/analyze-archetypes` — **Phase 1**: scan for the kinds of knowledge present, surface gaps in the server archetype catalogue, submit proposals for admin review
3. `/analyze-docs` — **Phase 2**: full knowledge analysis (incremental — only changed documents re-analyzed)
4. `/sync` — push the analysis to your board
5. `/insights` — run server-defined analyses against the board
6. `/status` — see what's analyzed, the archetype precondition state, and what's synced

If `/analyze-docs` is invoked before `/analyze-archetypes` has run for the current document set + catalogue state, it prompts you to run Phase 1 first.

The operational commands — `/login`, `/configure`, `/status`, `/sync`, `/insights`, `/intents`, `/help`, `/demo-insights` — are **shared** with `cdx-code` and behave identically. Only `/analyze-docs` and `/analyze-archetypes` carry the knowledge-specific analysis brain.

## Commands

| Command | Description |
|---|---|
| `/login` | Browser sign-in: pick a workspace + bound board, writes config automatically |
| `/configure` | Set up portal credentials manually, or switch to a different board |
| `/analyze-archetypes` | Phase 1 — scan for archetype gaps, submit proposals if needed |
| `/analyze-archetypes --dry-run` | Validate scan locally + ask server to dry-run, don't persist or POST |
| `/analyze-archetypes --skip-submit` | Write the proposals file for manual review; don't POST |
| `/analyze-archetypes --replace` | When submitting, send `mode='replace'` to overwrite pending payload |
| `/analyze-docs` | Phase 2 — analyze the document set (incremental; re-analyzes only changed docs) |
| `/analyze-docs --clean` | Full re-analysis from scratch, ignoring existing board data |
| `/analyze-docs --drill <board>/<node>` | Drill into a node (e.g. a subject area or document) to produce a child layer board |
| `/analyze-docs --all` | Re-analyze every layer board in the manifest |
| `/sync [--board <slug>]` | Push analysis to portal (smart diff: only changed elements) |
| `/sync --all` | Push every board in the manifest |
| `/insights` | List available insight skills and run one against the current board |
| `/insights <skill-slug>` | Run a specific insight skill directly |
| `/insights --all` | Run every available insight skill |
| `/intents` | Pull architect-authored intents (work items) for the board and pick one to implement |
| `/intents <intentId>` | Claim, implement, verify, and resolve a specific intent (write-capable — edits project files) |
| `/demo-insights [count] [--board <slug>]` | Seed a board with a few demonstrative, path-rich insights to showcase the insights feature |
| `/status` | Show config state, archetype precondition, analysis summary, and per-board sync status |

## Layered boards

For non-trivial knowledge sets, `/analyze-docs` produces a hierarchy of boards so you can navigate from a 10–30 node overview down to a single document's internal structure without overwhelming any single view:

| Layer | Name | Scope | Target node count |
|---|---|---|---|
| **L0** | Overview | Entire knowledge base / corpus | 10–30 |
| **L1** | Domain | One subject area / doc collection | 10–40 per board |
| **L2** | Document | One document or spec drill-down | 5–20 per board |
| **L3** | Detail | Deep section/decision internals (opt-in) | 5–15 per board |

Board hierarchy and per-board sync state live in `.contextdx/boards/`:

- `manifest.json` — every board's slug, layer, parent, and analysis state
- `<board-slug>.json` — analysis output (nodes + edges) for that board
- `stores/<board-slug>.store.json` — sync state, content hashes, last push

## Node / edge model

A **node** is a unit of knowledge; an **edge** is a relationship between two.

**Node archetypes (detection categories):**

| Archetype | What it is |
|---|---|
| `Document` | A whole page/file with a clear subject |
| `Section` | A meaningful sub-part of a document (L2/L3) |
| `Concept` | An idea defined and referenced across the corpus |
| `Decision` | A recorded choice (ADR / RFC) |
| `Policy` | A rule of conduct or governance requirement |
| `Process` | A procedure / runbook |
| `Requirement` | A normative obligation (MUST / SHALL) |
| `Stakeholder` | A person/team that owns knowledge |
| `Term` / `Glossary` | A definition / the container of definitions |

**Edge archetypes:**

| Type | Meaning |
|---|---|
| `references` / `cites` | A doc/section links to, or quotes, another |
| `part-of` | Containment: section→document, document→collection, term→glossary |
| `defines` | A glossary/section establishes a concept's meaning |
| `depends-on` | A requirement/process relies on a prerequisite |
| `supersedes` | A newer decision replaces an older one (newer → older) |
| `owned-by` | A document/policy/process is owned by a stakeholder |

The node/edge `type` holds the server **archetype name** assigned by the analyzer. The work-board archetype catalogue is **server-defined per board "kind"** and may still be settling — the analyzer picks the closest fit and the two-phase workflow proposes genuine gaps.

## Archetypes (server-defined, precondition-driven)

Knowledge units are classified using archetypes defined on your ContextDX server, **not** a fixed list shipped with the plugin. `/analyze-docs` fetches the current catalogue and the document-analyzer agent assigns each discovered node a valid archetype name.

If your corpus has patterns that don't fit any existing archetype well (e.g., it introduces formal runbooks where the catalogue only has a generic `Document`), `/analyze-archetypes` surfaces them **before** any board is produced and submits proposals (new archetypes or improvements to existing ones) for human review. The catalogue gets settled first so every node on the board gets a fit archetype — no misfits, no post-hoc retyping.

The two-phase split (`/analyze-archetypes` then `/analyze-docs`) is the supported workflow. `/analyze-docs` will detect a stale or missing precondition and prompt to run Phase 1 first.

## Output format

Analysis output at `.contextdx/boards/<board-slug>.json`:

```json
{
  "metadata": {
    "analyzedAt": "2026-05-13T10:30:00Z",
    "analyzedAtCommit": "docset-sha256-7f3a…",
    "projectName": "engineering-handbook",
    "boardSlug": "engineering-handbook-overview",
    "layer": 0
  },
  "nodes": [
    {
      "slug": "auth-token-rotation",
      "name": "Auth Token Rotation",
      "type": "Decision",
      "description": "ADR-014 — rotate access tokens every 15 minutes.",
      "path": "docs/security/auth.md#token-rotation",
      "parentSlug": "security-domain",
      "metadata": { "docUrl": "https://wiki/security/auth", "docType": "adr", "status": "accepted" }
    }
  ],
  "edges": [
    {
      "sourceSlug": "auth-token-rotation",
      "targetSlug": "adr-0012-jwt",
      "type": "supersedes",
      "metadata": { "citation": "0014-rotation.md front-matter: Supersedes: 0012" }
    }
  ]
}
```

For a document node, `path` is a **document path/anchor** (e.g. `docs/security/auth.md#token-rotation`) and `metadata.docUrl` links to the live doc — not a git ref or code path. `analyzedAtCommit` is a content digest of the analyzed document set (or a git HEAD when the docs are git-tracked).

## Source references

When `includeSourceReferences` is enabled in `.contextdx/config.json`, nodes and edges carry document source references — the source `path`/anchor, a `docUrl`, and a short quoted excerpt in `detailedDescription` — so a reader can trace any claim back to the text. Excerpts are quoted **document text**, never code. If the corpus is sensitive, set `includeSourceReferences: false`; analysis still runs and only the paths/excerpts are omitted.

## Agents

| Agent | Role |
|---|---|
| **document-analyzer** | Document-set discovery, genre detection, archetype classification, subject grouping, hierarchy building |
| **knowledge-linker** | Links, anchors, citations, ownership, supersession — builds the relationship edges |

`/analyze-docs` orchestrates both agents. They can also be invoked directly from Claude Code's subagent picker to debug a specific analysis step.

## Requirements

- Node.js (for the bundled CLI scripts)
- A ContextDX Portal account with a Board Builder source bound to your knowledge board
- A document set in one of the supported formats (git is optional — incremental analysis works from a content digest when docs aren't git-tracked)

## License

BUSL-1.1
