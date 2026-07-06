---
category: build
description: "Compile this project's ContextDX skills into the repo. WRITE-CAPABLE: writes IDE-native skill files (never overwrites your local edits)."
argument-hint: [--status]
allowed-tools: Read, Bash
---

Write this project's ContextDX **skills** into the repo. A skill is composed on the platform from three tiers — CDX defaults, your org's customizations, and this app's own overrides — and this command compiles that into IDE-native skill files under the host skills directory (for Claude Code: `.claude/skills/`).

**Never-clobber is the whole point.** A committed lock manifest (`cdx-skills.lock.json`) records the hash of every file this command wrote. On each run it compares each file on disk against that lock: a managed file you have NOT touched is refreshed; a file you HAVE edited is left exactly as-is and reported. This command never overwrites your local edits, and it only manages files it wrote — anything else in the skills directory is untouched.

## Workflow

### Step 0: Choose the mode

- Default (no arguments or `--sync`): fetch the compiled bundle and write it into the repo.
- `--status`: read-only — report whether the repo is up to date, whether the platform's skills changed, and which files you have edited locally. Writes nothing.

Read `boardSlug` from `.contextdx/config.json`.

### Step 1: Run the CLI

For a sync (default):

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-skills.js --sync --board-slug <boardSlug>
```

For status only:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-skills.js --status --board-slug <boardSlug>
```

Check the exit code and JSON output:

- **Exit code 1** → stop and tell the user: "ContextDX not configured — run `/login` (browser) or `/configure` (manual) first".
- **Exit code 3** → stop and report the API error from the JSON `error` field. If `errorType` is `auth_invalid`, the credentials were rejected — tell the user to run `/login` to reconnect.
- If `featureAvailable` is `false` → stop and tell the user: "This ContextDX server doesn't expose skills yet — ask your admin to upgrade".

### Step 2: Report the result

**On `--sync`**, summarize from the JSON:

- `written` / `updated` / `deleted` / `unchanged` — files created, refreshed, removed, or already current under `skillsDir`.
- **`localEdits[]`** — files you have edited that were **left untouched**. If non-empty, show the `note` and tell the user: "These skill files have local edits and were not overwritten. To reconcile: either adopt your edits on the platform (so they become an app-tier override) or discard your local changes and re-run `/skills`."
- `foreign[]` — files that already existed at a managed path but this command never wrote, so they were left alone. Mention them if present.
- `orphansKept[]` — files the platform dropped but you had edited, so they were kept.

Remind the user that the compiled skills (and `cdx-skills.lock.json`) are meant to be **committed** so the whole team and every agent session share them.

**On `--status`**, report:

- `inSync: true` → "Skills are up to date."
- `upstreamChanged: true` → "The platform's skills changed — run `/skills` to pull them."
- `locallyModified[]` → list the files the user has edited (these will be protected on the next sync).
- `missing[]` → managed files that were deleted from disk (a sync will restore them).

Do not edit any skill file yourself — the CLI owns writing. Your job is to run it and explain the result.
