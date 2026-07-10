---
category: map
description: "Map · Scan the knowledge set for archetype gaps and submit proposals before running full /analyze-docs"
argument-hint: [--dry-run | --skip-submit | --force | --replace]
allowed-tools: Read, Glob, Grep, Write, Bash(node:*), AskUserQuestion
---

Phase 1 of the two-phase workflow: settle the **vocabulary** before describing the knowledge set. Scans the document corpus for the kinds of knowledge it contains, compares them against the server's work-board archetype catalogue, and either confirms the catalogue is complete or proposes the missing archetypes for human approval.

After this command finishes (and any submitted proposals are approved), `/analyze-docs` runs against a complete catalogue — no misfit archetypes, no post-hoc retyping of concepts and documents.

> **Catalogue caveat.** Work-board archetypes are **server-defined per board "kind"** and the catalogue may still be settling. Phase 1 exists precisely to surface gaps in that evolving vocabulary — propose the closest-fit role, not a one-off label.

## When to run

- Before `/analyze-docs` on a fresh knowledge set.
- After a significant change in the corpus that introduces a new *kind* of knowledge (e.g., adding a directory of ADRs to a previously prose-only wiki, or introducing formal requirement docs).
- After admin approves proposals you previously submitted — re-running confirms the catalogue is now complete and updates the lock file.

## Flags

| Flag | Effect |
| ---- | ------ |
| `--dry-run` | Run the scan, validate proposals locally + ask the server to dry-run, but do **not** persist or POST. No lock file written. |
| `--skip-submit` | Write `.contextdx/proposed-archetypes.json` for manual review; do not POST. Lock file records the scan but not a submission. |
| `--replace` | When submitting, send `mode='replace'` so duplicate-name pending rows are overwritten instead of rejected. |
| `--force` | Bypass the CLI's local hash guard when submitting. |

## Workflow

### Step 0: Configuration and branch check

Verify `.contextdx/config.json` exists. If not, make the **connect-now offer** — ask with **AskUserQuestion** "Connect to ContextDX now?" (**Connect now** / **Not now**):

- **Connect now** → run the browser login here, printing each JSON `display` verbatim **in your reply** (the Bash output panel is collapsed for the user): `node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-login.js --start`, then `node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-login.js --poll --analyze-cmd analyze-docs` (generous Bash timeout, e.g. 250s). On `status: "complete"`, continue; anything else — stop, the display explains.
- **Not now** → stop: "ContextDX not configured — run `/login` (browser) or `/configure` (manual) first"

Then run the branch guard — the binding is pinned to one branch and the server rejects pushes from any other, so scanning the wrong checkout is wasted work:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-precondition.js --branch-only
```

On exit 1, print the JSON `error` field verbatim and stop (it names the pinned branch, the current branch, and the fix). On exit 0, continue.

### Step 1: Pull fresh archetype catalogue

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-archetypes.js --no-cache --kind knowledge
```

Parse the `archetypes[]`, `nodeArchetypes[]`, and `edgeArchetypes[]` from the JSON output. Compute a stable hash of the archetype names list — this becomes the `catalogueHash` recorded in the lock file.

### Step 2: Archetype-only scan

Invoke the `document-analyzer` agent with `--archetypes-only` mode. The agent runs `/analyze-docs` Steps 0, 3, 4, 5 (document-set detection → corpus profiling → knowledge discovery + archetype classification) but stops there. It does **not** produce board JSON, edges, hierarchies, or manifest updates.

The agent's output is a payload conforming to `ArchetypeProposalPayloadSchema`:

```json
{
  "proposed": [ /* new-archetype candidates per concept-extraction SKILL */ ],
  "improvements": [ /* improvement candidates: rename | split | redescribe | merge */ ]
}
```

The agent applies the heuristics in [`${CLAUDE_PLUGIN_ROOT}/knowledge/concept-extraction/SKILL.md`](../knowledge/concept-extraction/SKILL.md) for both what to propose and what to skip, in the knowledge vocabulary (Concept / Document / Section / Decision / Policy / Process / Stakeholder / Requirement / Term / Glossary).

### Step 3: Decision branches

#### Step 3a — no gaps

If `proposed[]` and `improvements[]` are both empty:

1. Write `.contextdx/archetype-analysis.lock.json`:
   ```json
   {
     "commitHash": "<docset digest or git rev-parse HEAD>",
     "catalogueHash": "<from Step 1>",
     "scannedAt": "<ISO timestamp>",
     "submittedAt": null,
     "skippedAt": null,
     "proposalIds": []
   }
   ```
2. Print: *"Catalogue is complete for this knowledge set. You can now run `/analyze-docs`."*
3. Exit 0.

#### Step 3b — gaps found

1. Print a summary table:

   ```
   PROPOSED (N)
     - meeting_note     (node) — covers 4 detected documents
     - cites            (edge) — covers 9 detected citations

   IMPROVEMENTS (M)
     - Document [split] → spec / runbook — 12 documents affected
   ```

