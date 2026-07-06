---
category: operate
description: Correlate monitoring signals (errors, logs, cloud costs) with your architecture board and push findings as insights
argument-hint: "[setup | --input <signals-file> | <focus prompt>]"
allowed-tools: Read, Glob, Grep, Edit, Write, Bash(node:*)
---

Pull recent operational signals from your monitoring tools (Sentry, CloudWatch, cost APIs, …), correlate them with the nodes and edges on your architecture board, and push the findings as a draft insight. On the portal, an architect reviews the findings and promotes the actionable ones to **intents** — which developers then pick up with `/intents`. Methodology, the signals schema, and per-vendor recipes live in [knowledge/monitoring-correlation/SKILL.md](../knowledge/monitoring-correlation/SKILL.md).

If `$ARGUMENTS` is `setup`, skip to **Setup** below.

## Workflow

### Step 1: Validate prerequisites

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-insights.js --list-insight-skills
```

- **Exit code 1** → stop: "ContextDX not configured — run `/login` (browser) or `/configure` (manual) first"
- **Exit code 3** with `errorType: "auth_invalid"` → stop: "Your ContextDX credentials were rejected — run `/login` to reconnect"
- **Exit code 3** otherwise → stop and relay the JSON `error` field

Read `.contextdx/monitoring/config.json` if it exists (created by `/monitor setup`): enabled sources, window, and `insightSkillSlug`. Without it, use defaults: auto-detect sources, 7-day window, skill slug `operational-signals`. If the configured skill slug is **not** in the returned `skills[]` → stop: "This ContextDX server doesn't expose operational-signals monitoring yet — ask your admin to upgrade".

### Step 2: Acquire and normalize signals

- If `$ARGUMENTS` contains `--input <file>`: read that file. If it already matches the normalized signals schema (`version: 1` + `signals[]`), use it as-is; otherwise normalize it per the vendor recipes.
- Otherwise, look for connected observability MCP tools in the session (Sentry, CloudWatch, AWS, Datadog, Grafana). If none are available → stop and print the connect one-liner for the user's tool from [references/vendor-recipes.md](../knowledge/monitoring-correlation/references/vendor-recipes.md), then: "Connect a monitoring MCP and rerun `/monitor`, or rerun with `--input <exported-file>`".
- Pull signals for the window per the vendor recipe and normalize them into `.contextdx/monitoring/signals.json` (schema in the skill). Signal `id`s are **stable vendor fingerprints** — they are the cross-run lifecycle keys; never invent or re-mint them. If `$ARGUMENTS` is a focus prompt (e.g. "checkout errors only"), use it to filter which signals to include.

### Step 3: Correlate (deterministic)

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-insights.js --correlate .contextdx/monitoring/signals.json --out .contextdx/monitoring/skeleton.json
```

- **Exit code 2** (no local board data) → retry once with `--from-server` appended (uses the synced server state; works in fresh clones). If that also fails: exit 1 → the config message from Step 1; exit 2 → stop: "No board data — run `/analyze` and `/sync` first"; exit 3 → relay `validationErrors[]` (fix `signals.json` and retry) or the API error.
- Print the JSON `warnings[]` verbatim.
- If `proposals[]` is non-empty: these are uncertain locator→element matches. Present them to the user with AskUserQuestion (one question, the candidates as options, "none of these" allowed), write the confirmed entries into `.contextdx/monitoring/map.json` as `{"version": 1, "mappings": {"<locator>": "<slug>" | null}}` (`null` = always ignore that locator), then re-run the correlate command once so the mappings take effect. In a non-interactive session, skip the prompt and leave the proposals in the report.

The command also writes the context pack to `.contextdx/insights/<boardSlug>.context.json` — the oracle for Step 5's quality gates.

### Step 4: Shape the findings (your judgment)

Read `.contextdx/monitoring/skeleton.json` — one prefilled finding per signal (id, element anchors, priority, measurement, tags already set). For **each** finding, apply the intent-ready authoring rules in [references/insight-shaping.md](../knowledge/monitoring-correlation/references/insight-shaping.md):

1. Read the matched element's source files to verify the signal actually implicates them; only then upgrade `confidence` to `verified`.
2. Rewrite `name` as an imperative work item and `insight` as evidence (what, where, how often).
3. **Always set `recommendation`** (the concrete corrective action — it becomes the intent's directive) **and `effort`**. Never set both `recommendation` and `context`.
4. Keep `id`, `tags`, and `measurement` from the skeleton unchanged.
5. Optional, when warranted: an `InsightPath` tracing the blast radius of a critical finding (edge-grounded against the context pack), or a `GraphSuggestion` when signals reveal a structural gap (e.g. a hot dependency that isn't on the board).

Edit the skeleton file in place. Findings tagged `unmatched` are board-level facts — keep them, and note in `context` what would help anchor them (they carry no `recommendation`).

### Step 5: Save and push

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-insights.js --save-insight .contextdx/monitoring/skeleton.json --board-slug <boardSlug> --require-pack --push
```

- **Exit code 3** → fix the fields listed in `validationErrors[]` and retry
- Push failed → report "Saved locally — push failed: <error>"
- `notAvailable: true` → report "Saved locally — server push not yet available"

### Step 6: Report

Print a summary table (signals pulled, matched/unmatched, findings by priority, pushed/saved), then:

> Findings landed as a **draft insight** on the portal's insights tab. An architect can promote individual findings to intents there; developers pick promoted intents up with `/intents`.

## Setup (`/monitor setup`)

1. Ask (AskUserQuestion, one question set): which signal source(s) — Sentry / AWS CloudWatch / AWS costs / Datadog or Grafana / exported file — and the cadence (daily is the default).
2. Write `.contextdx/monitoring/config.json`:
   ```json
   { "version": 1, "insightSkillSlug": "operational-signals", "windowDays": 7, "sources": [{ "vendor": "sentry" }] }
   ```
3. For each chosen source, print the MCP connect one-liner and auth note from [references/vendor-recipes.md](../knowledge/monitoring-correlation/references/vendor-recipes.md). Never ask the user to paste a token into the chat — name the env var and where to set it.
4. Scheduling — follow [references/scheduling.md](../knowledge/monitoring-correlation/references/scheduling.md): if this host can create schedules from the session (a `/schedule`-style skill for cloud routines, or the desktop app's scheduled tasks), offer to create a recurring "`run /monitor`" at the chosen cadence now (the user confirms). Otherwise print the copy-paste setup block from that reference. For cloud/unattended runs, note that credentials go in the run environment as `CONTEXTDX_BINDING_TOKEN` / `CONTEXTDX_API_SECRET`, and correlation uses `--from-server`.
5. Finish by naming the next command: "Run `/monitor` now for a first pass."

## Error handling

- **No config**: "ContextDX not configured — run /login (browser) or /configure (manual) first"
- **Credentials rejected** (`errorType: "auth_invalid"`): "Your ContextDX credentials were rejected — run /login to reconnect"
- **No board data** (local and `--from-server` both fail): "No board data — run /analyze and /sync first"
- **Skill missing on server**: "This ContextDX server doesn't expose operational-signals monitoring yet — ask your admin to upgrade"
- **Corrupt map/config/signals file**: relay the CLI's `error` verbatim — it names the file and the fix
