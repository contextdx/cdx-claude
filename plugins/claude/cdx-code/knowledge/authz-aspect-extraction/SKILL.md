---
name: authz-aspect-extraction
user-invokable: false
description: Extracts a repository's authorization model (roles, resource types, permissions, policies) into an AuthzRegistryPayload for /adopt --aspect authz.registry. Use when adopting the authz.registry aspect. Reads CASL rule definitions, Cerbos policy YAML, OPA Rego policies, Oso Polar files, AWS IAM policy documents, or DB-backed RBAC table schemas — never evaluates a policy or queries live rows.
license: MIT
compatibility: Claude Code plugin. Requires a synced spine (.contextdx/boards/<board>.json) so the registry's ownerSlug can link to a node slug.
metadata:
  author: ContextDx
  version: 0.1.0
---

# AuthZ Registry Extraction (authz.registry aspect)

Extract the **declared** authorization model — roles, resource types, permissions, and policy
documents — and shape it into a single `AuthzRegistryPayload`:
`{ model, combiningAlgorithm, ownerSlug, roles[], resourceTypes[], permissions[], policies[] }`.

## Golden rule — read this first, it breaks every extraction if you get it wrong

**The payload is a SINGLETON — one registry object per push, never `{ registries: [...] }`.** A
board has at most one `authz.registry`. Unlike `database.schema`'s `tables[]` or `event.catalog`'s
`channels[]`, there is no top-level array of registries to loop over — `roles[]`/`resourceTypes[]`/
`permissions[]`/`policies[]` are the four child arrays *inside* the one registry object you emit. If
this repo's authorization model spans multiple engines/files (e.g. CASL rules AND an IAM policy
document), merge them into this ONE registry payload — don't emit one payload per source.

## Critical safety rule — read this before touching any policy source

**NEVER evaluate or execute a policy against real inputs.** This aspect is policy *inspection*, not
policy *enforcement* — parse policy definitions and display their declared shape only. Do not call
`ability.can(...)`, do not run `opa eval`, do not invoke Cerbos's check API, do not query a live IAM
policy simulator, and do not run a query against a live roles/permissions table's rows. Read source
files (rule definitions, `.rego`/`.polar` files, IAM JSON documents, table/column schema definitions)
statically — the same way `database.schema` reads ORM schemas without booting the app.

## Sources, by engine

`engine` (on each `policies[]` entry) is a closed enum — use exactly one of these seven values:

| Source | Where it lives | `engine` value |
| --- | --- | --- |
| **CASL** | `defineAbility`/`AbilityBuilder` rule definitions (JS/TS) — `can`/`cannot` calls name the action/subject/conditions | `casl` |
| **Cerbos** | policy YAML files (`resource_policies/*.yaml`, `derived_roles/*.yaml`) | `cerbos` |
| **OPA Rego** | `.rego` policy files | `opa_rego` |
| **Oso Polar** | `.polar` files | `oso_polar` |
| **AWS IAM** | IAM policy documents (JSON) — CDK/Terraform/CloudFormation-authored or standalone | `aws_iam` |
| **DB-backed RBAC** | a roles/permissions table's **schema only** — column definitions, never live rows | `db_table` |
| *(anything else)* | a custom/home-grown authorization scheme | `custom` |

There's no natural richness ordering across these — unlike the IaC-based aspects, these are genuinely
different tool families with different levels of introspectable detail. Read whichever the repo
actually uses; don't prefer one over another when several appear together.

## Top-level registry fields

