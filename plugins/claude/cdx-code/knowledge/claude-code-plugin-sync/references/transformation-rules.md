# Code Archetype Transformation Rules

Transforms analysis nodes/edges to ContextDX format for visualization.

## Node Transformation

The `node.type` field already contains the server archetype name (assigned during analysis using archetypes fetched from the server). The transformer passes it through directly:

- `archetypeName` = `node.type` (pass-through)
- `primitiveType` = `'container'` if the node has children, otherwise `'node'`

No hard-coded archetype mapping is used. The analysis agent is responsible for assigning valid server archetype names to each node's `type` field.

## Edge Transformation

The `edge.type` field already contains the server archetype name. The transformer passes it through directly:

- `archetypeName` = `edge.type` (pass-through)
- `relation` = `edge.type`

## Slug Generation

- Node slugs are derived from the node `slug` field
- Must be 1-200 characters, kebab-case
- Parent-child relationships preserved via `parentNodeSlug`

## Tags

Nodes are tagged with:
- The archetype name (from `node.type`)
- Framework name (lowercase) if available
- Language name (lowercase) if available

## Source References

When `sourceSlug` and `sourceId` are provided, file paths are attached as source references for code traceability.
