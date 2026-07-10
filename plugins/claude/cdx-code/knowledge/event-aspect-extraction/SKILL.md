---
name: event-aspect-extraction
user-invokable: false
description: Extracts a repository's event/messaging catalog (channels, event types, subscriptions) into an EventCatalogPayload for /adopt --aspect event.catalog. Use when adopting the event.catalog aspect. Reads AsyncAPI specs, Kafka/kafkajs configs, AWS SQS/SNS/EventBridge infra-as-code, RabbitMQ, Google Pub/Sub, Redis Streams, or NATS declarations — never connects to a live broker.
license: MIT
compatibility: Claude Code plugin. Requires a synced spine (.contextdx/boards/<board>.json) so channels can link to node slugs.
metadata:
  author: ContextDx
  version: 0.1.0
---

# Event Catalog Extraction (event.catalog aspect)

Extract the **declared** messaging surface and shape it into an `EventCatalogPayload`:
`{ channels: [ { …channel fields, ownerSlug, producers[], consumers[], eventTypes[], subscriptions[] } ] }`.
Each channel nests its own `eventTypes[]` and `subscriptions[]` — they travel together on the wire for
authoring ergonomics, but the server reconciles all three as independent rows.

## Golden rule — read this first, it's the opposite of `ui.pages`

**`channels[].slug` is a FRESH aspect-local identity you mint — it must NOT be an existing spine node
slug.** This is the reverse of the `ui.pages` rule (where `Page.slug` had to reuse a node the spine
already had): a channel is its own thing (a topic, queue, or stream), not a node in the architecture
graph. Mint one stable kebab-case slug per channel (e.g. `order-events`, `user-created-v2`) and keep it
stable across re-extracts — the server reconciles by it, same as a table or endpoint slug. The node-ref
fields are elsewhere: `ownerSlug`, `producers[]`, `consumers[]`, and `subscriptions[].consumerNode` are
the ones that must resolve against the spine — never the channel's own `slug`.

## Other golden rules

1. **Read definitions, never connect.** No broker connection, no consuming/producing a test message, no
   admin-API calls to a live cluster. Parse AsyncAPI specs, infra-as-code, and client-library call sites
   statically.
2. **Leave human-tier fields empty.** Do **not** fill `owners`, `textual` (on channels or event types),
   `deprecated` (event types), or `deliveryGuaranteeOverride` (subscriptions — that's an architect's
   explicit override of the channel default, not something to infer). The server strips these from
   ingest anyway (D4); guessing only creates noise.

## Sources, by broker

`broker` is a closed enum — use exactly one of these eight values, matching what you find:

| Source | Where it lives | `broker` value |
| --- | --- | --- |
| **AsyncAPI spec** | `asyncapi.{json,yaml}` — the richest single source; read this first if present, it maps directly to channels/messages/operations | per `servers[].protocol` |
| **Kafka** | topic configs, `kafkajs`/`node-rdkafka` producer/consumer instantiation, Confluent Schema Registry subject registrations | `kafka` |
| **AWS SQS** | CDK/Terraform/SAM `AWS::SQS::Queue`, `@aws-sdk/client-sqs` call sites | `sqs` |
| **AWS SNS** | CDK/Terraform/SAM `AWS::SNS::Topic`, `@aws-sdk/client-sns` call sites | `sns` |
| **AWS EventBridge** | CDK/Terraform/SAM `AWS::Events::Rule` / `EventBus`, `@aws-sdk/client-eventbridge` call sites | `eventbridge` |
| **RabbitMQ** | `amqplib` exchange/queue/binding declarations | `rabbitmq` |
| **Google Pub/Sub** | Terraform/gcloud topic + subscription resources, `@google-cloud/pubsub` client | `pubsub` |
| **Redis Streams** | `XADD`/`XREADGROUP` call sites, stream key declarations | `redis-stream` |
| **NATS** | subject declarations, `nats`/`nats.ws` client instantiation, JetStream stream configs | `nats` |

**Never call a live broker's admin API or connect to consume/produce a probe message** — read the
declarations (IaC, config files, client instantiation call sites) the same way `database.schema` reads
ORM schemas without booting the app.

## Per-channel fields

