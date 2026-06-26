# Report Output Format

This document describes the schemas for the structured `insights` payload (the `InsightsRoot`) and the human-facing markdown report.

The shape is built around a **Scope** — a per-analysis dictionary of boards and elements. Everything else (findings, paths, suggestions) references scope by short keys; nothing carries `boardSlug` inline. There is no `affectedElements` array; scope plus per-finding `relatedElements` covers the same ground.

## InsightsRoot

The top-level container:

```json
{
  "scope": { ...Scope },
  "insights": [ ...ElementInsight ],
  "paths": [ ...InsightPath ],
  "suggestions": [ ...GraphSuggestion ]
}
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | string (max 150) | No | Display label. Leave empty — the data layer fills it from the parent record title. |
| `scope` | `Scope` | **Yes** | Boards and elements covered by this analysis. Every key referenced from `insights`/`paths`/`suggestions` must appear in `scope.elements`. |
| `insights` | `ElementInsight[]` | No | Findings about elements (or the system as a whole). |
| `paths` | `InsightPath[]` | No | Traced routes through elements. |
| `suggestions` | `GraphSuggestion[]` | No | Proposed structural changes to the board. |

All three array fields are optional. Zero findings + zero paths + zero suggestions is a valid "nothing interesting" output, as long as `scope` is present.

## Scope

`scope` declares the universe of boards and elements this analysis touches:

```json
{
  "boards": [
    { "slug": "my-project-overview", "alias": "ovw" },
    { "slug": "auth-domain",        "alias": "auth" }
  ],
  "elements": [
    { "key": "e1", "slug": "auth-service", "board": "auth", "role": "focus" },
    { "key": "e2", "slug": "api-gateway",  "board": "ovw", "role": "focus" },
    { "key": "e3", "slug": "user-db",      "board": "auth", "role": "context", "emphasis": "outline" }
  ]
}
```

### ScopeBoard

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `slug` | string | Yes | Canonical board slug, e.g. `root--apps-web`. |
| `alias` | `BoardAlias` | Yes | Short alias used to reference this board from elements and paths. Regex `^[a-z0-9_-]+$`, 1–20 chars. |

### ScopeElement

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `key` | `ElementKey` | Yes | Short stable key referenced from insights/paths/suggestions. Regex `^[a-z0-9_-]+$`, 1–12 chars. |
| `slug` | string | Yes | Canonical element slug on the board. |
| `board` | `BoardAlias` | Yes | Alias from `scope.boards`. Decouples element rows from the full board slug. |
| `role` | `"focus"` \| `"context"` | No (default `focus`) | `focus` = analysis anchors findings/paths on it. `context` = referenced for surrounding context only. |
| `emphasis` | enum | No | Visual emphasis hint. Only meaningful for `role: context`; for `focus` elements emphasis is derived from the highest priority of pinned findings. Values: `none`, `highlight`, `pulse`, `glow`, `outline`, `focus`. |

Rules:
- Every element you'll cite must appear in `scope.elements` exactly once.
- Use short keys consistently — `e1`, `e2` works; semantic keys like `auth`, `gw`, `db` are equally valid as long as they stay within the regex and length limits.
- An element on a sibling board is fine — register its board in `scope.boards` and reference it by alias.

## ElementInsight

Each finding produces an `ElementInsight`:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | Yes | Unique within this analysis (e.g., `sec-001`, `perf-003`). Stable across edits. |
| `element` | `ElementKey` \| null | No | Primary element the finding anchors to. Null/omit for board-wide findings. |
| `relatedElements` | `ElementKey[]` | No | Other elements implicated. The diagram highlights all of them together. |
| `name` | string (1–100) | Yes | Short title (≤ 100 chars). |
| `insight` | string (5–500) | Yes | Evidence-driven description. *What* was found and *why* it matters. Opinion lives in `recommendation`. |
| `polarity` | enum | Yes | `risk` \| `strength` \| `opportunity` \| `observation`. |
| `priority` | enum | Yes | `critical` \| `high` \| `medium` \| `low`. Orthogonal to polarity. |
| `confidence` | enum | Yes | `verified` (read the code) \| `likely` (strong evidence) \| `inferred` (derived from patterns) \| `speculative` (pattern-match guess). |
| `impact` | string (max 300) | No | Consequence if a risk is unaddressed or an opportunity is leveraged. |
| `effort` | enum | No | Relative size of the work to act on this: `trivial`, `small`, `medium`, `large`, `epic`. Only meaningful when `recommendation` is set. |
| `measurement` | `Measurement` | No | Quantitative supporting data (see below). Attachable to any polarity. |
| `tags` | string[] (max 10) | No | Classification tags for grouping/filtering. |
| `recommendation` | string (max 500) | Conditional | Concrete action to take. Use when polarity is `risk` or `opportunity` and there's an actionable next step. Mutually exclusive with `context`. |
| `context` | string (max 500) | Conditional | Supplementary background that helps interpret the finding. Use for `observation`/`strength`, or a `risk` without a concrete action. Mutually exclusive with `recommendation`. |
| `relatedFindings` | string[] | No | IDs of other findings in this analysis (amplifies, depends on, follows from). |

### Polarity

| Polarity | Nature | When to use | Examples |
| --- | --- | --- | --- |
| `risk` | Negative finding | Issues requiring attention | Hardcoded secrets, missing auth, SQL injection |
| `strength` | Positive attribute | Patterns worth noting | Clean separation of concerns, defensive error handling |
| `opportunity` | Potential improvement | Beneficial change available | Caching candidate, modernization target |
| `observation` | Neutral fact | Context without judgement | "All services use gRPC", "Auth flow has 4 hops" |

Note: no `metric` polarity — quantitative data lives in the `measurement` field, which can attach to any polarity.

### Priority

| Priority | When to use |
| --- | --- |
| `critical` | Must address immediately — security vulnerabilities, data loss risks |
| `high` | Address soon — significant impact on quality or performance |
| `medium` | Worth addressing — moderate impact, plan for it |
| `low` | Nice to have — minor improvements, informational |

### Confidence

| Confidence | Meaning |
| --- | --- |
| `verified` | Read the code directly; the claim is what the code does |
| `likely` | Strong evidence (multiple sources agree, tests exist, etc.) |
| `inferred` | Derived from patterns or surrounding context |
| `speculative` | Pattern-match guess; warrants user verification |

### Recommendation vs Context

**Populate `recommendation` OR `context`, not both** — the CLI rejects payloads that set both fields on a single finding.

- `recommendation` — for `risk` or `opportunity` polarities with an actionable next step
- `context` — for `observation`/`strength`, or risks where the situation is worth flagging but no clear action is yet defined

### Example: actionable risk

```json
{
  "id": "sec-001",
  "element": "e1",
  "name": "Hardcoded JWT Secret",
  "insight": "JWT secret is a string literal in src/auth/login.ts:42; rotation requires code changes.",
  "polarity": "risk",
  "priority": "critical",
  "confidence": "verified",
  "impact": "Source-code access reveals the signing key, enabling token forgery.",
  "effort": "small",
  "recommendation": "Read the secret from JWT_SECRET environment variable; rotate via deployment.",
  "tags": ["security", "secrets"]
}
```

### Example: observation with measurement

```json
{
  "id": "perf-002",
  "element": "e2",
  "name": "Auth endpoint p99 latency",
  "insight": "Auth endpoint p99 latency is 850ms at peak, dominated by bcrypt comparison.",
  "polarity": "observation",
  "priority": "medium",
  "confidence": "likely",
  "measurement": { "value": 850, "unit": "ms", "baseline": 200, "threshold": 500, "trend": "increasing" },
  "context": "Bcrypt cost factor is 14, set in 2019; modern hardware supports 12 without weakening security."
}
```

### Example: board-wide observation

```json
{
  "id": "arch-001",
  "name": "Strong layering boundaries",
  "insight": "Domain logic is consistently isolated from transport — services depend only on domain interfaces, not transport types.",
  "polarity": "strength",
  "priority": "low",
  "confidence": "verified",
  "context": "23 of 25 services follow this pattern; the two exceptions are integration shims documented in the README.",
  "relatedElements": ["e1", "e2"]
}
```

(`element` omitted → board-wide finding. `relatedElements` calls out the most prominent examples.)

## Measurement

Quantitative data attached to a finding:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `value` | number | Yes | The measured value. |
| `unit` | string (1–40) | Yes | Unit of measure (e.g., `ms`, `requests/s`, `%`, `MB`). |
| `baseline` | number | No | Reference value (target, SLA, prior measurement). |
| `threshold` | number | No | Value beyond which the measurement becomes noteworthy. |
| `trend` | enum | No | `increasing`, `decreasing`, or `stable` over time. |

## InsightPath

A traced route through the graph — execution flows, blast radius chains, dependency cascades:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | Yes | Unique within this analysis. |
| `title` | string (1–100) | Yes | Title (e.g., "User Authentication Flow"). |
| `description` | string (max 500) | No | Why this path matters. |
| `polarity` | enum | Yes | Overall nature of the path. Same values as ElementInsight. |
| `priority` | enum | Yes | Importance of following the path. |
| `defaultBoard` | `BoardAlias` | Yes | The most common board across the steps. Used for fast UI lookup; each step's element still resolves to its own board via `scope.elements`. |
| `steps` | `InsightPathStep[]` (min 2) | Yes | Ordered list of steps. |
| `tags` | string[] (max 5) | No | Classification tags. |

### InsightPathStep

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `element` | `ElementKey` | Yes | Element at this step. References `scope.elements[].key`. |
| `label` | string (max 100) | No | What happens here (e.g., "Validates JWT token"). |
| `annotation` | string (max 300) | No | Additional context (e.g., "~20ms latency"). |
| `findingRef` | string | No | ID of an `ElementInsight` in this analysis. The step inherits the finding's polarity/priority/recommendation; don't duplicate the prose. |
| `branches` | `InsightPathStep[]` | No | Sub-steps for non-linear flows (recursive). |

### Path quality constraints

- **Edge-grounded** — each consecutive pair of steps should correspond to an actual edge (direct or within 1–2 hops) in the board's `edges[]`. Don't invent connections that don't exist. Cross-board transitions are valid when the flow logically continues across board boundaries.
- **No consecutive duplicates** — never place the same `element` key in back-to-back steps. An element may reappear later if it plays a genuinely different role (with a distinct `label`); otherwise split into separate forward/return paths.

### Example: linear path

```json
{
  "id": "path-001",
  "title": "User Authentication Flow",
  "description": "Critical path from login request to session creation.",
  "polarity": "observation",
  "priority": "high",
  "defaultBoard": "ovw",
  "steps": [
    { "element": "e2", "label": "Receives login request", "annotation": "Rate limited 10 req/s" },
    { "element": "e1", "label": "Validates credentials", "findingRef": "sec-001" },
    { "element": "e3", "label": "Reads user record" }
  ],
  "tags": ["auth", "latency"]
}
```

### Example: branching path

```json
{
  "id": "path-blast-001",
  "title": "Payment failure blast radius",
  "description": "Where a payment-service outage propagates.",
  "polarity": "risk",
  "priority": "high",
  "defaultBoard": "ovw",
  "steps": [
    { "element": "pay", "label": "payment-service outage" },
    {
      "element": "ord", "label": "order-service blocks on retries",
      "branches": [
        { "element": "ntf", "label": "notification-service skips confirmation" },
        { "element": "anly", "label": "analytics pipeline misses event" }
      ]
    },
    { "element": "user", "label": "user sees error" }
  ]
}
```

## GraphSuggestion

A proposed structural change to the board:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | Yes | Unique within this analysis. |
| `action` | enum | Yes | `add`, `remove`, or `modify`. |
| `targetType` | enum | Yes | `node`, `edge`, or `container`. |
| `element` | `ElementKey` \| null | No | Existing element to remove or modify. Null/omit for `add`. |
| `fromElement` | `ElementKey` \| null | No | Source element for edge suggestions. |
| `toElement` | `ElementKey` \| null | No | Target element for edge suggestions. |
| `name` | string (1–100) | Yes | What is being suggested. |
| `rationale` | string (5–500) | Yes | Why this change should be made. |
| `polarity` | enum | Yes | Nature of the suggestion (typically `opportunity` or `risk`). |
| `priority` | enum | Yes | How urgent the change is. |
| `tags` | string[] (max 5) | No | Classification tags. |

### Examples

Add a new node:

```json
{
  "id": "sug-001",
  "action": "add",
  "targetType": "node",
  "name": "Add Redis cache layer in front of auth-service",
  "rationale": "Auth service queries user-db on every request. A cache layer cuts p99 latency by ~80%.",
  "polarity": "opportunity",
  "priority": "high",
  "tags": ["performance", "caching"]
}
```

Remove a redundant edge:

```json
{
  "id": "sug-002",
  "action": "remove",
  "targetType": "edge",
  "fromElement": "e1",
  "toElement": "e3",
  "name": "Remove direct auth→user-db edge",
  "rationale": "user-db should only be accessed via repository layer; direct edge bypasses query whitelist.",
  "polarity": "risk",
  "priority": "medium"
}
```

## Markdown Report (`content` field)

The `content` field is a detailed markdown report for humans. Keep it tight but informative — include file paths when the analysis identifies specific source locations.

```markdown
# <Skill Name> Report

## Summary

<total> findings: <critical> critical, <high> high, <medium> medium, <low> low
Polarities: <risk> risks, <strength> strengths, <opportunity> opportunities, <observation> observations
<pathCount> paths traced, <suggestionCount> suggestions

## Findings

### 1. <Finding Name> (<polarity> · <priority> · confidence: <confidence>)

**Element:** <slug from scope or "board-wide">
**File:** <source file path if known>

<insight description>

<If measurement present:>
**Measurement:** <value> <unit> (baseline <baseline>, threshold <threshold>, trend <trend>)

<If recommendation:>
**Recommendation:** <action>

<If context only:>
**Context:** <background>

---

### 2. <Next Finding>

...

## Paths

<For each path: title, polarity/priority badge, steps with annotations, finding refs inline>

## Suggestions

<For each suggestion: action + target, name, rationale>
```

Keep the report focused on what a reader needs to act. Don't restate the JSON — surface the *why* and *next step* for each finding.
