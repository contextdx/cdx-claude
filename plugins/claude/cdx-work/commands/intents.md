---
description: "Pull architect-authored intents for your board and implement them in this project. WRITE-CAPABLE: unlike other cdx commands, this one edits project files (with your approval at each step)"
argument-hint: [<intentId> | --list]
allowed-tools: Read, Glob, Grep, Edit, Write, Bash
---

Work the intent queue for this board. An **intent** is an architect-authored work item: a proposed change to the document set, anchored to board elements, that you implement (or reject) from this session. Resolutions flow back to the architect's board.

**This is the plugin's first write-capable command.** Every other cdx command only reads the document set and writes `.contextdx/` state; this one modifies project files to implement an intent. Never edit files before the user has picked an intent and you have claimed it, and always show the user what you changed.

## Workflow

### Step 0: Pull the intent list

Read `boardSlug` from `.contextdx/config.json`, then run:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-intents.js --list --board-slug <boardSlug>
```

Check the exit code and JSON output:

- **Exit code 1** → stop and tell the user: "ContextDX not configured — run `/login` (browser) or `/configure` (manual) first"
- **Exit code 3** → stop and report the API error from the JSON `error` field. If `errorType` is `auth_invalid`, the credentials were rejected — tell the user to run `/login` to reconnect
- If `featureAvailable` is `false` (`notAvailable: true`) → stop and tell the user: "This ContextDX server doesn't expose intents yet — ask your admin to upgrade"
- If `count` is `0` → tell the user: "No open intents for board '<boardSlug>' — the architect hasn't locked any work for this board" and stop

On success the intents are also persisted to `.contextdx/intents/` (one JSON file per intent) for `--show` to use.

### Step 1: Present the task list

Render the `intents[]` summary as a task list, ordered by priority (critical → high → medium → low, nulls last):

```
| # | Intent | Kind | Priority | Effort | Status | Assigned | ⚠ |
|---|--------|------|----------|--------|--------|----------|---|
| 1 | Split billing worker from API | board_diff | high | medium | open | — | |
| 2 | Remove direct DB access from web | directive | critical | small | in_progress | alice | stale |
```

- Mark `stale: true` intents clearly: **⚠ stale — the board moved since this intent was authored. Do not implement it; re-check with the architect first.**
- Mark `in_progress` intents: someone (see `assignedTo`) may already be working on them.
- Show each intent's `description` under the table (or inline) so the user can choose.

If `$ARGUMENTS` is `--list` or empty, stop here and ask the user which intent to work on. If `$ARGUMENTS` is an intent id (or the user picks one), continue.

### Step 2: Gate the pick

Before claiming, check the chosen intent's summary:

- **`stale: true`** → do NOT implement. Tell the user: "This intent is stale — the board changed since the architect authored it, so the proposed change may no longer apply. Re-check with the architect (they can re-lock it), then pull again." Stop unless the user explicitly insists after that warning.
- **`status: in_progress`** and `assignedTo` names someone who isn't this user → warn that another developer may already be implementing it, and confirm before proceeding.

### Step 3: Claim it (single-winner)

`implemented` resolutions are only accepted for claimed intents, so claim before touching any file. Use the developer's name — ask the user, or default to `git config user.name`:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-intents.js --claim <intentId> --by "<name>"
```

Branch on `claim.reason` in the JSON output:

- `claimed` → proceed; the intent is now `in_progress` under this user's name
- `already_in_progress` → someone else claimed it first. Report who (`claim.status`, the list's `assignedTo`) and ask the user whether to continue anyway (e.g. it's their own earlier session) or pick another intent
- `not_claimable` → the intent moved to a non-pullable state since the list was pulled. Re-run `--list` and re-present
- `not_found` → the intent was deleted or unlocked. Re-run `--list` and re-present
- **Exit code 3 with `notAvailable: true`** → the server can't record claims — stop; do not implement unrecorded work

