---
name: contextdx-integration
user-invokable: false
description: Integrates with the Claude Code Plugin API to push architecture data for visualization on ContextDX workboards. Use when user asks to "sync to ContextDX", "push architecture to portal", "configure API", "connect to portal", "upload nodes", or "sync edges". Provides API patterns, authentication, and sync protocols.
license: MIT
compatibility: Claude Code plugin. Requires Node.js 18+ for bundled scripts.
metadata:
  author: ContextDx
  version: 0.2.0
---

# ContextDX Integration

## Overview

This skill provides guidance for integrating with the Claude Code Plugin API to push architecture data to ContextDx workboards.

---

## Authentication

Store credentials in `.contextdx/config.json`:

```json
{
  "bindingToken": "YWJjMTIzLXV1aWQ6ZGVmNDU2LXV1aWQ",
  "apiSecret": "ck_cp_live_your_api_secret_here",
  "baseUrl": "https://platform.contextdx.com/api",
  "branch": "main",
  "excludePaths": [
    "node_modules",
    "dist"
  ],
  "includeTests": false
}
```

### Request Headers

All API requests require header-based authentication:

```
X-CodePlugin-Token: {bindingToken}
X-CodePlugin-Secret: {apiSecret}
Content-Type: application/json
```

---

## API Endpoints

| Method | Endpoint                    | Description              |
| ------ | --------------------------- | ------------------------ |
| POST   | `/code-plugin/push`       | Push nodes and edges     |
| GET    | `/code-plugin/archetypes` | Get available archetypes |
| GET    | `/code-plugin/elements`   | Get existing nodes/edges |

### Push Modes

| Mode      | Behavior                                |
| --------- | --------------------------------------- |
| `merge`   | Create or update by slug, keep existing |
| `replace` | Delete all existing, create new         |

See `references/api-reference.md` for complete endpoint documentation with request/response examples.

### Data Transformation

When converting from internal format to ContextDX:

| Internal Field         | ContextDX Field   | Notes                                                   |
| ---------------------- | -------------------- | ------------------------------------------------------- |
| `node.id`              | `slug`               | Direct mapping                                          |
| `node.name`            | `name`               | Direct mapping                                          |
| `node.type`            | `archetypeName`      | service→Container, component→Component, external→System |
| `node.type` + children | `primitiveType`      | 'container' if has children, else 'node'                |
| `node.parent`          | `parentNodeSlug`     | Direct mapping                                          |
| `node.path`            | `sourceReferences[]` | Wrap in array                                           |
| `edge.sourceSlug`      | `sourceSlug`         | Direct mapping (pass-through)                           |
| `edge.targetSlug`      | `targetSlug`         | Direct mapping (pass-through)                           |
| `edge.type`            | `relation`           | Direct mapping                                          |
| -                      | `edge.archetypeName` | Always "Relationship"                                   |

---

## Sync Workflow

### Full Sync

1. **Load configuration** - Read ContextDX credentials
2. **Load board manifest** - Read `.contextdx/boards/manifest.json`
3. **Load analysis data** - Read `.contextdx/boards/<board-slug>.json`
4. **Transform data** - Convert internal format to ContextDX format
5. **Push data** - Single push via `/code-plugin/push` with `--board-slug`
6. **Update status** - Save sync results to board store

### Status Tracking

Sync state is stored per-board in `.contextdx/boards/stores/<board-slug>.store.json`. Changed files are detected on-demand via `git diff` against the `analyzedAtCommit` hash stored in board metadata.

---

## Error Handling

| Status | Meaning                         | Action                            |
| ------ | ------------------------------- | --------------------------------- |
| 400    | Invalid payload/branch mismatch | Check request format              |
| 401    | Invalid credentials             | Verify bindingToken and apiSecret |
| 403    | Access denied                   | Check binding permissions         |
| 404    | Binding not found               | Verify configuration              |
| 422    | Invalid data format             | Validate node/edge structure      |

---

## Configuration Reference

| Field          | Required | Default                   | Description                 |
| -------------- | -------- | ------------------------- | --------------------------- |
| `bindingToken` | Yes      | -                         | Combined auth token from UI |
| `apiSecret`    | Yes      | -                         | API secret (ck_cp_live_xxx format) |
| `baseUrl`      | No       | https://platform.contextdx.com/api | API endpoint                |
| `branch`       | Yes      | -                         | Git branch name             |
| `excludePaths` | No       | []                        | Paths to exclude            |
| `includeTests` | No       | false                     | Include test files          |

---

## Examples

### Example 1: Push architecture analysis to ContextDX

User says: "Sync my analysis to ContextDX"

Actions:
1. Load configuration from `.contextdx/config.json`
2. Load analysis data from `.contextdx/boards/<board-slug>.json`
3. Transform nodes and edges to ContextDX format
4. Push via `POST /code-plugin/push` with smart sync (diff-based)

Result: Architecture data synced — nodes created/updated, edges linked on the workboard

### Example 2: Configure API connection

User says: "Connect to ContextDX"

Actions:
1. Read credentials from `.contextdx/config.json`
2. Validate by fetching archetypes from API
3. Discover root board from server
4. Write `.contextdx/config.json` with credentials

Result: Configuration saved, connection verified, ready for `/analyze` and `/sync`

## Troubleshooting

### Error: 401 Invalid credentials
**Cause:** bindingToken or apiSecret is incorrect or expired
**Solution:** Re-run `/configure` with fresh credentials from the ContextDX UI

### Error: 400 Branch mismatch
**Cause:** The `branch` in config doesn't match the workboard binding
**Solution:** Update `branch` in `.contextdx/config.json` to match the binding

### Error: 422 Invalid data format
**Cause:** Nodes or edges have invalid structure (missing slug, bad archetypeName)
**Solution:** Run `/analyze --clean` to regenerate analysis, then retry `/sync`

## Additional Resources

### Reference Files

- **`references/api-reference.md`** - Complete API endpoint documentation
- **`references/error-codes.md`** - Error handling guide
