---
category: map
description: "Map · Visually inspect the running app — pick components in a real browser, capture screenshots and metadata that feed intents"
argument-hint: "[--url <url> | --env <name>] [--capture <url>] [--list | --show <id>]"
allowed-tools: Read, Glob, Grep, Bash(node:*), AskUserQuestion
---

Open the running app in a real browser, let the user click-select components (with notes) and
draw **annotation boxes**, and record an **inspection session** — screenshots + structured
metadata (selector, accessibility role/name, component name when detectable, route→`ui.page`
correlation) under `.contextdx/inspections/<sessionId>/`. The session is local evidence for
revising and implementing intents.

Every `cdx-inspect.js` call prints JSON with a `display` field — **print it verbatim; do not
reformat, reorder, or summarise it.** Branch only on the exit code and named JSON fields.

Inspection itself works without ContextDX credentials — never require `/configure` or `/login`
before capturing. Only the **propose** step (step 5) talks to the server.

## Workflow

1. **Start.** Pass through any `--url`/`--env` the user gave:
   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-inspect.js --start [--url <url> | --env <name>]
   ```
   - Exit 0 → print `display` verbatim, go to step 2.
   - Exit 1 with an unresolvable-URL error → use `AskUserQuestion` to ask for the app URL (offer
     any environments the error lists). Re-run with `--url <answer>`; if the user wants it
     remembered, add `--save-env <name>`.
   - Exit 1 "already active" → run `--poll` to continue that session instead (or `--stop` if the
     user wants to abandon it).
   - Exit 1 "no browser found" → print `display` verbatim and stop.
2. **Poll until done.** The user is picking in the browser; wait for them:
   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-inspect.js --poll --max-wait 240
   ```
   - `selectStatus: "pending"` → print `display`, run `--poll` again (repeat while the user is
     still picking).
   - `selectStatus: "complete"` or `"browser_closed"` with selections → print `display`
     verbatim, go to step 3.
   - `selectStatus: "cancelled"` (or `browser_closed` with nothing picked) → print `display`,
     stop.
   - Exit 3 → the browser connection was lost; relay the `error` field and offer to `--start`
     again.
3. **Interpret the session.** Load the **ui-inspection** skill and follow it. The `display`
   summary lists every selection and annotation with screenshot paths (relative to
   `sessionDir`). Read the selection clips (and the annotated composite when annotations exist),
   then give the user a concise readout: which components were picked, on which routes, what the
   notes ask for, and what code each pick maps to (the skill defines the mapping order —
   `sourceFile` → component name → correlated `ui.page` files → selector/text grep). If identity
   came back mostly floor-level and the user wants exact file:line, offer the
   `code-inspector-plugin` setup from the skill's references.
4. **Decide what the session becomes** — `AskUserQuestion` "What should this session become?":
   - **Propose new intent (Recommended)** — when the notes describe changes to make. Default is
     ONE intent for the whole session; offer a split-by-page option in this same question ONLY
     when captures span multiple routes AND the notes describe unrelated concerns.
   - **Attach to the intent I'm working on** — when the session is evidence for an already
     claimed intent.
   - **Keep locally** — stop after the readout; name `/intents` as the next command.
5. **Execute the decision:**
   - **Propose:** draft the payload per the ui-inspection skill (name = the ask in imperative
     form; directive references component identity + evidence; anchors from correlated
     `pageAspectSlug` as `{elementType:"aspect", aspectKind:"ui.page", slug}` or
     `boardNodeSlug` as node anchors; include `inspectionSessionId`). Write it to
     `<sessionDir>/propose.json`, then:
     ```
     node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-intents.js --propose --payload <sessionDir>/propose.json
     ```
     Print `display` verbatim. Exit 1 with a config error triggers the connect-now offer below;
     exit 3 / `notAvailable` → print `display` verbatim and stop.
   - **Attach:** if exactly one local intent is `in_progress`, use it; otherwise run
     `cdx-intents.js --list`, print `display` verbatim, and ask which intent. Then:
     ```
     node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-intents.js --attach-inspection <intentId> --session <sessionId>
     ```
     Print `display` verbatim.
6. **Offer the server push** (after a successful propose or attach, when ContextDX is
   configured). Tell the user exactly what would leave the machine — the environment name and the
   captured URLs from the session summary — and ask (single confirm, part of a prior
   AskUserQuestion or its own): push the capture screenshots + selection/annotation metadata to
   the intent so the architect sees them? On yes:
   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-intents.js --push-inspection <intentId> --session <sessionId>
   ```
   Print `display` verbatim. `notAvailable: true` is a soft stop — the display already explains
   the session stays linked locally. On no: nothing uploads; the local link is enough for the
   developer-side flow.
7. **Offer the page-capture push** (independent of step 6, when the session summary shows
   captures correlated to a `ui.page` and ContextDX is configured): keeping the board's page
   visuals fresh means pushing each correlated page's clean screenshot + element map as its
   server-side visual reference. Name the environment + URLs, confirm once for all pages, then:
   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-inspect.js --push <sessionId>
   ```
   Print `display` verbatim (`notAvailable` is a soft stop). Fold this confirm into the step-6
   question when both apply — one question, two checkboxes, never two rounds.

## Connect-now offer

Only the propose step talks to ContextDX. If it fails with the config-missing error (exit 1) or
`errorType: "auth_invalid"`, ask with **AskUserQuestion** — "Connect to ContextDX now?"
(**Connect now** / **Not now**):

- **Connect now** → run the browser login here, printing each JSON `display` verbatim:
  `node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-login.js --start`, then
  `node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-login.js --poll --analyze-cmd analyze` (generous
  Bash timeout, e.g. 250s). On `status: "complete"`, re-run the propose step.
- **Not now** → stop with: `ContextDX not configured — run /login (browser) or /configure
  (manual) first` (or, for rejected credentials: `Your ContextDX credentials were rejected — run
  /login to reconnect`). The session stays local; nothing is lost.

## Other modes

- **Agent-driven capture** (no human, headless — also the fallback in cloud/headless sessions
  where no local browser can open): `--capture <url>` screenshots a page and records an element
  map. Print its `display`, then Read the screenshot if the task needs it.
- **Session inventory**: `--list` and `--show <sessionId>` — print `display` verbatim.
- **Abandon**: `--stop` kills the session's browser and cancels it.

## Notes

- The browser starts in **Browse** mode — the page is fully interactive (log in, navigate) and
  nothing is captured. In the toolbar, **Pick** arms click-to-pick and **Annotate** arms
  drag-a-box (each box takes a required note); clicking the armed mode again, or pressing
  **Esc**, returns to Browse. Picks and annotations survive same-origin page navigations within
  the session.
- The inspection browser uses a dedicated profile (no daily-browsing state). Nothing leaves the
  machine: sessions are local files until a future phase adds an explicit push step.
