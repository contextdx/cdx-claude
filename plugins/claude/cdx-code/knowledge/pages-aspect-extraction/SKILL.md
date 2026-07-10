---
name: pages-aspect-extraction
user-invokable: false
description: Extracts a repository's frontend routes/pages (route tree, render tree, data dependencies, guards, forms) into a UiPagesPayload for /adopt --aspect ui.pages. Use when adopting the ui.pages aspect. Reads Next.js App/Pages Router, Remix, TanStack Router, React Router, SvelteKit, or Nuxt route files — never renders or starts the app.
license: MIT
compatibility: Claude Code plugin. Requires a synced spine (.contextdx/boards/<board>.json) so pages can reuse the node slugs /analyze already assigned them.
metadata:
  author: ContextDx
  version: 0.1.0
---

# Frontend Pages Extraction (ui.pages aspect)

Extract the **declared** route tree and shape it into a `UiPagesPayload`:
`{ pages: [ { …page fields, layoutChain[], dataDependencies[], navTargets[], authGuards[], forms[], boundaries, i18n, redirects[] } ] }`.

## Golden rule — read this first

**A page's `slug` is not a fresh name you invent — it MUST be the slug `/analyze` already assigned that page's node on the synced spine.** Every other aspect (`database.schema`, `api.surface`) mints its own aspect-local slug for each row and links back to the spine through a separate `ownerSlug` field. `ui.pages` has no `ownerSlug` at all: the page's own `slug` **is** the link. Before extracting, read `.contextdx/boards/<board-slug>.json`, find the node the spine already created for each route (its `type` will be a page/route-shaped archetype), and reuse that exact `slug` — never re-slug it, never make one up. A route whose node isn't on the spine yet still adopts fine (it lands unresolved and auto-heals on the next `/analyze` + `/sync`), but don't guess a slug for it either — emit the best-guess kebab-case name only if you can't find a match, and expect it to show as unlinked until the spine catches up.

## Other golden rules

1. **Read route definitions, never render.** No dev server, no build, no browser. Parse route files, layout files, and their imports statically.
2. **Leave human-tier fields empty.** Do **not** fill `owners` or `textual` — those are the human's to annotate; the server strips them from ingest anyway (D4).

## Sources, by framework

| `framework` value | Where routes live |
| --- | --- |
| `next-app` | Next.js App Router — `app/**/{page,layout,loading,error,not-found,template,default}.tsx`, route groups `(group)`, parallel `@slot`, intercepting `(.)`/`(..)`/`(...)`, `middleware.ts` |
| `next-pages` | Next.js Pages Router — `pages/**/*.tsx`, `_app.tsx`/`_document.tsx` as the layout chain, `getServerSideProps`/`getStaticProps` as data dependencies |
| `remix` | `app/routes/*.tsx` (flat or `.` nested convention), `loader`/`action` exports |
| `tanstack-router` | File-based `routes/*.tsx` or the generated route tree, `loader` options |
| `react-router` | `createBrowserRouter`/`<Routes>` element trees, `loader`/`action` route config |
| `svelte-kit` | `src/routes/**/+page.svelte` + `+layout.svelte` + `+page.server.ts`/`+layout.server.ts` |
| `nuxt` | `pages/**/*.vue`, `layouts/*.vue`, `middleware/*.ts` |

Use `unknown` only when the repo's routing convention genuinely doesn't map to any of the above — never as a default for "didn't look closely enough."

## Per-page fields

- `slug` — see the golden rule above.
- `framework`, `routePattern` (the route as declared — keep `[id]` vs `:id` vs `$id` verbatim, don't normalise across frameworks), `runtime` (`server` | `client` | `edge` | `static` | `mixed` — read directives/config, don't assume).
- `routeSegments[]` — one entry per path segment, `{ segment, kind }` where `kind` is `static` | `dynamic` | `catch-all` | `optional-catch-all` | `group` | `parallel` | `intercepting`. Derive straight from the file-system route convention; this is what the web UI's route tree renders, so segment order and kind must be exact.
- `layoutChain[]` — the node slugs of every layout wrapping this page, outermost to innermost (e.g. root layout, then a nested segment layout). Omit ones you can't confidently resolve rather than guessing.

### `renderTree` — be honest about what's static

Walk the page component's JSX/template statically and build a tree of `{ component, source, conditional, boundary, children }`. Only include what's **structurally guaranteed to render** — a component behind a runtime `if`, a feature flag, or user-input-dependent branching gets `conditional: true` on that node instead of being silently omitted or silently asserted as certain. Promising precision the analyzer can't deliver is worse than admitting the limit. Mark a Suspense boundary with `boundary: 'suspense'`. If the tree is too dynamic to derive anything meaningful (e.g. a fully data-driven component registry), emit `null` rather than a fabricated shallow guess.

### `dataDependencies[]`

`{ kind, target, mutating }` — one entry per fetch this route triggers on render or submit:

- `rsc-fetch` — a Server Component's direct `fetch`/DB call.
- `server-action` — a form or handler bound to a server action.
- `client-query` — a client-side data hook (React Query, SWR, Apollo, etc.).
- `loader` — a router-level loader (Remix `loader`, TanStack `loader`, React Router `loader`, SvelteKit `load`).
- `rpc` / `graphql` — a typed RPC (tRPC) or GraphQL operation.

`target` is the node slug (or table/endpoint slug from another aspect, where resolvable) the dependency reads from; `mutating` is `true` for anything that writes.

### `authGuards[]`

`{ source, requiredRoles[], redirectsTo }` — `source` is where the guard is enforced (`middleware` | `layout` | `page` | `server-action`). **`requiredRoles[]` are `authz.registry` role slugs, not spine node slugs — do not try to resolve or validate them against the synced board here.** The two aspects reconcile independently; naming a role that doesn't exist yet in `authz.registry` is fine and expected until that aspect is adopted too.

### `forms[]`

`{ name, action, fieldNames[], validationSchema }` — `action` is the node slug of the handler the form submits to (a server action, an API route, a mutation). Leave `null` if the form has no identifiable single handler (e.g. dispatches conditionally).

### `boundaries`, `i18n`, `redirects[]`, `middlewareMatchers[]`, `meta`

- `boundaries` — `{ error, loading, notFound, globalError }`, each a node slug or `null` if the route doesn't define one.
- `i18n` — `{ routingStrategy, locales[], defaultLocale }` when the framework's i18n routing is configured; `null` otherwise. `locales` are raw BCP-47 tags.
- `redirects[]` — `{ from, to, kind, permanent }` for redirects/rewrites declared in routing config or middleware.
- `middlewareMatchers[]` — raw matcher patterns from `middleware.ts`/equivalent that apply to this route.
- `meta` — `{ title, description, canonical, sitemap }` when statically declared (static `metadata` export, `<Head>` block); leave fields `null` when they're computed at request time from data you can't evaluate.

## Linking to the spine — every node-ref field, not just `slug`

Read `.contextdx/boards/<board-slug>.json` for the node slugs the spine already has. Beyond the page's own `slug` (the golden rule above), these fields also name node slugs and follow the same rule — reuse existing ones, emit an unresolved name if the spine doesn't have it yet (auto-heals on the next sync), never fabricate a link that doesn't reflect real code:

- `layoutChain[]`
- `dataDependencies[].target`
- `navTargets[]` — outbound navigation targets only (links, redirects, programmatic nav calls); don't include inbound links from other pages to this one.
- `boundaries.{error,loading,notFound,globalError}`
- `forms[].action`

`authGuards[].requiredRoles[]` is the one exception — see above, that's a different namespace entirely.
