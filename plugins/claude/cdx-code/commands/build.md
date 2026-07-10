---
category: build
description: "Build · Build the app from the platform's spec — compiled skills, intents, board design, aspect contracts. WRITE-CAPABLE: creates and edits project files (after you approve the plan)"
argument-hint: [--plan | <focus prompt>]
allowed-tools: Read, Glob, Grep, Edit, Write, Bash, AskUserQuestion
---

Implement the platform's spec for this app in this repo. The **primary spec carrier is the compiled skills bundle** (synced by `/skills` — specs, guidelines, and conventions ride inside the skill files); open **intents**, a designed **board** (elements with no source mapping yet), and **aspect snapshots** (DB schema / API surface) layer on top when they exist. Covers bootstrap (empty repo) and gap-fill (the spec grew), and it is **incremental**: re-running builds only the delta.

**This command is write-capable.** Never create or edit project files before the user has approved the plan in Step 3, and always show what changed.

Read the methodology in [knowledge/platform-driven-build/SKILL.md](../knowledge/platform-driven-build/SKILL.md) before planning.

## Workflow

### Step 1: Assemble the spec pack

Read `boardSlug` from `.contextdx/config.json`, then run:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-build.js --board-slug <boardSlug>
```

- **Exit 1** → not configured — make the **connect-now offer** (see Error Handling)
- **Exit 3** → stop and report the JSON `error` field. If `errorType` is `auth_invalid` — make the **connect-now offer** (see Error Handling)
- **Exit 0** → print the `display` field **verbatim — do not reformat, reorder, or summarise**.

**Skills freshness gate:** read the pack (`packPath`). If `skills.available` and (`skills.upstreamChanged` or `skills.compiledCount` is 0), sync first — building against a stale spec is building the wrong app:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-skills.js --sync --board-slug <boardSlug>
```

Report the sync result (mention protected `localEdits[]` if any), then re-run `cdx-build.js` once for a fresh pack.

### Step 2: Branch on the pack's `nextAction`

- **`none`** → nothing to build from. Tell the user: "Compile skills for this app on the ContextDX portal (or author a board design / intents), then re-run `/build`." Stop.
- **`map`** → this repo has source but no platform spec. Tell the user to map it first: `/analyze-archetypes`, then `/analyze` and `/sync`. Stop.
- **`intents`** → the spec is built; only intent work remains. Point the user at `/intents`. Stop.
- **`build`** → continue.

### Step 3: Plan from the spec (approval gate)

Read, in this order:

1. The compiled skills under `skills.skillsDir` — the specs and conventions to honor (app-tier overrides win; never edit these files — they're lock-managed by `/skills`).
2. The pack's `design.unbuilt[]` — designed elements with no source mapping (components to create; board edges give their dependencies).
3. `.contextdx/build/aspects.json` (when `aspectsPath` was reported) — full DB tables and API endpoints to materialize as migrations and contracts.
4. The pack's `intents.open[]` — architect work items; note which plan units they cover.

Turn the unbuilt spec into an incremental implementation plan per the methodology skill: skill specs → app shape, stack, and conventions; designed nodes → components; edges → dependencies and boundaries; aspects → migrations + API contracts; `$ARGUMENTS` (if a focus prompt) narrows which part to build first. Use AskUserQuestion **only** at genuine decision points: the stack when the skills don't pin one, and build order when the spec is large.

Present the plan (units, order, what each creates, which intents it covers) and get the user's approval. If `$ARGUMENTS` is `--plan`, stop here — no files are touched.

### Step 4: Implement incrementally

Work plan unit by plan unit:

- **Intent-covered units go through the intent machinery** so attribution and verification accrue there: claim before touching files (`cdx-intents.js --claim <intentId> --by "<name>"`), implement, verify, and resolve only after the user confirms — exactly per `/intents` Steps 3–8 (never auto-resolve; no verify, no `implemented`).
- Other units: create/edit the files, matching the conventions the compiled skills establish.
- **Verify each unit** with the project's own checks (discover them: `package.json` scripts, Makefile, CI config; for a fresh scaffold, set up the minimal check the skills prescribe). Show the results.

### Step 5: Close the loop

Tell the user to run `/analyze-archetypes`, then `/analyze`, then `/sync`. For a skills-driven build this is what **creates** the board — the freshly built app becomes a mapped, living board; for a design-led build the designed elements gain source mappings and stop appearing as unbuilt. Intent-backed work gets verified by the server when the sync matches. Then `/build` is idempotent: re-running reports the spec as built and points at `/intents`.

## Error Handling

- **No config** / **credentials rejected** (`errorType: "auth_invalid"`): make the **connect-now offer** (below)
- **Skills feature gated** (`skills.available: false` in the pack): relay the pack's note — building can continue from intents/design/aspects if present
- **Degraded sections** (`warnings[]` in the pack): report them; they don't block the build

### Connect-now offer

Used whenever ContextDX is not configured or the credentials were rejected (`errorType: "auth_invalid"`). Ask with **AskUserQuestion** — "Connect to ContextDX now?" (**Connect now** / **Not now**):

- **Connect now** → run the browser login here, printing each JSON `display` verbatim: `node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-login.js --start`, then `node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-login.js --poll --analyze-cmd analyze` (generous Bash timeout, e.g. 250s). On `status: "complete"`, resume this command from the step that failed; anything else — stop, the display explains.
- **Not now** → stop with the canonical message: "ContextDX not configured — run `/login` (browser) or `/configure` (manual) first" (or, when credentials were rejected: "Your ContextDX credentials were rejected — run `/login` to reconnect").
