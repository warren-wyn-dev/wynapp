# WYN V1.0.0 System Architecture

**Status:** PROPOSED — architecture-only; Founder approval is required before implementation.

## Goals and constraints

WYN starts as a **modular monolith**: one API codebase and one PostgreSQL logical database, with strict domain boundaries and independently running background workers. This minimizes operational load at approximately 1,000 DAU while allowing stateless horizontal scaling toward 10k–100k DAU. V1 deliberately excludes microservices, Kafka, a dedicated search engine, application implementation, infrastructure creation, and schema migrations.

## Deployable boundaries

| Boundary | Purpose | Isolation |
|---|---|---|
| Consumer App | Mobile-first public/user UI | Separate build, deployment and consumer origin; calls `/v1/` only |
| WYN Admin | Operations and moderation UI | Separate build, deployment and admin origin; calls `/admin/v1/` only; never receives consumer cookies |
| API | Synchronous domain commands/queries | Stateless replicas; consumer and admin route stacks have distinct auth middleware, audiences, rate limits and policies |
| Background Worker | Media, outbox, notification, ranking and cleanup jobs | Same domain packages, separate process identity and least-privilege credentials |

The Consumer and Admin origins use distinct cookie names, signing/audience configuration, CSRF boundaries and session stores/namespaces. Admin identities and sessions are separate records from consumer sessions. CORS is an explicit allowlist; neither origin is a wildcard. A reverse proxy/load balancer routes traffic but does not make authorization decisions.

## Runtime and data flow

```text
Consumer App ──HTTPS──> /v1/       ┐
                                   ├─> Stateless API ─> PostgreSQL
Admin App    ──HTTPS──> /admin/v1/ ┘         │              │
                                             │          outbox_events
                                             │              │
                                  quarantine/object store   v
                                                        Worker pool
                                             ┌──────────────┼───────────┐
                                             v              v           v
                                         media/CDN   notifications  rankings
```

PostgreSQL is authoritative for durable product state. Object storage is authoritative only for media bytes whose database record is `READY`; the CDN is a cache. Realtime chat delivery is a convenience channel after commit, never the source of truth. Redis-compatible cache/coordination is optional only when measurements justify it; correctness cannot depend on cache contents.

## Internal architecture

Each module exposes commands, queries and emitted domain events. A module may read another module only through a declared query interface or an intentionally documented read model; it must not mutate another module's tables. Cross-module synchronous dependencies follow the direction in `MODULES.md`; fan-out and derived views use the transactional outbox.

Typical request order is: request identification → authentication → server-side policy authorization → schema/business validation → transaction and outbox write → safe response. Workers claim events/jobs, process idempotently, record outcomes, and retry with bounded exponential backoff and a dead-letter/quarantine state.

## Availability and degradation

- Loss of workers delays derived notifications/rankings/media but does not corrupt committed state.
- Loss of realtime falls back to polling/fetching durable chat state.
- Search/ranking failure returns an explicit degraded/error state rather than bypassing visibility rules.
- Media remains quarantined and unattachable until scanning and transformation succeed.
- Feature flags may disable an unfinished/degraded surface, but never grant permission.

## Change gates and open decisions

All ADRs remain `PROPOSED`. Authentication/security policy, admin permissions, ranking formula, retention, cloud/provider choices, and production topology require the relevant Founder decisions. No production deployment follows from this design; the required path is tests → security review → staging → Founder approval → production.
