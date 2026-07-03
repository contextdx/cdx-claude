---
name: api-aspect-extraction
user-invokable: false
description: Extracts a repository's API surface (endpoints, protocols, auth, params) into an ApiSurfacePayload for /adopt --api. Use when adopting the api.surface aspect. Reads OpenAPI specs, NestJS/Express controllers, tRPC routers, or GraphQL SDL — never calls the endpoints.
license: MIT
compatibility: Claude Code plugin. Requires a synced spine (.contextdx/boards/<board>.json) so endpoints can link to node slugs.
metadata:
  author: ContextDx
  version: 0.1.0
---

# API Surface Extraction (api.surface aspect)

Extract the **declared** endpoints and shape them into an `ApiSurfacePayload`:
`{ endpoints: [ { …endpoint fields, ownerSlug, references[] } ] }`.

## Golden rules

1. **Read definitions, never call.** No requests, no server boot. Parse the OpenAPI doc, the route decorators, the router definitions.
2. **`slug` is the stable identity.** One kebab-case slug per endpoint that survives re-extracts, e.g. `POST /orders` → `create-order`, `GET /users/:id` → `get-user-by-id`. The server reconciles by it; never re-slug.
3. **Leave human-tier fields empty.** Do **not** fill `owners`, `deprecated`, or `textual` — the human owns those and the server strips them on ingest (D4). Emit defaults.

## Sources

| Source | Where the surface lives |
| --- | --- |
| **OpenAPI / Swagger** | `openapi.{json,yaml}` — the richest source; map paths × methods directly |
| **NestJS** | `@Controller` + `@Get/@Post/...` methods, `@UseGuards` for auth |
| **Express** | `router.get/post(...)`, middleware chains |
| **tRPC** | router `procedure` definitions (`query`/`mutation`) |
| **GraphQL** | SDL `type Query`/`Mutation`/`Subscription` fields |

## Per-endpoint fields

- `slug`, `path` (route pattern verbatim — keep `:id` vs `{id}` vs `[id]`).
- `protocolDetails` (discriminated by `protocol`):
  - `http` → `{ protocol: 'http', httpMethod: 'GET'|'POST'|... }`
  - `graphql` → `{ protocol: 'graphql', operationType, operationName }`
  - `grpc` / `trpc` / `websocket` → their variants.
- `authScheme` (discriminated by `type`): `none` (explicitly public — distinct from unknown), `basic`, `bearer` (+ `bearerFormat`), `apiKey` (+ `in`, `paramName`), `oauth2` (+ `flows`, `scopes`), `mtls`. Read guards/middleware/security schemes to decide; `none` is a real, audited answer — use it when the route is genuinely public.
- `pagination` (discriminated by `style`): `none` | `offset` | `cursor` | `page`. **Never omit** — `none` is a real answer.
- `params[]`: `{ name, in: 'path'|'query'|'header', type, required }`.
- `requestBody` / `responses[]`: content types + status codes where declared (opaque schemas are fine).
- `idempotent`, `apiVersion`, `versioningScheme` (`uri`|`header`|`query`|`media-type`|`none`).

## Owner + references — linking to the spine

Read `.contextdx/boards/<board-slug>.json` for the node `slug`s. Every slug you emit must be one of them.

- **`ownerSlug`** — the node that *owns* the endpoint: the controller / router / resolver module (e.g. `orders-controller` for `POST /orders`). Omit (`null`) if unsure — the D5 pass heals it after the next `/sync`.
- **`references[]`** — every node the endpoint *touches*, `{ nodeSlug, relation, evidence[] }`:
  - `relation`: `calls` | `reads` | `writes` | `implements` | `references`.
  - Trace the handler body: which service it calls, which repository/table it reads or writes. Map each to its node slug, with `evidence[] = { file, line, snippet }`.
  - Unknown slugs are kept unresolved and auto-heal on the next sync — emit them, don't drop them.

Cross-aspect tip: an endpoint that reads a table can reference the **table's** owning node (from the db aspect) so "which endpoints hit this table" works both ways.
