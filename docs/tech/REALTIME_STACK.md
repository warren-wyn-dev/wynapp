# Realtime, Chat, Cache and Rate Limits

**Status:** PROPOSED

## Realtime decision

Provide authenticated **WebSockets from the dedicated API runtime** for 1:1 chat and live notification hints. PostgreSQL commits the message/read state and outbox event first; realtime only announces durable IDs/sequences. On reconnect, clients send a cursor and fetch missed data through authorized HTTP APIs. Heartbeats, bounded buffers, per-user/device connection limits, backpressure and periodic reauthorization are required.

SSE is simpler and is a useful one-way notification fallback, but browser-to-server chat still needs HTTP and connection limits remain. A managed provider reduces socket operations but adds message/connection cost, third-party metadata exposure and lock-in. Reconsider it when measured concurrency/fan-out or on-call load exceeds the tested API fleet.

No message contents or permissions are authoritative in a socket node. Cross-instance fan-out may use Redis pub/sub as lossy notification; reconnect always repairs from PostgreSQL. Block/privacy/message-request policy is checked on initial fetch and every write, and revoked users are disconnected promptly.

## Redis-compatible service

Use **managed Upstash Redis** at V1 for distributed high-risk rate limits, short TTL cache, upload/recovery attempt state and optional presence/fan-out. It is never authoritative. Namespaces, ACL/TLS, bounded TTLs and non-PII keys are mandatory. High-risk write limits fail closed during an outage; optional caching/presence degrades open and database correctness continues. A regional managed Redis instance is the fallback when sustained throughput/latency makes serverless request pricing unsuitable.
