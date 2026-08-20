# Realtime, Cache, and Rate-Limit Stack

**Status:** ACCEPTED

## WebSocket delivery

Use provider-agnostic authenticated **WebSockets** for 1:1 chat and timely notification hints. The API commits messages, read state, and a transactional outbox event to PostgreSQL before attempting realtime delivery. Socket payloads carry minimal durable identifiers/sequences; clients reconcile missed state through authorized APIs using a cursor. PostgreSQL remains authoritative through disconnects, retries, reordering, and duplicate delivery.

Require heartbeat/expiry, bounded buffers, message and connection limits, backpressure, origin and session validation, periodic authorization re-checks, graceful connection draining, and reconnect jitter. Fetch, send, subscribe, and delivery paths enforce current block/privacy/membership policy. Do not expose private content through connection errors or logs.

Cross-instance fan-out must sit behind a WYN interface. Begin without a dedicated realtime vendor. A managed realtime provider is considered only when measured concurrent connections, fan-out, availability, or on-call burden justify its privacy, cost, and lock-in trade-offs.

## Optional Redis-compatible service

Redis is never authoritative. At very low scale, defer provisioning if database- and instance-local mechanisms safely meet requirements. When justified, use a managed Redis-compatible provider such as Upstash for ephemeral cross-instance fan-out/presence, bounded caches, and distributed rate-limit coordination. Use TLS, least privilege, non-sensitive keys, short TTLs, namespaces, and explicit outage behavior.

On Redis loss, durable reads repair from PostgreSQL, optional cache/presence degrades, and high-risk operations fail safely or use an approved conservative fallback. Redis must not contain the only copy of a message, session, permission, feature flag, job, or rate-limit evidence needed for correctness.
