---
category: map
description: "Map · Extract and adopt a code aspect (database schema, API surface, frontend pages, event catalog, or authz registry) onto the bound board"
argument-hint: "[--aspect <kind> | --db | --api] [--mode replace|merge] [--dry-run]"
allowed-tools: Read, Glob, Grep, Write, Bash(node:*, git:*), AskUserQuestion
---

Extract one **aspect** of this repository and adopt it onto the board its spine is bound to. Aspects are the typed detail that hangs off the architecture graph: tables and columns, endpoints, routes and pages — and the links back to the nodes that own and use them.

The primary argument is `--aspect <kind>` (this is the flag `cdx-adopt.js` itself takes). `--db`/`--api` are back-compat shorthand for the two original kinds, kept for muscle memory — they resolve to the same `--aspect database.schema` / `--aspect api.surface` underneath.

## Built aspect kinds

| `--aspect <kind>` | Alias | Skill | Payload file |
| --- | --- | --- | --- |
| `database.schema` | `--db` | **db-aspect-extraction** | `.contextdx/aspects/tmp/db-payload.json` |
| `api.surface` | `--api` | **api-aspect-extraction** | `.contextdx/aspects/tmp/api-payload.json` |
| `ui.pages` | — | **pages-aspect-extraction** | `.contextdx/aspects/tmp/pages-payload.json` |
| `event.catalog` | — | **event-aspect-extraction** | `.contextdx/aspects/tmp/event-payload.json` |
| `authz.registry` | — | **authz-aspect-extraction** | `.contextdx/aspects/tmp/authz-payload.json` |

If no `--aspect`/`--db`/`--api` flag is given, use `AskUserQuestion` to ask which kind to adopt, offering the built kinds above.

## Precondition — the spine must be synced first

Aspects resolve their owner and usage links **by node slug**, so the board's spine (nodes + edges) must already be synced. Before extracting:

1. Confirm `.contextdx/config.json` exists (run `/configure` if not).
2. Confirm `.contextdx/boards/<board-slug>.json` exists and has nodes (run `/analyze` then `/sync` if not).

If the synced analysis is missing, **stop** and tell the user to run `/sync` first — do not fabricate slugs. `cdx-adopt.js` enforces this too and exits with a "no synced spine" error, but catch it early with a clear message.

`cdx-adopt.js` also refuses (exit 1) on a **branch mismatch** — the binding is pinned to one branch and the server rejects pushes from any other. Relay its `error` field verbatim; it names the pinned branch and the fix.

Read `.contextdx/boards/<board-slug>.json` and keep its node `slug`s handy — every node-ref field you emit (`ownerSlug`, `references[].nodeSlug`, or for `ui.pages` the page's own `slug` plus its other node-ref fields — see that skill's golden rule) **must** be one of them.

## Workflow

1. **Resolve the aspect kind** from the table above (`--aspect` value directly, or `--db`/`--api` mapped to their `--aspect` equivalent, or asked via `AskUserQuestion`).
2. **Load that kind's skill** and follow it to read the aspect from source — ORM schemas / migrations for `database.schema`, OpenAPI/controllers/routers for `api.surface`, route files for `ui.pages`, AsyncAPI specs / broker infra-as-code / client call sites for `event.catalog`, CASL/Cerbos/OPA/Polar/IAM policy definitions or a DB-backed RBAC table's schema for `authz.registry`. **Never run the app, connect to a live database, call a live endpoint, connect to a live broker, or evaluate a policy against real inputs** — read the definitions.
3. **Produce the payload JSON** at the table's path, matching that kind's wire schema (fields are documented in the loaded skill).
4. **Adopt it**:
   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-adopt.js --aspect <kind> --payload <payload-file> --mode <mode>
   ```
   Add `--dry-run` to validate the payload and cross-check its slugs against the synced spine **without pushing** — useful to sanity-check `unknownSlugs` before adopting for real.

`--mode` defaults to `replace` (a full snapshot: rows whose slug left the payload are diff-deleted, but **your manual edits and human annotations survive** — the server never touches manual rows or human-owned columns). Use `--mode merge` to add without pruning.

## Report

`cdx-adopt.js` prints an `AspectUpsertResult` (or, with `--dry-run`, just the validated payload's slug cross-check). Summarise it for the user:

- `inserted` / `updated` / `deleted` — what changed on the board.
- `skippedManual` — manual rows the ingest left untouched (expected, not an error).
- **`unlinked`** — rows whose owning slug matched no node. **`unresolvedRefs`** — references whose `nodeSlug` matched no node.

If `unlinked` or `unresolvedRefs` is non-zero, tell the user which slugs were unknown (the CLI reports `unknownSlugs`) and that re-running `/analyze` + `/sync` to add those nodes will **auto-resolve** them on the next push (the server's re-resolution pass) — nothing was dropped, they are just waiting for their node.

State is written to `.contextdx/aspects/<board-slug>.<aspect>.json` so `/status` can show the last adopt and its resolution counts.
