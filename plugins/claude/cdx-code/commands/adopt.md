---
category: map
description: Extract and adopt a code aspect (database schema or API surface) onto the bound board
argument-hint: "[--db | --api] [--mode replace|merge]"
allowed-tools: Read, Glob, Grep, Write, Bash(node:*, git:*)
---

Extract one **aspect** of this repository — the database schema (`--db`) or the API surface (`--api`) — and adopt it onto the board its spine is bound to. Aspects are the typed detail that hangs off the architecture graph: tables, columns, endpoints, and the links back to the nodes that own and use them.

Only `--db` (`database.schema`) and `--api` (`api.surface`) are built today. If no flag is given, ask which one.

## Precondition — the spine must be synced first

Aspects resolve their owner and usage links **by node slug**, so the board's spine (nodes + edges) must already be synced. Before extracting:

1. Confirm `.contextdx/config.json` exists (run `/configure` if not).
2. Confirm `.contextdx/boards/<board-slug>.json` exists and has nodes (run `/analyze` then `/sync` if not).

If the synced analysis is missing, **stop** and tell the user to run `/sync` first — do not fabricate slugs. `cdx-adopt.js` enforces this too and exits with a "no synced spine" error, but catch it early with a clear message.

`cdx-adopt.js` also refuses (exit 1) on a **branch mismatch** — the binding is pinned to one branch and the server rejects pushes from any other. Relay its `error` field verbatim; it names the pinned branch and the fix.

Read `.contextdx/boards/<board-slug>.json` and keep its node `slug`s handy — every `ownerSlug` and `references[].nodeSlug` you emit **must** be one of them (that is how the row links back to a Repository / Service / Controller node).

## `--db` — database.schema

1. Load the **db-aspect-extraction** skill and follow it to read the schema from source (Drizzle / Prisma / TypeORM / SQLAlchemy / raw migrations / a committed `pg_dump`). **Never run the app or connect to a live database** — read the definitions.
2. Produce a `DatabaseSchemaPayload` JSON (`{ tables: [...] }`) at `.contextdx/aspects/tmp/db-payload.json`, where each table carries its `columns`, `foreignKeys`, `indexes`, an `ownerSlug` (the repository/data node that owns it), and `references[]` (the service/repository nodes that read or write it, with `relation` + `evidence`).
3. Adopt it:
   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-adopt.js --aspect database.schema --payload .contextdx/aspects/tmp/db-payload.json --mode <mode>
   ```

## `--api` — api.surface

1. Load the **api-aspect-extraction** skill and follow it to read the endpoints from source (OpenAPI/Swagger spec, NestJS controllers, Express routes, tRPC routers, GraphQL SDL). **Read the definitions; never call the endpoints.**
2. Produce an `ApiSurfacePayload` JSON (`{ endpoints: [...] }`) at `.contextdx/aspects/tmp/api-payload.json`, each endpoint carrying its `ownerSlug` (the controller/router node) and `references[]` (the tables/services it touches).
3. Adopt it:
   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-adopt.js --aspect api.surface --payload .contextdx/aspects/tmp/api-payload.json --mode <mode>
   ```

`--mode` defaults to `replace` (a full snapshot: rows whose slug left the payload are diff-deleted, but **your manual edits and human annotations survive** — the server never touches manual rows or human-owned columns). Use `--mode merge` to add without pruning.

## Report

`cdx-adopt.js` prints an `AspectUpsertResult`. Summarise it for the user:

- `inserted` / `updated` / `deleted` — what changed on the board.
- `skippedManual` — manual rows the ingest left untouched (expected, not an error).
- **`unlinked`** — rows whose `ownerSlug` matched no node. **`unresolvedRefs`** — references whose `nodeSlug` matched no node.

If `unlinked` or `unresolvedRefs` is non-zero, tell the user which slugs were unknown (the CLI reports `unknownSlugs`) and that re-running `/analyze` + `/sync` to add those nodes will **auto-resolve** them on the next push (the server's re-resolution pass) — nothing was dropped, they are just waiting for their node.

State is written to `.contextdx/aspects/<board-slug>.<aspect>.json` so `/status` can show the last adopt and its resolution counts.
