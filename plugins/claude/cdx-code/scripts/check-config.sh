#!/bin/bash
# ContextDX - Session Start Hook
# Scaffolds .contextdx/config.json (skeleton) on first run, then reports
# configuration status.

set -euo pipefail

# Host-agnostic project directory: Claude Code sets CLAUDE_PROJECT_DIR, Codex sets
# CODEX_PROJECT_DIR; fall back to the current working directory otherwise.
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-${CODEX_PROJECT_DIR:-$PWD}}"

CONTEXTDX_DIR="$PROJECT_DIR/.contextdx"
CONFIG_FILE="$CONTEXTDX_DIR/config.json"
BOARDS_DIR="$CONTEXTDX_DIR/boards"
MANIFEST_FILE="$BOARDS_DIR/manifest.json"
GITIGNORE_FILE="$PROJECT_DIR/.gitignore"

output=""

# Write a skeleton config with empty credentials and sane defaults. Empty
# bindingToken/apiSecret/boardSlug are treated as "not configured" by the
# config reader, so the skeleton never masquerades as a real config.
write_skeleton() {
    mkdir -p "$CONTEXTDX_DIR"
    cat > "$CONFIG_FILE" <<'JSON'
{
  "bindingToken": "",
  "apiSecret": "",
  "baseUrl": "https://platform.contextdx.com/api",
  "branch": "main",
  "boardSlug": "",
  "excludePaths": ["node_modules", "dist", ".git", "coverage"],
  "includeTests": false
}
JSON
}

# Keep credentials out of version control once the user fills them in.
# Only touch .gitignore inside an actual git repo.
ensure_gitignored() {
    [ -d "$CLAUDE_PROJECT_DIR/.git" ] || return 0
    if [ -f "$GITIGNORE_FILE" ]; then
        if ! grep -qE '^\.contextdx/?$' "$GITIGNORE_FILE"; then
            printf '\n# ContextDX local state (contains credentials)\n.contextdx/\n' >> "$GITIGNORE_FILE"
        fi
    else
        printf '# ContextDX local state (contains credentials)\n.contextdx/\n' > "$GITIGNORE_FILE"
    fi
}

# True only when both required credentials are present and non-empty.
has_credentials() {
    [ -f "$CONFIG_FILE" ] || return 1
    local token secret
    token=$(jq -r '.bindingToken // ""' "$CONFIG_FILE" 2>/dev/null || echo "")
    secret=$(jq -r '.apiSecret // ""' "$CONFIG_FILE" 2>/dev/null || echo "")
    [ -n "$token" ] && [ -n "$secret" ]
}

if [ ! -f "$CONFIG_FILE" ]; then
    # First run in this project: scaffold a skeleton the user can fill in.
    write_skeleton
    ensure_gitignored
    output="Created .contextdx/config.json. Run /login to connect in your browser, or add your ContextDX credentials to that file manually and run /configure to verify."
elif ! has_credentials; then
    output="ContextDX config.json found but credentials are empty. Run /login to connect in your browser, or fill in bindingToken and apiSecret in .contextdx/config.json and run /configure to verify."
else
    output="ContextDX configuration found."

    # Check boards directory and manifest
    if [ -f "$MANIFEST_FILE" ]; then
        board_count=$(jq -r '.boards | length // 0' "$MANIFEST_FILE" 2>/dev/null || echo "0")
        output="$output $board_count board(s) analyzed."
    else
        output="$output No analysis found. Run /analyze to scan your codebase."
    fi
fi

echo "$output"
exit 0