- `slug` — see the golden rule above (fresh mint, not a spine slug).
- `broker`, `channelName` (the raw topic/queue/subject/stream name as declared).
- `ordering` — `fifo` | `unordered` | `per-partition-key`, or `null` if not determinable.
- `deliveryGuarantee` — `at-least-once` | `at-most-once` | `exactly-once`, or `null`. Read the broker's
  actual configuration (e.g. Kafka `acks`/idempotent producer config, SQS FIFO vs standard) — don't
  default to a guess.
- `dlq` — the dead-letter target, if configured. Emit whatever string identifies it (another channel's
  slug if it's modeled here, otherwise the raw queue/ARN name) — this field is deliberately unchecked
  against anything, so a best-effort string is fine.
- `transport` — the delivery-mechanics bag, `null` if none of it applies:
  - `schemaRegistry` — `{ kind: 'confluent'|'glue'|'apicurio'|'other', subject, compatibility }`, when a
    schema registry governs this channel's payloads.
  - `retention`, `partitionKey` — raw strings as configured (retention window, partition/routing key
    expression).
  - `cloudEventsEnvelope` — `true` if messages are wrapped in a CloudEvents envelope.
  - `consumerGroups` — known consumer group / subscription-name identifiers at the transport level.
  - `redrivePolicy` — `{ maxReceiveCount, deadLetterTarget }` when a redrive/DLQ policy is configured;
    `deadLetterTarget` follows the same "best-effort string, unchecked" rule as `dlq` above.
  - `visibilityTimeoutSeconds` — queue visibility timeout, where applicable (SQS-style brokers).

## `eventTypes[]` — the typed messages a channel carries

`{ name, payloadSchema, schemaVersion, deprecated, textual }` — one entry per distinct message/event type
published on the channel (a Kafka record type, an EventBridge `detail-type`, a CloudEvents `type`).
`name` is channel-unique and is the join key `subscriptions[].eventTypeName` points at (see below).
`payloadSchema` is whatever schema you can find verbatim (JSON Schema, Avro, protobuf descriptor) — opaque
is fine, don't hand-write one. Leave `deprecated`/`textual` at their defaults (human-tier).

## `subscriptions[]` — who's listening, and to what

`{ eventTypeName, consumerNode, consumerGroup, filterExpression, deliveryGuaranteeOverride }` — one entry
per distinct consumer binding.

- **`eventTypeName`** — `null` means "subscribes to the whole channel"; set it to name one specific typed
  event. **It must match a `name` in this SAME channel's own `eventTypes[]`** — `/adopt` validates this
  locally before pushing (a blocking error, not a spine warning, since it's the extraction contradicting
  itself, not an unsynced reference). Never point it at another channel's event type.
- **`consumerNode`** — the node slug of the service holding this subscription. Must resolve against the
  spine like any other node-ref field (unlike `eventTypeName`, which is purely intra-payload).
- `consumerGroup` — the raw consumer-group/subscription-name identifier, if the broker has one.
- `filterExpression` — a raw filter/selector string (SNS filter policy, EventBridge pattern, RabbitMQ
  binding key), if one gates this subscription.
- Leave `deliveryGuaranteeOverride` `null` (human-tier — see golden rules above).

## Owner + producers/consumers — linking to the spine

Read `.contextdx/boards/<board-slug>.json` for the node `slug`s the spine already has. Every node-ref
field below must be one of them (except `channels[].slug` itself — see the golden rule):

- **`ownerSlug`** — the node that *owns* the channel: the service that provisions/defines the
  topic/queue/stream (e.g. the `order-service` node for an `order-events` topic it creates). Omit
  (`null`) if unsure — the D5 pass heals it after the next `/sync`.
- **`producers[]`** — node slugs of every service that *publishes* to this channel. Raw slugs, not a
  `{nodeSlug, relation, evidence}` shape (this aspect has no generic `references[]` list — producers and
  consumers ARE the reference shape here).
- **`consumers[]`** — node slugs of every service that *consumes* from this channel at the channel level
  (broad awareness). Use `subscriptions[].consumerNode` instead when you can identify the specific
  binding — a service can appear in both if useful.
- Unknown slugs are kept unresolved and auto-heal on the next `/sync` — emit them, don't drop them.

## Cross-aspect tip

If you're also adopting `api.surface` for this repo, an endpoint's `outboundEvents[].channelSlug` can
point at a channel modeled here — keep the channel `slug` you mint identical across both extractions so
the two aspects reconcile against the same identity instead of silently describing two different
channels with the same name.
