# ADR-013: API-hosted WebSockets with Durable Replay

## Status

**ACCEPTED** — Founder-approved for WYN V1.0.0.

## Context

Basic 1:1 chat and notifications need timely delivery, reconnect and unread correctness, but PostgreSQL—not realtime transport—must remain authoritative.

## Decision

Host authenticated WebSockets on the dedicated API runtime. Commit messages/read state first, publish durable outbox events, send only delivery hints/IDs and replay missing records by cursor through authorized APIs. Use managed Redis only for lossy cross-instance fan-out/presence and limits.

## Alternatives

- Managed realtime: easier operations but variable cost, metadata exposure and provider coupling before demand is known.
- SSE: good one-way fallback, but chat still needs HTTP writes and has similar connection operations.
- Polling only: robust fallback but inefficient and less responsive as the primary path.

## Consequences

WYN controls privacy and cost while concurrency is modest, but owns connection draining, backpressure and capacity tests. Reconsider managed realtime when measured connection/fan-out/on-call burden crosses approved targets.
