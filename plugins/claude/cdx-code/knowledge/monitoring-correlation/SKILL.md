---
name: monitoring-correlation
description: How /monitor turns raw monitoring output (Sentry issues, CloudWatch alarms, cost anomalies) into normalized signals, correlates them with board elements, and shapes intent-ready findings. Use when running /monitor, normalizing vendor monitoring data, or deciding how an operational signal maps onto architecture nodes/edges. Defines the signals schema, stable-id rules, and the teach-once mapping loop.
user-invokable: false
metadata:
  author: ContextDx
  version: 0.5.8
---

# Monitoring Correlation — Signals → Board Elements → Intent-Ready Findings

`/monitor` closes the loop between production reality and the architecture board: signals from
monitoring tools become findings anchored to the same nodes and edges `/analyze` + `/sync` put on
the portal, where architects promote them to intents. The division of labour is strict:

- **You (the model)**: pull vendor data via MCP tools, normalize it into the signals schema below,
  and — after the deterministic correlation — turn each prefilled finding stub into an
  intent-ready finding (see `references/insight-shaping.md`).
- **The CLI (`cdx-insights.js --correlate`)**: everything mechanical — locator→element matching,
  mapping overrides, scope/key assignment from the context pack, skeleton generation. Never
  hand-match signals to elements or mint scope keys; that is the correlator's job.

## The normalized signals file

`.contextdx/monitoring/signals.json`:

```jsonc
{
  "version": 1,
  "window": { "from": "<ISO>", "to": "<ISO>" },
  "signals": [{
    "id": "sentry:CHECKOUT-4Q2",       // REQUIRED: "<vendor>:<vendor-fingerprint>" — stable across runs
    "vendor": "sentry",                 // sentry | cloudwatch | aws | datadog | grafana | …
    "kind": "error",                    // error | log-pattern | performance | availability | cost | security | custom
    "title": "TypeError in CheckoutSession.finalize",
    "severity": "high",                 // critical | high | medium | low | info
    "measurement": {                    // optional, wire-aligned: one primary number per signal
      "value": 412, "unit": "events",   // unit e.g. "events" | "ms" | "%" | "USD"
      "baseline": 12,                   // optional reference (prior period, SLA, budget)
      "trend": "increasing"             // increasing | decreasing | stable
    },
    "locators": [                       // how to find the element(s); order = priority
      { "type": "code-path", "path": "src/services/checkout.service.ts", "line": 88 },
      { "type": "resource",  "name": "orders-queue", "arn": "arn:aws:sqs:…" },
      { "type": "service",   "name": "payment-api" },
      { "type": "route",     "method": "POST", "path": "/api/checkout" },
      { "type": "tag",       "key": "team", "value": "payments" }
    ],
    "evidence": { "url": "https://sentry.io/…", "sample": "TypeError: …" }
  }]
}
```

Rules that make the loop work:

- **Stable ids.** `id` must be the vendor's own fingerprint (Sentry issue shortId, CloudWatch alarm
  ARN tail, cost-anomaly id). It becomes the finding id, which is what REPLACE-mode pushes and
  promoted intents key on across runs. Same underlying problem ⇒ same id, every run.
- **One primary measurement.** Pick the number that best quantifies the signal (event count, p95
  latency, spend delta). Everything else goes in the finding's prose, not the wire.
- **Locators in priority order.** The first locator to match becomes the finding's primary
  element; later matches become `relatedElements`. Lead with the most specific locator you have
  (a stack frame beats a service name).
- **Windowing is stateless.** Use the configured window (default 7 days, or `windowDays` from
  `.contextdx/monitoring/config.json`). Overlapping windows are safe: stable ids + REPLACE mode
  make re-reported signals idempotent. Do not depend on local state files — scheduled cloud runs
  start from a fresh clone.

## How matching works (so you can predict it)

Deterministic, in priority order per locator — see the correlate output's `confidence` field:

1. **Mapping override** (`.contextdx/monitoring/map.json`) — a user-confirmed locator→slug pin
   (or `null` = always ignore). Beats everything; reported as `mapped`.
2. **code-path** — exact file equality (`exact`), directory containment or ≥2 trailing-segment
   overlap (`strong`). Filename-only overlap never matches (too noisy).
3. **resource / service** — separator-insensitive name equality against slug/name/tags
   (`orders-queue` ≡ `orders_queue`), including the ARN tail. Partial token overlap only produces
   a **proposal**.
4. **route** — a route segment that exactly equals an element's slug/name token.
5. **tag** — element tag equals `value` or `key:value`.

Unmatched signals are never dropped: they become board-level findings tagged `unmatched`.
Proposals are the **teach-once loop**: confirm once with the user, write the mapping, and every
future run resolves that locator deterministically.

## Files

| File | Owner | Purpose |
|---|---|---|
| `.contextdx/monitoring/config.json` | `/monitor setup` | sources, window, skill slug |
| `.contextdx/monitoring/signals.json` | you, each run | normalized signals |
| `.contextdx/monitoring/map.json` | user-confirmed | teach-once locator→slug pins |
| `.contextdx/monitoring/skeleton.json` | correlator → you | prefilled payload you finish and push |
| `.contextdx/insights/<board>.context.json` | correlator | context pack (quality-gate oracle) |

## References

- `references/vendor-recipes.md` — per-vendor MCP tools → signals mapping, connect one-liners, auth per surface. **Adding a vendor = adding a recipe here; no code changes.**
- `references/insight-shaping.md` — intent-ready authoring rules, priority/effort heuristics, when to add paths or graph suggestions.
- `references/scheduling.md` — recurring-run setup per host surface (desktop scheduled task, cloud routine, session loop) and the unattended-credentials pattern.
