# Asynchronous Events and Transactional Outbox

**Status:** PROPOSED. V1 uses PostgreSQL-backed outbox processing, not Kafka.

## Atomic publication

The API writes the domain change and an `outbox_events` row in the same PostgreSQL transaction. A worker claims committed rows with short leases (`FOR UPDATE SKIP LOCKED` or equivalent), dispatches handlers, and records attempt/next-attempt/processed state. Therefore an event is delivered **at least once**; consumers must be idempotent. Outbox payloads are minimal, versioned facts with IDs, never secrets or unnecessary message content.

Envelope fields: immutable event UUID, event type/version, aggregate type/ID/version, occurred-at, producer module, actor/service reference where necessary, request/correlation/causation IDs, trusted distribution scope, and minimal payload. Consumers tolerate unknown additive fields. Events are facts in past tense: `DropCreated`, `DropDeleted`, `UserFollowed`, `DropLiked`, `CommentCreated`, `ClubJoined`, `MessageCreated`, and `ReportCreated`.

## Retry safety

Each handler maintains an inbox/processing receipt keyed by `(consumer, event_id)` or writes a result with an equivalent unique business key in the same transaction. State transitions use compare-and-set; external effects use deterministic provider keys. Failures use bounded exponential backoff with jitter. Permanent/schema failures enter a dead-letter state with alerting and controlled replay; poison events cannot block the partition indefinitely.

Ordering is guaranteed only per aggregate version where required. Consumers reject/defer gaps and ignore older versions; no global ordering is promised. Ranking uses event occurrence plus server receipt time and recomputation. Cancellation/deletion is expressed as a new event, not mutation of history.

## Worker groups

- Media processing: quarantine validation/transformation and reconciliation.
- Notifications: preference/privacy/block check, inbox write, delivery fan-out.
- Search/read models: bounded index projection and repair.
- Feed/trending/Top 100: scoped aggregation and snapshot publication.
- Safety/moderation/audit integrations: case creation and policy propagation.
- Maintenance: expired sessions/intents, retention and orphan cleanup under approved policy.

Worker credentials and concurrency are least-privilege per group even if the same artifact is used. Backpressure prioritizes security/moderation and user-visible durable work over analytics.

## Observability and operations

Measure outbox oldest age, publish/handler latency, attempts, failures, dead letters, lease expiry and per-consumer lag. Trace via correlation/causation IDs without personal payload. Reconciliation jobs compare authoritative rows to projections. Retention/archival is policy-driven; deletion of outbox history must not remove required immutable audit evidence. Introduce a broker only after measured PostgreSQL contention/throughput or isolation needs exceed the simpler design.
