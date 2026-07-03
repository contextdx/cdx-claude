# API Reference

This document covers the Claude Code Plugin API endpoints.

---

# Claude Code Plugin API

## Base URL

```
https://platform.contextdx.com/api
```

## Authentication

All requests require header-based authentication:

```
X-CodePlugin-Token: {bindingToken}
X-CodePlugin-Secret: {apiSecret}
Content-Type: application/json
```

---

## POST /code-plugin/push

Push nodes and edges to the workboard in a single request.

**Request:**

```http
POST /code-plugin/push
X-CodePlugin-Token: {bindingToken}
X-CodePlugin-Secret: {apiSecret}
Content-Type: application/json

{
  "nodes": [...],
  "edges": [...],
  "branch": "main",
  "mode": "merge"
}
```

**Request Body Fields:**

| Field    | Type               | Required | Description                             |
| -------- | ------------------ | -------- | --------------------------------------- |
| `nodes`  | ContextDXNode[] | Yes      | Array of nodes to push                  |
| `edges`  | ContextDXEdge[] | Yes      | Array of edges to push                  |
| `branch` | string             | No       | Must match binding's branch if provided |
| `mode`   | string             | No       | `merge` (default) or `replace`          |

**ContextDXNode Object:**

| Field                 | Type              | Required | Description                                 |
| --------------------- | ----------------- | -------- | ------------------------------------------- |
| `slug`                | string            | Yes      | Unique identifier (1-200 chars, kebab-case) |
| `name`                | string            | Yes      | Display name (2-100 chars)                  |
| `primitiveType`       | string            | Yes      | Visual type: node, container, region, etc.  |
| `archetypeName`       | string            | No       | Archetype from `/archetypes` endpoint       |
| `description`         | string            | No       | Brief description (max 500 chars)           |
| `detailedDescription` | string            | No       | Markdown-supported description              |
| `parentNodeSlug`      | string            | No       | Parent node slug for hierarchy              |
| `tags`                | string[]          | No       | Categorization tags                         |
| `sourceReferences`    | SourceReference[] | No       | Links to source code                        |

**ContextDXEdge Object:**

| Field                 | Type              | Required | Description                            |
| --------------------- | ----------------- | -------- | -------------------------------------- |
| `sourceSlug`          | string            | Yes      | Source node slug                       |
| `targetSlug`          | string            | Yes      | Target node slug                       |
| `archetypeName`       | string            | No       | Archetype (typically "Relationship")   |
| `relation`            | string            | No       | Relationship type (e.g., "depends-on") |
| `detailedDescription` | string            | No       | Markdown description                   |
| `tags`                | string[]          | No       | Categorization tags                    |
| `sourceReferences`    | SourceReference[] | No       | Links to source code                   |

**SourceReference Object:**

| Field        | Type   | Required | Description                   |
| ------------ | ------ | -------- | ----------------------------- |
| `sourceSlug` | string | Yes      | Source catalog slug           |
| `sourceId`   | string | Yes      | Source catalog ID             |
| `lineStart`  | number | No       | Starting line number          |
| `lineEnd`    | number | No       | Ending line number            |
| `excerpt`    | string | No       | Brief excerpt (max 500 chars) |

**Response (200 OK):**

```json
{
  "success": true,
  "nodesCreated": 5,
  "nodesUpdated": 3,
  "edgesCreated": 10,
  "edgesUpdated": 5,
  "errors": []
}
```

**Partial Success Response:**

```json
{
  "success": false,
  "nodesCreated": 5,
  "nodesUpdated": 2,
  "edgesCreated": 3,
  "edgesUpdated": 0,
  "errors": [
    {
      "type": "edge",
      "slug": "service-a--calls--unknown-service",
      "error": "Target node with slug \"unknown-service\" not found"
    }
  ]
}
```

---

## GET /code-plugin/archetypes

Retrieve available element archetypes.

**Request:**

```http
GET /code-plugin/archetypes
X-CodePlugin-Token: {bindingToken}
X-CodePlugin-Secret: {apiSecret}
```

**Response (200 OK):**

```json
{
  "archetypes": [
    {
      "name": "System",
      "description": "A software system",
      "visualPrimitiveType": "node",
      "canContain": ["Container", "Component"]
    },
    {
      "name": "Container",
      "description": "A container within a system (e.g., web app, database)",
      "visualPrimitiveType": "container",
      "canContain": ["Component"]
    },
    {
      "name": "Component",
      "description": "A component within a container",
      "visualPrimitiveType": "node",
      "canContain": []
    },
    {
      "name": "Relationship",
      "description": "A relationship between elements",
      "visualPrimitiveType": "edge",
      "canContain": []
    }
  ]
}
```

---

## GET /code-plugin/elements

Retrieve existing nodes and edges from the workboard.

**Request:**

```http
GET /code-plugin/elements
X-CodePlugin-Token: {bindingToken}
X-CodePlugin-Secret: {apiSecret}
```

**Response (200 OK):**

```json
{
  "nodes": [
    {
      "slug": "api-gateway",
      "name": "API Gateway",
      "description": "Main entry point",
      "primitiveType": "node",
      "archetypeName": "System",
      "parentNodeSlug": null,
      "tags": ["infrastructure"]
    }
  ],
  "edges": [
    {
      "slug": "api-gateway--routes-to--user-service",
      "sourceSlug": "api-gateway",
      "targetSlug": "user-service",
      "relation": "routes-to",
      "archetypeName": "Relationship",
      "name": "routes-to",
      "tags": []
    }
  ]
}
```

---

## Visual Primitive Types

| Type                | Description                              |
| ------------------- | ---------------------------------------- |
| `node`              | Discrete entities (services, components) |
| `container`         | Bounded grouping (domains, teams)        |
| `region`            | Soft grouping or swimlanes               |
| `edge`              | Relationships between nodes              |
| `axis`              | Dimensional scale (time, cost)           |
| `callout`           | Annotations                              |
| `leader_annotation` | Leader lines for annotations             |
| `text`              | Freeform text blocks                     |

---

## Push Modes

| Mode      | Behavior                                                                                                                         |
| --------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `merge`   | Upsert nodes/edges by slug. Existing matched by slug are updated, new ones created. Edges matched by source + target + relation. |
| `replace` | Clear all existing nodes/edges, then insert new ones. Use with caution.                                                          |

---

## Rate Limits (ContextDX)

| Endpoint     | Limit      |
| ------------ | ---------- |
| GET requests | 100/minute |
| POST /push   | 30/minute  |


---

## Error Codes

| Code | Description   | Resolution                            |
| ---- | ------------- | ------------------------------------- |
| 400  | Bad Request   | Check JSON structure, branch mismatch |
| 401  | Unauthorized  | Verify bindingToken and apiSecret     |
| 403  | Forbidden     | Check binding permissions             |
| 404  | Not Found     | Verify binding exists                 |
| 422  | Unprocessable | Validate node/edge structure          |
| 429  | Rate Limited  | Implement backoff                     |
