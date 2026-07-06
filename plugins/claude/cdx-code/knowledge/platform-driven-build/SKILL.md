---
name: platform-driven-build
description: How to build an app from the ContextDX platform's spec — reading compiled skills as the primary spec, turning designed board elements into components, materializing aspect snapshots (DB schema, API surface) as migrations and contracts, and closing the loop so the board maps the built app. Used by /build.
user-invokable: false
metadata:
  author: ContextDx
  version: 0.5.9
---

# Platform-Driven Build — Methodology

`/build` invokes this skill to implement the platform's spec in the repo. The spec has up to four sources, **by primacy**:

| Source | Carries | Comes from |
|---|---|---|
| **Compiled skills** (primary) | Specs, guidelines, conventions, stack choices | `/skills` sync → `skills.skillsDir` (lock-managed files) |
| Intents | Explicit architect work items with anchors | `cdx-intents.js` (pack `intents.open[]`) |
| Board design | Components + relationships (unbuilt elements) | pack `design.unbuilt[]` |
| Aspect snapshots | Data & API contracts | `.contextdx/build/aspects.json` |

Most builds are **skills-driven**: no pre-designed board exists, and the board is *created* by `/analyze` + `/sync` after building. Design-led builds (portal-authored elements) add structure on top; treat absent sources as normal, never as errors.

## Reading compiled skills as the spec

- The bundle is composed on the platform from three tiers — CDX defaults → org customizations → **app-tier overrides**. Where instructions conflict, the app tier wins.
- Distinguish **spec content** (what to build: feature specs, domain rules, API/data requirements — often in per-app skill files or `references/`) from **convention content** (how to build: style, structure, testing, naming). Both bind; specs drive the plan units, conventions drive every file you write.
- Skill files are **lock-managed by `/skills`** (`cdx-skills.lock.json`). Never edit them as part of a build — a local edit blocks future syncs of that file. If a spec is wrong, the fix belongs on the platform.
- If the skills don't pin a stack, that is a genuine decision point — ask the user once, offering what the skills' conventions imply.

## Design-to-code mapping (design-led builds)

Archetypes are server-defined, so map by what the archetype *means*, not a fixed list:

- A **node** becomes the smallest idiomatic unit that honors the repo's conventions: a service/module/package with its own entry point for service-like archetypes; schema + migration + model for data-store archetypes; a route/controller layer for gateway/API archetypes; a job/consumer for worker/queue archetypes.
- An **edge** is a dependency or data flow the code must make true — an import, a client call, a queue publish/subscribe. Realize each edge explicitly; an unrealized edge means the built app diverges from the design.
- Use the node's `description`/`detailedDescription` as its mini-spec; the element `slug` should be recognizable in the code path you create (that's what future `/analyze` runs will match — it closes the loop).
- Build order: dependencies first (data stores → core services → edges/integrations → entry points), so each unit can be verified as it lands.

## Materializing aspect snapshots

From `.contextdx/build/aspects.json` (fields mirror the platform's aspect rows; `ownerSlug` links a row to its owning board element):

- **`database.schema` tables** → migrations + ORM models honoring the row's `dialect` and `orm` fields. Emit columns exactly as specified (name, type, nullability, PK/unique, defaults, enum options); realize `foreignKeys` as real constraints and `indexes` as real indexes. **Never invent or rename columns** — the snapshot is the contract; gaps go back to the architect, not into improvisation.
- **`api.surface` endpoints** → route/controller stubs + contracts from `protocolDetails` (HTTP method + path, GraphQL operation, gRPC method), `params`, `requestBody`/`responses` shapes, and auth from `authScheme`. Wire each endpoint into the component `ownerSlug` names.
- A row with `source: "manual"` was authored by a human on the portal — it is spec in the strongest sense.

## Repo-state decisions

| State | Meaning | Action |
|---|---|---|
| `empty` | No source files | Bootstrap: scaffold per skills conventions, then build every plan unit |
| `partial` | Source exists, spec has unbuilt parts | Gap-fill: touch only what the unbuilt spec requires — never refactor existing code that isn't in the delta |
| `built` | No unbuilt spec | Don't build; `/intents` for remaining work |

## Closing the loop

A build is only *done* when the board reflects it: `/analyze-archetypes` → `/analyze` → `/sync`. Skills-driven builds populate the board for the first time; design-led builds turn designed elements into mapped ones (they leave `design.unbuilt` on the next pack). Intent-backed units get server-verified when the sync matches the proposed change. This is what makes `/build` idempotent and the board a truthful map, not an aspiration.
