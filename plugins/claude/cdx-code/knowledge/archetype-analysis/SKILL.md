---
name: archetype-analysis
description: Heuristics for identifying when a codebase needs a NEW archetype on the server, or when an EXISTING archetype is being stretched/misapplied/duplicated. Used by /analyze-archetypes as the Phase 1 precondition before /analyze. Defines what makes a good proposal, what to avoid, and how to phrase rationales.
user-invokable: false
metadata:
  author: ContextDx
  version: 0.2.0
---

# Archetype Analysis — Heuristics

When `/analyze-archetypes` runs, the architecture-analyzer agent invokes this skill in `--archetypes-only` mode to decide what proposals (if any) the codebase warrants. Archetypes are server-managed and approved by humans — a noisy proposal queue burns admin attention, so be selective.

These heuristics run **before** any `/analyze` board is produced. The point of Phase 1 is to settle the vocabulary so Phase 2 (`/analyze`) can assign a fit archetype to every component without misfits.

## What makes a good NEW archetype

A proposal should clear all four bars:

1. **Coverage.** It applies to **≥2 distinct nodes** in the analyzed codebase. A one-off doesn't justify a new archetype — use an existing close-fit and add tags.
2. **Semantic role.** A clear verb-like answer to "what does this *do* on the board." Good: `lambda_function`, `event_bus`, `feature_flag`. Bad: `utility`, `helper`, `common`.
3. **Observable detection pattern.** Something a future analyzer can detect mechanically — file path convention, dependency marker, import signature, naming pattern. If a human couldn't write the detection rule in one sentence, the archetype is too vague.
4. **No existing close fit.** Before proposing, scan the fetched archetype list for synonyms. If `database` already exists, don't propose `db_store`. If `service` exists, don't propose `microservice` unless you're splitting (then use an improvement instead).

## What makes a good IMPROVEMENT

There are four shapes (the `suggestedChange` enum):

| Change | When to use | Required field |
| --- | --- | --- |
| `rename` | Existing name is misleading or generic for what it's actually being used for. E.g., `service` always points to HTTP endpoints in this codebase. | `newName` |
| `split` | Same archetype is being applied to ≥2 clearly different node sub-populations. Identify the dividing axis. | `splitInto` (≥2 targets) |
| `redescribe` | Description doesn't match how it's actually being used. The name is fine; the docs are misleading. | `newDescription` |
| `merge` | Two existing archetypes are near-duplicates with no meaningful behavioral difference on the board. | `mergeIntoName` |

## How to phrase rationales

Three sentences max. Each does one thing:

1. **Pattern** — what you observed. *"12 nodes typed as `service` split cleanly into HTTP-facing controllers and background queue workers."*
2. **Impact** — what's worse without the change. *"Today these get the same icon and styling on the board, hiding the operational difference between sync and async work."*
3. **Proposed change** — what specifically would be done. *"Split into `http_service` and `worker_service`."*

No essays. No marketing language. No "for clarity" — explain *what* clarity, *for whom*.

## What NOT to propose

These all fail review:

- **Vendor names** as archetypes: `stripe_service`, `aws_lambda`, `postgres_db`. The archetype should describe the *role*, not the *vendor*. (`lambda_function` is fine because it describes the compute model; `aws_lambda` is not.)
- **Single-node coverage.** If only one node fits the proposed archetype, defer — it's not worth a server-side review cycle.
- **Archetypes already on the server.** Always check the fetched archetype list first.
- **Layered/board concepts** dressed up as archetypes. Boards have their own hierarchy; don't propose archetypes like `l0_overview` or `subsystem`.
- **Status/lifecycle** masquerading as archetypes: `deprecated_service`, `legacy_db`. Use tags for status; archetypes describe what a thing *is*, not its lifecycle stage.

## Examples

### Good — new archetype proposal

```json
{
  "name": "feature_flag",
  "visualPrimitiveType": "node",
  "description": "A runtime toggle that gates code paths. Read at request-time from a flag service or env config; controls feature rollout.",
  "detectionRules": "Imports from `unleash-client`, `launchdarkly-node-server-sdk`, `@growthbook/growthbook`, or local `flags.ts` with `FlagKey` enum.",
  "exampleNodeSlugs": ["billing-flags", "experiments-runtime"],
  "sourceContext": { "boardSlug": "overview" }
}
```

Why it passes:
- Two distinct nodes use it.
- Clear role: gates code paths.
- Detection rule a human can verify in seconds.
- No existing archetype covers it.

### Good — split improvement

```json
{
  "existingArchetypeName": "service",
  "suggestedChange": "split",
  "rationale": "12 nodes typed as `service` split cleanly into 7 HTTP-facing controllers (use Fastify/Express) and 5 background workers (consume from SQS or run on schedule). Today they get the same icon and don't visually distinguish sync vs async work.",
  "splitInto": [
    {
      "name": "http_service",
      "description": "Synchronous HTTP service exposing REST or GraphQL endpoints.",
      "visualPrimitiveType": "node"
    },
    {
      "name": "worker_service",
      "description": "Background async service consuming queues or running on a schedule.",
      "visualPrimitiveType": "node"
    }
  ],
  "affectedNodeSlugs": [
    "auth-svc", "billing-svc", "user-svc", "orders-svc", "search-svc",
    "notifications-svc", "webhooks-svc",
    "email-worker", "invoice-worker", "image-resize-worker",
    "cleanup-worker", "report-scheduler"
  ],
  "sourceContext": { "boardSlug": "overview" }
}
```

Why it passes:
- Clear dividing axis (sync HTTP vs async background).
- Population is balanced (7 vs 5 — not one outlier).
- Both targets are real archetypes in their own right.

### Bad — too narrow

```json
{
  "name": "stripe_webhook_handler",
  "visualPrimitiveType": "node",
  "description": "Handles incoming Stripe webhook events.",
  "exampleNodeSlugs": ["stripe-webhook"],
  ...
}
```

Why it fails:
- Vendor-specific (`stripe_`).
- Covers only one node.
- Already covered by a generic `webhook_handler` or `http_service` archetype.

For more examples and edge cases, see [`references/proposal-quality-rules.md`](references/proposal-quality-rules.md).