2. If `--dry-run`: skip the prompt. Validate the payload via [scripts/cdx-propose-archetypes.js](../scripts/cdx-propose-archetypes.js) with `--dry-run` (which POSTs `?dryRun=true` to the server). Print result, do **not** write the lock. Exit 0.

3. If `--skip-submit`: write `.contextdx/proposed-archetypes.json`. Write the lock with `skippedAt: <ts>` (scan completed but submission was opted out — Phase 1 is *not* settled). Print: *"Proposals written for manual review. Edit the file and re-run /analyze-archetypes when ready. /analyze-docs will re-prompt until Phase 1 finishes."* Exit 0.

4. Otherwise (interactive default): use AskUserQuestion with three options:
   - **Submit for review** (recommended) — proceed to Step 4.
   - **Edit first** — write `.contextdx/proposed-archetypes.json`. Write the lock with `skippedAt: <ts>` (same rationale as `--skip-submit` — Phase 1 is mid-flight). Print: *"Edit the file then re-run /analyze-archetypes to submit."* Exit 0.
   - **Skip and proceed** — write the lock with `skippedAt: <ts>`. Print: *"Skip is one-shot: every subsequent /analyze-docs will re-prompt until you run /analyze-archetypes and submit (or confirm no gaps). Running /analyze-docs now will type affected documents and concepts with misfit archetypes. Re-run /analyze-archetypes then /analyze-docs --clean after the missing archetypes land in the catalogue."* Exit 0.

> **Lock-shape note:** in all three branches the lock must include `commitHash` and `catalogueHash` (from Step 1) so [cdx-precondition.js](../scripts/cdx-precondition.js) can detect when subsequent /analyze-docs runs are still aligned with this scan. `skippedAt` is always non-null in these branches — that field is what makes the precondition re-prompt.

### Step 4: Submit

Write `.contextdx/proposed-archetypes.json` with the payload from Step 2. Then invoke the submission CLI:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cdx-propose-archetypes.js \
  --proposals .contextdx/proposed-archetypes.json \
  --source-host claude --source-domain work \
  ${replace:+--replace} \
  ${force:+--force}
```

Parse the JSON output:

- `success: true` + `serverResult.acceptedProposed/acceptedImprovements`: print accepted count; record `proposalIds[]` from the response into the lock; set `submittedAt: <ts>`.
- `serverResult.rejected[]` non-empty: each entry has `existingProposalId` — surface to the user with the hint *"Already pending as proposalId=<id>; re-run with --replace to update it."*
- `success: false` + `serverResult.notAvailable: true`: server endpoint not deployed yet — leave the proposals file on disk; tell the user to retry after deployment. Do not write the lock.
- `errorCode: 3` (validation): surface `validated.errors[]`; let the user edit `.contextdx/proposed-archetypes.json` and re-run.

On success, print: *"N proposals submitted for admin review. The catalogue will be updated once an admin approves them in the ContextDX UI. Re-run `/analyze-archetypes` after approval, then proceed with `/analyze-docs`."*

### Step 5: Persist lock

`.contextdx/archetype-analysis.lock.json` is the single source of truth used by [cdx-precondition.js](../scripts/cdx-precondition.js) (invoked by `/analyze-docs` Step -1) and `/status` (display). Fields:

- `commitHash` — document-set digest (or git HEAD) at scan time
- `catalogueHash` — hash of archetype-name list at scan time
- `scannedAt` — ISO timestamp of the scan
- `submittedAt` — ISO timestamp if proposals were POSTed, else `null`
- `skippedAt` — ISO timestamp if the user opted to proceed with misfits, edit-first, or `--skip-submit`, else `null`. **Non-null `skippedAt` always re-prompts on the next `/analyze-docs`** — it is intentionally not silenced.
- `proposalIds[]` — server-returned IDs for any submitted proposals (used by `/status` to query pending state)

Mapping from lock state to precondition status:

| Lock state | Precondition status | /analyze-docs behaviour |
| ---------- | ------------------- | ----------------------- |
| missing or hashes mismatch | `missing` / `stale_commit` / `stale_catalogue` | re-prompts |
| `skippedAt` set | `skipped` | re-prompts (one-shot semantics) |
| `submittedAt` + non-empty `proposalIds[]` | `pending` | warns and continues |
| `skippedAt: null`, `submittedAt: null`, empty `proposalIds[]`, hashes match | `ok` | proceeds silently |

Only Step 3a (no gaps) and Step 4 (after admin approval — re-running this command finds no new gaps) produce the `ok` state.

## Notes

- Approved proposals appear in the server's work-board archetype catalogue after admin review in the ContextDX UI. Until then, the live catalogue is unchanged — `/analyze-docs` will warn if you have pending proposals submitted.
- This command does **not** write board JSONs. It is a pre-analysis vocabulary check only.
- See [knowledge/concept-extraction/SKILL.md](../knowledge/concept-extraction/SKILL.md) for what makes a good proposal and what should be skipped in the knowledge vocabulary.
