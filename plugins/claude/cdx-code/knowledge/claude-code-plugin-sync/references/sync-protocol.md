# Sync Protocol

Documents the sync workflow used by `cdx-sync.js` to push analysis data to ContextDX.

## Smart Sync (Recommended)

Use `--smart-sync` for diff-based syncing. This minimizes API calls by only pushing changed elements.

**Workflow:**
1. **Get archetypes** (cached, 1-hour TTL) — validate archetype names in transformed data
2. **Pull server elements** (if stale or forced) — fetch current state from `GET /code-plugin/elements`
3. **Track local elements** — hash each node/edge and store in the element store file
4. **Compute diff** — compare local hashes against server state to find new, changed, unchanged, and server-only elements
5. **Push changes** — send only new/changed elements via `POST /code-plugin/push`
6. **Update store** — mark pushed elements as synced

**Diff result fields:**
- `newNodes` / `newEdges` — elements not on server
- `changedNodes` / `changedEdges` — elements with different content hash
- `unchangedNodes` / `unchangedEdges` — identical to server
- `serverOnlyNodes` / `serverOnlyEdges` — on server but not in local analysis

## Legacy Sync (Direct Push)

Without `--smart-sync`, all elements are pushed every time:
1. Load config and analysis data
2. Transform to ContextDX format
3. Validate archetypes against server
4. Push all nodes and edges

## Dry Run

Use `--dry-run` to validate and transform without pushing. Works with both smart sync and legacy modes.

## Force Options

- `--force-pull` — Always fetch server elements, ignoring the staleness threshold (5 min default)
- `--force-push` — Push all elements regardless of diff (overrides smart sync optimization)

## Error Handling

- **Config errors** (exit 1): Missing or invalid configuration file
- **Analysis errors** (exit 2): Missing or unparseable analysis JSON
- **Validation errors** (exit 3): Invalid slugs, names, or archetype names
- **API errors** (exit 4): Network failures, auth errors, push errors

Auth failures (401/403) always fail immediately. Other server errors during pull are gracefully degraded (sync continues with local-only data).
