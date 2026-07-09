---
category: build
description: "Pull architect-authored intents for your board and implement them in this project. WRITE-CAPABLE: unlike other cdx commands, this one edits project files (with your approval at each step)"
argument-hint: [<intentId> | --list]
allowed-tools: Read, Glob, Grep, Edit, Write, Bash, AskUserQuestion
---

Work the intent queue for this board. An **intent** is an architect-authored work item: a proposed change to the document set, anchored to board elements, that you implement (or reject) from this session. Resolutions flow back to the architect's board.

**This is the plugin's first write-capable command.** Every other cdx command only reads the document set and writes `.contextdx/` state; this one modifies project files to implement an intent. Never edit files before the user has picked an intent and you have claimed it, and always show the user what you changed.

**Display contract:** every `cdx-intents.js` output carries a ready-to-print markdown `display` field. Print it verbatim — never reformat, reorder, summarise, or rebuild its tables. Branch only on the exit code and the JSON fields named below.

## Workflow

### Step 0: Pull the intent list

Read `boardSlug` from `.contextdx/config.json`, then run:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-intents.js --list --board-slug <boardSlug>
```

Print `display` verbatim, then branch:

- **Exit code 1** → stop (the display already says to run `/login` or `/configure`)
- **Exit code 3** → stop; the display carries the error (including rejected credentials → `/login`)
- **`featureAvailable: false`** → stop (the display carries the feature-gate message)
- **`count: 0`** → stop after the display; there is nothing to work on

On success the intents are also persisted to `.contextdx/intents/` (one JSON file per intent) for `--show` to use. The `intents[]` array is already sorted in pick order — the display's `#` column indexes straight into it.

### Step 1: Pick an intent (browser-first)

If `$ARGUMENTS` is an intent id, use it and skip ahead to Step 2. Otherwise open the visual picker in the browser:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-intents.js --select-start
```

- **`notAvailable: true`** → the server doesn't support browser selection yet; use the **terminal fallback** below.
- **Success** → print `display` verbatim (it carries the URL + code), then wait for the selection (give this Bash call ~250s):

  ```bash
  node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-intents.js --select-poll --max-wait 240
  ```

  Branch on the JSON:
  - `selectStatus: "complete"` → the user picked in the browser and the intent is **already claimed** under their signed-in identity, and the output already includes the full intent payload. Print `display` verbatim, apply the Step 2 stale gate to what it shows, then continue at **Step 5** (skip claim and show — both already done).
  - `selectStatus: "pending"` → print `display` verbatim and re-run `--select-poll` (the session stays valid ~15 minutes); ask the user before giving up.
  - **Exit 2** (denied/expired) → offer to restart (`--select-start`) or use the terminal fallback.
  - **Exit 3** → print `display` verbatim and stop.

**Terminal fallback** (no browser available, or `notAvailable`): ask with AskUserQuestion — offer the top 3 intents from `intents[]` (label = name, description = its priority/status plus the summary); the "Other" option is where the user types a different # or id from the table. Then continue with Steps 2–4.

### Step 2: Gate the pick

Before claiming, check the chosen intent's summary fields:

- **`stale: true`** → do NOT implement. Tell the user: "This intent is stale — the board changed since the architect authored it, so the proposed change may no longer apply. Re-check with the architect (they can re-lock it), then pull again." Stop unless the user explicitly insists after that warning.
- **`status: in_progress`** and `assignedTo` names someone who isn't this user → warn that another developer may already be implementing it, and confirm before proceeding.

### Step 3: Claim it (single-winner — skip if claimed via the browser)

Browser selections are already claimed under the user's signed-in identity — skip this step. For the terminal path: `implemented` resolutions are only accepted for claimed intents, so claim before touching any file. Use the developer's name — ask the user, or default to `git config user.name`:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-intents.js --claim <intentId> --by "<name>"
```

Print `display` verbatim, then branch on `claim.reason`:

