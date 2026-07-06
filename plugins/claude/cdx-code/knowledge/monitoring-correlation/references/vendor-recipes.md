# Vendor Recipes — MCP tools → normalized signals

Each recipe: how to connect, which tools to call, and how the output maps onto the signals schema
(see `../SKILL.md`). Auth differs by surface — **interactive** (a person at the session, browser
OAuth is fine) vs **unattended** (scheduled runs, token/IAM env credentials only). Never ask the
user to paste a secret into the chat; name the variable and where it goes.

## Sentry

- **Connect (interactive):** `claude mcp add --transport http sentry https://mcp.sentry.dev/mcp`,
  then authenticate via `/mcp` (browser OAuth).
- **Connect (unattended):** the remote server is OAuth-only — use the stdio variant with a token:
  `claude mcp add sentry -- npx @sentry/mcp-stdio` with `SENTRY_AUTH_TOKEN` set in the run
  environment (scopes: `org:read`, `project:read`, `event:read`). Cloud routines can instead use a
  Sentry connector pre-authorized on the claude.ai account.
- **Pull:** search issues for the configured project(s) within the window, sorted by event count;
  for the top issues fetch the latest event for stack frames.
- **Map:** `id` = `sentry:<issue shortId>` · `kind` = `error` · `severity` from issue level
  (fatal→critical, error→high, warning→medium, info→info) · `measurement` = `{ value: eventCount,
  unit: "events", trend }` (compare to prior window if available) · `locators` = in-app stack
  frames as `code-path` (strip build prefixes; keep repo-relative), plus the Sentry
  `culprit`/transaction as `route` or `service` · `evidence.url` = issue permalink,
  `evidence.sample` = exception type + message.

## AWS CloudWatch (logs, metrics, alarms)

- **Connect:** awslabs CloudWatch MCP server (stdio):
  `claude mcp add cloudwatch -- uvx awslabs.cloudwatch-mcp-server@latest` with IAM credentials in
  the environment (`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` or a role/profile). IAM env auth
  works unattended as-is.
- **Pull:** alarms in `ALARM` state (+ state history for flapping), and Logs Insights error-pattern
  queries over the configured log groups within the window.
- **Map:** alarms → `id` = `cloudwatch:<alarm name>`, `kind` = `availability` (or `performance`
  for latency alarms), `severity` high (critical if the alarm is on an SLO), `measurement` from
  the alarm metric vs threshold (`baseline` = threshold), `locators` = the alarm's dimension
  values as `resource` (function/table/queue name) and the log group as `service`. Log patterns →
  `id` = `cloudwatch:<log-group>:<pattern-hash>` (use the vendor's pattern id when the query
  provides one), `kind` = `log-pattern`, `locators` from the log group (`service`) and any file
  paths in the log lines (`code-path`).

## AWS costs (Cost Explorer / Cost Anomaly Detection)

- **Connect:** the official AWS MCP server (covers Cost Explorer + Cost Anomaly Detection APIs):
  `claude mcp add aws -- npx @aws/mcp-server` with IAM env credentials (read-only cost policies).
- **Pull:** cost anomalies within the window, plus service-level cost deltas vs the prior period
  for the configured threshold (default: flag ≥20% increase).
- **Map:** `id` = `aws:<anomaly id>` (or `aws:cost:<service>` for threshold deltas) · `kind` =
  `cost` · `severity` by spend delta (≥$500/day critical, ≥$100 high, else medium) ·
  `measurement` = `{ value: spendDelta, unit: "USD", baseline: priorSpend, trend }` · `locators`
  = the anomaly's root-cause service/resource names as `resource` (e.g. a Lambda name, an RDS
  instance id) — cost signals often anchor only via the teach-once map or land board-level;
  that is expected, not a failure.

## Datadog / Grafana

- **Connect:** official remote MCP servers (OAuth; on claude.ai surfaces add them as connectors so
  scheduled cloud runs inherit the authorization).
- **Pull:** triggered monitors/alerts within the window; top error traces if APM is in use.
- **Map:** `id` = `<vendor>:<monitor id>` · `kind` from monitor type (error/performance/
  availability) · `locators` from monitor tags (`service`, `tag`) and any stack traces
  (`code-path`).

## Exported file (no MCP)

`/monitor --input <file>` accepts either an already-normalized signals file or a raw vendor export
(Sentry issues JSON, CloudWatch alarm list, Cost Explorer CSV converted to JSON). For raw exports,
normalize with the matching recipe above. This is the zero-setup path and the fallback whenever no
MCP is connected.