- `model` — `rbac` | `abac` | `rebac` | `acl` | `custom`. Infer from the dominant shape: pure
  role→permission grants with no runtime conditions is `rbac`; permissions gated by `conditions`
  (CASL `conditions`, Cerbos `condition` blocks, Rego attribute checks) is `abac`; relationship-based
  checks (Oso Polar's typical style — "can edit if owner of") is `rebac`; a flat allow/deny list with
  no role concept is `acl`; anything that doesn't fit cleanly is `custom`.
- `combiningAlgorithm` — `deny-overrides` | `permit-overrides` | `first-applicable` |
  `only-one-applicable`, or `null` if the engine doesn't expose one (CASL and DB-backed RBAC
  typically don't; OPA/Cerbos policies sometimes declare one explicitly).
- `ownerSlug` — the node that owns/defines this authorization model (e.g. the auth service). This is
  the **only** spine-node reference anywhere in the payload — see "Linking to the spine" below. Omit
  (`null`) if unsure; the D5 pass heals it after the next `/sync`.

## `roles[]` — the inheritance hierarchy

`{ slug, name, inherits[], isBuiltIn, textual }` — one entry per distinct role.

- `slug` — a FRESH aspect-local identity you mint (kebab-case, e.g. `org-admin`, `billing-viewer`) —
  **not** a spine node slug. Keep it stable across re-extracts; the server reconciles by it.
- `inherits[]` — slugs of OTHER roles in this SAME `roles[]` array that this role inherits
  permissions from. Self-referential: it points within the payload, never at the spine. `/adopt`
  validates every entry resolves to a `roles[].slug` present in this same payload (blocking — see
  validation below).
- `isBuiltIn` — `true` for a role the engine ships by default (e.g. a Cerbos derived role, a
  framework's built-in admin role) rather than one this repo defines.
- Leave `textual` `null` (human-tier — the server strips it from ingest anyway, D4).

## `resourceTypes[]` — the resource hierarchy

`{ slug, name, parentType, textual }` — one entry per distinct resource type the policies govern
(e.g. `document`, `workspace`, `invoice`).

- `slug` — fresh aspect-local identity, same minting rule as `roles[].slug`.
- `parentType` — another `resourceTypes[].slug` in this SAME payload if this resource type nests
  under a broader one (e.g. `document`'s `parentType` is `workspace`), else `null`. Self-referential,
  same pattern as `roles[].inherits` — validated to resolve within the payload (existence only, see
  below).
- Leave `textual` `null`.

## `permissions[]` — action × resource grants

`{ roleSlug, action, resourceType, resourceId, effect, conditions, textual }` — one entry per
distinct grant/deny rule.

- `roleSlug` — **must** name a role in this SAME payload's `roles[]`. This is the load-bearing
  cross-reference `/adopt` checks (blocking, via `validateIntraPayloadRefs`) — get a role slug wrong
  (a typo, or a role that exists in the source but wasn't also emitted into `roles[]`) and the whole
  payload is rejected before it ever reaches the server.
- `action` — the raw verb as declared (`read`, `write`, `delete`, a CASL action string, an IAM
  `Action` entry, an HTTP-verb-shaped action) — don't normalize across engines.
- `resourceType` — **must** name a resource type in this SAME payload's `resourceTypes[]` (same
  blocking check as `roleSlug`).
- `resourceId` — a specific resource instance this permission is scoped to (a row-level grant), or
  `null` for "all resources of this type." Most extracted permissions are `null` — a non-null
  `resourceId` usually only shows up for DB-backed RBAC tables with row-scoped grant rows.
- `effect` — `allow` | `deny`. Most engines are allow-only by convention (absence = deny); only set
  `deny` when the source explicitly declares a deny/forbid rule (CASL `cannot`, an explicit IAM
  `"Effect": "Deny"` statement, a Rego `deny` rule).
- `conditions` — the raw ABAC predicate/condition object, verbatim, if the engine has one (CASL
  `conditions`, a Cerbos `condition.match`, an IAM `Condition` block). Opaque passthrough — this is
  render-only on the server, not something to interpret or flatten. `null` if the grant is
  unconditional.
- Leave `textual` `null`.

## `policies[]` — the raw source of truth

`{ name, engine, rawSource, parsedHint, textual }` — one entry per distinct policy document/file.

- `name` — a descriptive name (file name, policy identifier, IAM policy name).
- `engine` — see the source table above.
- `rawSource` — the **verbatim** policy text (the actual Rego/Polar/YAML/JSON source, or for
  DB-backed RBAC the table's CREATE TABLE/schema definition). This is the source of truth the UI
  displays — don't summarize, reformat, or "clean up" it.
- `parsedHint` — an optional best-effort structured summary (e.g. `{ ruleCount: 12 }`), if you can
  produce one cheaply. `null` is always fine — this field is render-only, never load-bearing.
- Leave `textual` `null`.

## Linking to the spine — deliberately narrow

Read `.contextdx/boards/<board-slug>.json` for the node slugs the spine already has. Unlike every
other aspect, **`ownerSlug` is the ONLY field checked against the spine.** Every role/resourceType/
permission/policy identity is either this aspect's own fresh mint (`roles[].slug`,
`resourceTypes[].slug`) or a reference to another row within this SAME payload (`roles[].inherits[]`,
`resourceTypes[].parentType`, `permissions[].roleSlug`, `permissions[].resourceType`) — none of them
name a node on the architecture graph, so none of them belong in the spine cross-check. `/adopt`
enforces this split for you:

- **Spine cross-check (warn, never block)** — `ownerSlug` only, via `collectSpineSlugs`.
- **Intra-payload validation (blocking)** — `/adopt` rejects the payload before pushing if any of
  these don't resolve within the SAME payload: a role's `inherits[]` entry against `roles[].slug`; a
  resource type's `parentType` against `resourceTypes[].slug`; a permission's `roleSlug` against
  `roles[].slug`; a permission's `resourceType` against `resourceTypes[].slug`. This is
  **existence-only** — it does not detect a role inheriting from itself transitively, or a
  resource-type parent cycle (an explicit v1 scope cut). Fix any reported mismatch before
  re-adopting; it means the extraction contradicted itself, not that something is merely unsynced.

## Cross-aspect tip

`ui.pages`' `authGuards[].requiredRoles[]` and `api.surface`'s `requiredRoles[]` both name role slugs
from this aspect. Keep the `roles[].slug` you mint here stable across re-extracts so those two
aspects' role references resolve against the same identity once `authz.registry` is adopted too — the
aspects reconcile independently (adopting them in any order is fine), but consistent slugs are what
makes the cross-references meaningful once all three are on the board.

## Output + state

Write the payload to `.contextdx/aspects/tmp/authz-payload.json`, then adopt it the same way every
other aspect kind does:
```
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-adopt.js --aspect authz.registry --payload .contextdx/aspects/tmp/authz-payload.json --mode <mode>
```
State is recorded exactly like every other aspect kind — `writeAspectState()`'s existing
`${boardSlug}.${aspect}.json` naming (with `.` replaced by `-`, giving `<board>.authz-registry.json`)
already fits a singleton payload perfectly. It was never keyed by row id in the first place, so there
is nothing singleton-specific to special-case there.
