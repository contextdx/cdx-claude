---
name: db-aspect-extraction
user-invokable: false
description: Extracts a repository's database schema (tables, columns, foreign keys, indexes) into a DatabaseSchemaPayload for /adopt --db. Use when adopting the database.schema aspect. Reads Drizzle, Prisma, TypeORM, SQLAlchemy, raw SQL migrations, or a committed pg_dump — never a live database.
license: MIT
compatibility: Claude Code plugin. Requires a synced spine (.contextdx/boards/<board>.json) so tables can link to node slugs.
metadata:
  author: ContextDx
  version: 0.1.0
---

# Database Schema Extraction (database.schema aspect)

Extract the **declared** schema and shape it into a `DatabaseSchemaPayload`:
`{ tables: [ { …table fields, columns[], foreignKeys[], indexes[], ownerSlug, references[] } ] }`.

## Golden rules

1. **Read definitions, never execute.** No app boot, no DB connection, no running migrations. Parse the source of truth: ORM schema files, migration SQL, or a committed `pg_dump`.
2. **`slug` is the stable identity.** One kebab-case slug per table (e.g. `orders`, `user_sessions` → `user-sessions`), stable across re-extracts — the server reconciles by it. Never re-slug an existing table.
3. **Leave human-tier fields empty.** Do **not** fill `owners`, `deprecated`, `dataClassification`, `piiRationale`, `description`, `usageNotes`, `textual`, `migrationHistory`, `ownershipNotes`. Those are the human's to annotate; the server strips them from ingest anyway (D4), so guessing PII only creates noise. Emit `null`/`[]`/`false` defaults.

## Sources, by ORM

| Source | Where the schema lives | Dialect / ORM |
| --- | --- | --- |
| **Drizzle** | `*.schema.ts` (`pgTable`, `mysqlTable`) | `postgres`/`mysql`, `drizzle` |
| **Prisma** | `schema.prisma` `model` blocks | per `datasource`, `prisma` |
| **TypeORM** | `@Entity` classes | per data-source, `typeorm` |
| **SQLAlchemy** | `Base`/`Table` models | per engine, `sqlalchemy` |
| **Raw migrations** | `CREATE TABLE` in `migrations/*.sql` | parse the DDL, `raw-sql` |
| **pg_dump** | committed `schema.sql` | `postgres`, `raw-sql` |

## Per-table fields

- `slug`, `name`, `schemaName` (default `public`), `dialect`, `orm`.
- `primaryKey`: ordered PK column names, or `null` if the table has none.
- `columns[]`: for each column — `ordinalPosition`, `name`, `type` (raw dialect spelling, verbatim), `logicalType` (the queryable semantic type: `string` | `integer` | `bigint` | `uuid` | `timestamp` | `boolean` | `json` | `enum` | `decimal` | …), `nullable`, `isPrimaryKey`, `isUnique`, `defaultValue`, `enumSlug` (for enum columns), `isComputed` + `generatedExpression` (for generated columns). Leave the human-tier column fields null.
- `foreignKeys[]`: `columns`, `referencesTableSlug` (the **slug** of the target table if it is in this schema), `referencesTableRaw` (the raw name if the target is outside the extract — this powers the "FK to a table we don't model" insight), `referencesColumns`, `onDelete`, `onUpdate`.
- `indexes[]`: `name`, `columns`, `unique`, `method` (`btree`/`gin`/…), `where` (partial-index predicate), `expression` (expression index body).

## Owner + references — linking to the spine (the important part)

Read `.contextdx/boards/<board-slug>.json` for the node `slug`s the spine already has. Every slug you emit must be one of them.

- **`ownerSlug`** — the node that *owns* the table: the repository / data-access module where the schema is defined (e.g. the `orders-repository` node for `orders`). If you can't confidently name one, omit it (`null`) — the server keeps `target_raw` and the D5 pass heals it later.
- **`references[]`** — every node that *uses* the table, one entry per usage: `{ nodeSlug, relation, evidence[] }`.
  - `relation`: `reads` | `writes` | `references`.
  - Find usages by grepping for the ORM's query calls (`db.select(...).from(orders)`, `prisma.orders.findMany`, `orderRepository.save`, raw `SELECT/INSERT ... orders`) and mapping the enclosing service/module to its node slug.
  - `evidence[]`: `{ file, line, snippet }` for each call site — this is what a human clicks through to verify the link.
  - A reference to a node the spine doesn't have yet is fine — emit the slug anyway; it lands unresolved (`node_raw`) and auto-resolves after the next `/sync`.

Prune `references` to real, evidenced usages. A table with no owner and no references still adopts fine (it just shows as unlinked until you enrich the spine).