### Step 4: Show the full intent and map it to source

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-intents.js --show <intentId>
```

The output contains:

- `intent.directive` — the architect's full instruction (the primary spec)
- `intent.description` — the one-paragraph summary
- `intent.payload` — `kind: "directive"` (instruction only) or `kind: "board_diff"` with `suggestions[]` (GraphSuggestion rows: add/remove/modify nodes or edges the change should make true in the document set)
- `anchors[]` — each board element the intent is about, resolved against the local board JSON:
  - `resolved: true` with `files[]` (`path`, optional `lineStart`/`lineEnd`) — the source locations to start from
  - `resolved: false` with a `note` — e.g. no local board data (suggest running `/analyze-docs`) or the element wasn't matched; locate the code by the element's slug/name instead

Present the directive and the anchor→file map to the user before writing anything.

### Step 5: Implement the change

Use your own tools (Read, Glob, Grep, Edit, Write, Bash) to make the change in the project:

1. Start from the anchor `files[]`; read the surrounding code to understand the current shape
2. Follow `intent.directive` as the spec. For `board_diff` payloads, realize each suggestion in code (e.g. an `add` node suggestion means introducing that component; a `remove` edge suggestion means severing that dependency)
3. Respect the project's conventions — match existing style, keep the change scoped to the intent
4. If while implementing you discover the change is inapplicable (already done, contradicts the actual code, or would break something) → stop and go to Step 8 (reject / resolve_other) instead of forcing it

### Step 6: Verify

**Mandatory before any `implemented` resolution.** Find and run the project's own checks:

1. Discover what the project uses: look at `package.json` scripts (`test`, `typecheck`, `lint`, `build`), `Makefile`, `pyproject.toml`, `Cargo.toml`, CI config — whatever this project verifies with
2. Run the relevant checks (at minimum the type/compile check and the tests nearest the changed code)
3. **Show the user the verify results** — pass or fail, with the actual output summarized

If verification fails, fix and re-verify, or tell the user honestly that it doesn't pass. **Never resolve an intent as implemented without showing passing (or explicitly user-accepted) verify results.**

### Step 7: Resolve as implemented (only after user confirms)

Show the user: the diff summary, the verify results, and ask whether to record the resolution. If they committed the change, include the commit SHA (and PR URL if any):

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-intents.js --resolve <intentId> --kind implemented \
  --note "<one-line summary of what was changed>" \
  --commit-sha <sha> --pr-url <url> --by "<name>"
```

(`--commit-sha` / `--pr-url` are optional — omit them if there's no commit yet.)

Then tell the user two things about how the loop closes:

1. `implemented` is recorded now, but it is only **proven** when a later `/sync` push matches the proposed change — the server stamps `verifiedAt` at that point. Suggest: run `/analyze-docs` then `/sync` after committing so the architect sees the intent verified.
2. The intent leaves the queue; `.contextdx/intents/` is cleaned up automatically.

### Step 8: Rejecting or resolving another way

If the user declines the intent, or it's inapplicable:

- **Rejected** (the user disagrees with the change, or it's wrong for the document set):

  ```bash
  node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-intents.js --resolve <intentId> --kind rejected \
    --note "<why — the architect reads this>" --by "<name>"
  ```

- **Resolved other** (moot: already implemented, superseded, fixed elsewhere):

  ```bash
  node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-intents.js --resolve <intentId> --kind resolved_other \
    --note "<what actually resolved it>" --by "<name>"
  ```

A `--note` is effectively required for both — it's the only feedback the architect gets. Ask the user for the reason if it isn't clear from the conversation.

### Resolution exit codes

- **Exit 0** → recorded; report `resolution.status`
- **Exit 2** → intent not found on the server (deleted/unlocked) — re-run `--list`
- **Exit 3** → not resolvable from its current status (e.g. `implemented` without a claim — claim first), API error, or `notAvailable: true` (server can't record resolutions — tell the user their decision was NOT recorded)

## Hard rules

- **Never auto-resolve.** Every resolution — implemented, rejected, resolved_other — happens only after the user has seen the outcome (diff + verify results, or the rejection reason) and said yes.
- **Never implement a stale intent** without the explicit warning + user override in Step 2.
- **Claim before implementing**; the server refuses `implemented` on unclaimed intents.
- **No verify, no `implemented`.** If checks can't be run (none exist), say so and let the user decide whether that's acceptable.
