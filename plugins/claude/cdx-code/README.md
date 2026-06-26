# Cdx Code

The `cdx-code` plugin — codebase architecture analysis for [ContextDX Portal](https://contextdx.com). Discovers your project's components, classifies them against your org's archetype catalogue, maps relationships, and syncs the result as a layered architecture board you can review and share.

Cdx Code runs in **Claude Code**. Its sibling, **Cdx Work** (`cdx-work`), does the same for a document set → a knowledge board. Both emit the same node/edge wire model and sync through the same engine.

## Install

Add the ContextDX marketplace once, then install the plugin:

```bash
/plugin marketplace add contextdx/cdx-claude
/plugin install cdx-code@contextdx
```

Restart Claude Code so the commands load. Scope the install with `--scope user` (default), `--scope project`, or `--scope local`. Claude **Cowork** installs from the same marketplace.

> `cdx-code` is the install id — everywhere else it's **Cdx Code**.

## Configure

Get a **Binding Token** and **API Secret** from the ContextDX Portal (**Sources → Add Source → Board Builder** — saving generates the secret), then create `.contextdx/config.json` at your repo root:

```json
{
  "bindingToken": "your-base64url-binding-token",
  "apiSecret": "ck_cp_live_your_api_secret",
  "boardSlug": "my-project-overview",
  "branch": "main",
  "baseUrl": "https://api.contextdx.com"
}
```

| Field | Required | Notes |
|---|---|---|
| `bindingToken` | yes | Base64url `orgId:bindingId` from the portal. Sent as `X-CodePlugin-Token`. |
| `apiSecret` | yes | Must start with `ck_cp_live_`. Sent as `X-CodePlugin-Secret`. |
| `boardSlug` | yes | Target board. `/configure` can discover and write it for you. |
| `branch` | yes | Must match the binding, or `/sync` returns `400 Branch Mismatch`. |
| `baseUrl` | no | Override for self-hosted (default `https://api.contextdx.com`). |
| `excludePaths` | no | Paths skipped during analysis (default `node_modules, dist, .git, coverage`). |
| `includeTests` | no | Include test files in analysis (default `false`). |
| `includeSourceReferences` | no | Attach file-path references to synced nodes/edges (default `true`). |

Run `/configure` to validate the config, test the connection, and add `.contextdx/` to your `.gitignore`. Credentials live only in this file — never logged, and sent only to `api.contextdx.com`.

## Quick start

The plugin uses a **two-phase workflow**: first settle the archetype vocabulary, then describe the system.

1. `/configure` — connect to the portal (one-time per repo)
2. `/analyze-archetypes` — **Phase 1**: scan for component categories, surface gaps in the server archetype catalogue, submit proposals for admin review
3. `/analyze` — **Phase 2**: full architecture analysis (incremental — only changed files re-analyzed)
4. `/sync` — push the analysis to your board
5. `/insights` — run server-defined analyses (security, performance, etc.) against the board
6. `/status` — see what's analyzed, the archetype precondition state, and what's synced

If `/analyze` is invoked before `/analyze-archetypes` has run for the current codebase + catalogue state, it prompts you to run Phase 1 first.

## Supported languages

Automatically detects projects in 7+ languages via their manifest files:

| Language | Manifest | Common frameworks |
|---|---|---|
| **JS/TypeScript** | `package.json` | Next.js, NestJS, Express, React, Angular, Vue |
| **Python** | `requirements.txt`, `pyproject.toml`, `Pipfile` | Django, FastAPI, Flask, Celery |
| **Java** | `pom.xml`, `build.gradle` | Spring Boot, Quarkus, Micronaut |
| **Go** | `go.mod` | Gin, Echo, Fiber, gRPC |
| **C# / .NET** | `*.csproj`, `*.sln` | ASP.NET Core, Blazor, EF |
| **Ruby** | `Gemfile` | Rails, Sinatra, Sidekiq |
| **Rust** | `Cargo.toml` | Actix, Axum, Rocket |

Polyglot projects produce a unified board with cross-language relationships (HTTP, gRPC, message queues).

## Commands

| Command | Description |
|---|---|
| `/configure` | Set up portal credentials and preferences |
| `/analyze-archetypes` | Phase 1 — scan for archetype gaps, submit proposals if needed |
| `/analyze-archetypes --dry-run` | Validate scan locally + ask server to dry-run, don't persist or POST |
| `/analyze-archetypes --skip-submit` | Write the proposals file for manual review; don't POST |
| `/analyze-archetypes --replace` | When submitting, send `mode='replace'` to overwrite pending payload |
| `/analyze [path]` | Phase 2 — analyze codebase architecture (incremental; re-analyzes only changed files) |
| `/analyze --clean` | Full re-analysis from scratch, ignoring existing board data |
| `/analyze --drill <board>/<node>` | Drill into a node to produce a child layer board |
| `/analyze --all` | Re-analyze every layer board in the manifest |
| `/sync [--board <slug>]` | Push analysis to portal (smart diff: only changed elements) |
| `/sync --all` | Push every board in the manifest |
| `/insights` | List available insight skills and run one against the current board |
| `/insights <skill-slug>` | Run a specific insight skill directly |
| `/insights --all` | Run every available insight skill |
| `/demo-insights [count] [--board <slug>]` | Seed a board with a few demonstrative, path-rich insights to showcase the insights feature |
| `/status` | Show config state, archetype precondition, analysis summary, and per-board sync status |
| `/help` | List commands and show the plugin version |

## Layered boards

For non-trivial codebases, `/analyze` produces a hierarchy of boards so you can navigate from a 10–30 node overview down to component-level detail without overwhelming any single view:

| Layer | Name | Scope | Target node count |
|---|---|---|---|
| **L0** | Overview | Entire project | 10–30 |
| **L1** | Domain | Domain or workspace drill-down | 10–40 per board |
| **L2** | Component | Service or module drill-down | 5–20 per board |
| **L3** | Detail | Deep internals (opt-in) | 5–15 per board |

Board hierarchy and per-board sync state live in `.contextdx/boards/`:

- `manifest.json` — every board's slug, layer, parent, and analysis state
- `<board-slug>.json` — analysis output (nodes + edges) for that board
- `stores/<board-slug>.store.json` — sync state, content hashes, last push

## Archetypes (server-defined, precondition-driven)

Components are classified using archetypes defined on your ContextDX server, **not** a fixed list shipped with the plugin. `/analyze` fetches the current catalogue via `/code-plugin/archetypes` and the architecture-analyzer agent assigns each discovered node a valid archetype name.

If your codebase has patterns that don't fit any existing archetype well, `/analyze-archetypes` surfaces them **before** any board is produced and submits proposals (new archetypes or improvements to existing ones) for human review. The catalogue gets settled first so every component on the board gets a fit archetype — no misfits, no post-hoc retyping.

The two-phase split (`/analyze-archetypes` then `/analyze`) is the supported workflow. `/analyze` will detect a stale or missing precondition and prompt to run Phase 1 first.

Open the ContextDX UI to see the current archetype catalogue — the plugin fetches it automatically during `/analyze-archetypes` and `/analyze`.

## Output format

Analysis output at `.contextdx/boards/<board-slug>.json`:

```json
{
  "metadata": {
    "analyzedAt": "2026-05-13T10:30:00Z",
    "analyzedAtCommit": "abc1234",
    "projectName": "my-project",
    "languages": ["python", "typescript"],
    "techStacks": ["fastapi", "react"],
    "layer": 0
  },
  "nodes": [
    {
      "slug": "user-service",
      "name": "User Service",
      "type": "<server-archetype-name>",
      "description": "User management service",
      "path": "src/services/user_service.py",
      "parentSlug": "backend-domain",
      "metadata": { "language": "python", "framework": "fastapi" }
    }
  ],
  "edges": [
    {
      "sourceSlug": "user-service",
      "targetSlug": "user-repository",
      "type": "<server-edge-archetype-name>",
      "metadata": { "importPath": "from .repository import UserRepository" }
    }
  ]
}
```

The `type` field holds the server archetype name assigned by the analyzer. Edge `type` values come from the edge-archetype list returned by the same endpoint.

## Agents

| Agent | Role |
|---|---|
| **architecture-analyzer** | Multi-language structure analysis, archetype classification, domain grouping, hierarchy building |
| **relationship-detector** | Imports, DB operations, HTTP/gRPC calls, message queue patterns across languages |

`/analyze` orchestrates both agents. They can also be invoked directly from Claude Code's subagent picker to debug a specific analysis step.

## Requirements

- Node.js (for the bundled CLI scripts)
- A ContextDX Portal account with a Board Builder source bound to your board
- Git repo (incremental analysis uses `git diff` for change detection)

## License

BUSL-1.1
