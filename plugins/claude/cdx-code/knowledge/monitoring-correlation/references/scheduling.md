# Scheduling — recurring `/monitor` runs per host surface

Pick the surface by what the user has, most capable first. Creating the schedule is the user's
call — offer, don't assume; and never place secret **values** in the chat or in any schedule
definition you author (name the env vars instead).

## 1. Desktop scheduled task (Claude Code / Cowork desktop app) — preferred

Full plugin fidelity: bundled scripts, local MCP servers, minute-level cadence, per-task
permission mode. Requires the machine on with the app open.

- If the session can create desktop tasks, offer: create a task that runs `/monitor` at the
  chosen cadence (e.g. daily 9am) with permission mode "Allow" for `Bash(node:*)` and the
  monitoring MCP tools. The user confirms in-app.
- Unattended vendor auth: use the stdio/token MCP variants (`SENTRY_AUTH_TOKEN`, IAM env vars)
  from `vendor-recipes.md` — browser OAuth prompts would stall a background run.

## 2. Cloud routine (unattended, no machine needed)

Runs on managed infrastructure from a fresh clone of the repo's default branch — which is why
`/monitor`'s correlation falls back to `--from-server` and nothing depends on local
`.contextdx` state. Cadence is cron with a 1-hour minimum; routines can also be fired by API
(`POST /fire`), so a monitoring alert webhook can trigger an immediate run with the alert JSON
passed as run context.

- If a `/schedule`-style skill is available in the session, offer to create the routine now with
  this prompt (fill the cadence in):

  > Run /monitor for this repository. Credentials come from the environment
  > (CONTEXTDX_BINDING_TOKEN, CONTEXTDX_API_SECRET). Use --from-server board context. Pull
  > signals from the connected monitoring connectors, correlate, shape the findings per the
  > monitoring-correlation skill, and push with --require-pack. Non-interactive: skip mapping
  > prompts and leave proposals in the report.

- The user must set, in the routine's environment settings (not the chat):
  `CONTEXTDX_BINDING_TOKEN`, `CONTEXTDX_API_SECRET`, plus any vendor token the recipe names.
- Monitoring MCP access in routines comes from **claude.ai account connectors** (pre-authorized)
  or a committed `.mcp.json` in the repo — locally-added MCP servers do not follow the routine.
- **Caveat:** plugin availability inside cloud routine runs is not guaranteed on every host
  version. After creating the routine, run it once and check it completed a push; if the plugin's
  scripts weren't available, fall back to the desktop task path and report that to the user.

## 3. Session loop (interactive polling)

`/loop 1h /monitor` style — only while the session stays open. Fine for a war-room afternoon;
not a scheduling solution. Suggest it only when the user explicitly wants in-session repetition.

## Event-driven variant

Where routines support API triggers: point the vendor's alert webhook (e.g. a Sentry alert rule)
at the routine's fire endpoint with the alert payload as the run's context text. The run then
correlates just that alert — no polling, sub-cadence latency. Include the vendor-side webhook URL
instructions when the user picks this.
