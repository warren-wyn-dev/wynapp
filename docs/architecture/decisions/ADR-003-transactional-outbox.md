# ADR-003: Transactional Outbox

## Status

**PROPOSED** — requires Founder approval.

## Context

Notifications, media, search and ranking must follow committed state without dual-write loss. V1 explicitly avoids Kafka and should minimize infrastructure.

## Decision

Write versioned event envelopes to PostgreSQL `outbox_events` in the same transaction as domain changes. A dispatcher atomically creates one delivery row for every registered consumer before marking an event dispatched. Each consumer leases only its delivery rows, delivers at least once, and uses consumer receipts/business uniqueness for idempotency, bounded retry and per-consumer dead-letter handling.

## Alternatives

- Publish directly after commit: process failure can permanently lose the event.
- Publish before commit: consumers can observe changes that roll back.
- Kafka/event sourcing: powerful throughput/history but unjustified operational and modeling complexity.
- Database polling without an outbox: ambiguous change detection and missed transitions.

## Consequences

Atomic domain/event persistence and simple operations outweigh polling overhead. Consumers must be retry-safe and tolerate eventual consistency. Outbox growth, oldest-event age and database load require retention, metrics and reconciliation. A broker becomes an option only at measured contention/throughput/isolation triggers.