- `claimed` → proceed
- `already_in_progress` → ask the user whether to continue anyway (e.g. it's their own earlier session) or pick another intent
- `not_claimable` / `not_found` → re-run `--list` and re-present (Step 1)
- **Exit code 3 with `notAvailable: true`** → stop; do not implement unrecorded work

### Step 4: Show the full intent and map it to source (skip if `--select-poll` already showed it)

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-intents.js --show <intentId>
```

Print `display` verbatim — it carries the description (the why), directive, proposed board changes, anchor→file map with architect notes, and downloaded attachments. Then:

- **Read every attachment with a local path** (`.contextdx/intents/attachments/<intentId>/`) — including images/PDFs; they are part of the spec. A `downloadError` means continue with the directive alone and tell the user.
- For `board_diff` payloads, the JSON `intent.payload.suggestions[]` rows are the machine-readable spec (add/remove/modify nodes or edges to make true in the document set); a suggestion's `rationale` may end with "— Architect: …", a per-change note that is part of the spec.
- Unresolved anchors (`resolved: false`) → locate the code by the element's slug/name; if there's no local board data at all, suggest running `/analyze-docs` first.

### Step 5: Implement the change

Use your own tools (Read, Glob, Grep, Edit, Write, Bash) to make the change in the project:

1. Start from the anchor `files[]`; read the surrounding code to understand the current shape
2. Follow `intent.directive` as the spec. For `board_diff` payloads, realize each suggestion in code (e.g. an `add` node suggestion means introducing that component; a `remove` edge suggestion means severing that dependency)
3. Respect the project's conventions — match existing style, keep the change scoped to the intent
4. If while implementing you discover the change is inapplicable (already done, contradicts the actual code, or would break something) → stop and go to Step 8 (reject / resolve_other) instead of forcing it

### Step 6: Verify and record the evidence

**Mandatory before any `implemented` resolution — and mechanically enforced:** the resolve refuses without fresh passing evidence.

1. Discover what the project uses: `package.json` scripts (`test`, `typecheck`, `lint`, `build`), `Makefile`, `pyproject.toml`, `Cargo.toml`, CI config — whatever this project verifies with
2. Run the relevant checks (at minimum the type/compile check and the tests nearest the changed code)
3. **Record each check you ran**, honest exit code included:

   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-intents.js --record-verify <intentId> \
     --command "<the check command>" --exit-code <its exit code> --summary "<one line>"
   ```

   Print `display` verbatim. Re-recording the same command replaces its earlier entry, so record a failure, fix, re-run, and re-record.
4. **Show the user the verify results** — pass or fail, with the actual output summarized

If verification fails, fix and re-verify, or tell the user honestly that it doesn't pass. Evidence expires after ~30 minutes — resolve while it's fresh.

### Step 7: Resolve as implemented (only after user confirms)

Show the user the diff summary and verify results, and ask whether to record the resolution. If they committed the change, include the commit SHA (and PR URL if any):

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-intents.js --resolve <intentId> --kind implemented \
  --note "<one-line summary of what was changed>" \
  --commit-sha <sha> --pr-url <url> --by "<name>" --analyze-cmd analyze-docs
```

(`--commit-sha` / `--pr-url` are optional — omit them if there's no commit yet.)

Print `display` verbatim — it explains how the loop closes (proven on a later `/sync`; local state cleaned up).

- **Exit code 1 with `verifyRequired: true`** → evidence is missing, stale, or failing — go back to Step 6.

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

A `--note` is effectively required for both — it's the only feedback the architect gets. Ask the user for the reason if it isn't clear from the conversation. Print `display` verbatim.

### Resolution exit codes

- **Exit 0** → recorded; the display reports it
- **Exit 1 with `verifyRequired: true`** → (implemented only) record verify evidence first — Step 6
- **Exit 2** → intent not found on the server (deleted/unlocked) — re-run `--list`
- **Exit 3** → not resolvable from its current status (e.g. `implemented` without a claim — claim first), API error, or `notAvailable: true` (server can't record resolutions — tell the user their decision was NOT recorded)

## Hard rules

- **Never auto-resolve.** Every resolution — implemented, rejected, resolved_other — happens only after the user has seen the outcome (diff + verify results, or the rejection reason) and said yes.
- **Never implement a stale intent** without the explicit warning + user override in Step 2.
- **Claim before implementing**; the server refuses `implemented` on unclaimed intents.
- **No verify, no `implemented`.** Enforced: `--resolve --kind implemented` is refused without fresh passing `--record-verify` evidence. If no checks exist in the project, record the closest honest signal (e.g. a build) and tell the user.
