# Cost and Scaling Architecture

**Status:** PROPOSED
**Owner:** DevOps / SRE
**Reviewers:** WYN CTO, Software Architect, Database Engineer

## 1. Strategy

Scale WYN by measurement, not by DAU alone. DAU is a planning proxy; peak requests per second, concurrent sessions, writes per second, media bytes/derivatives, database working set, outbox lag, realtime connections, and CDN egress determine capacity. V1 starts as a modular monolith with separately deployable Consumer, Admin, API, and background worker and a primary PostgreSQL datastore.

The priority order is:

1. instrument and establish workload/SLO baselines;
2. remove inefficient queries, missing indexes, unbounded payloads, and wasteful media variants;
3. vertically size managed components within a cost guardrail;
4. horizontally scale stateless API/worker instances and use CDN/object storage;
5. add narrowly scoped cache/read replicas/queue capability only for measured bottlenecks;
6. extract a service or dedicated search system only when explicit triggers and ownership justify the operational cost.

Capacity plans retain headroom for predictable peaks and one-instance failure; exact headroom and performance targets await FD-15. Load tests use realistic public/private/Club authorization distributions and never production personal data.

## 2. Workload stages

The ranges below are planning hypotheses, not automatic purchase or topology decisions.

### Initial: approximately 1,000 DAU

- one region; managed PostgreSQL with automated backups/PITR capability;
- small replicated/stateless API deployment where availability requires it, and independently scaled worker;
- object storage plus CDN for READY media; private quarantine storage;
- PostgreSQL-backed transactional outbox polled with safe row claiming;
- PostgreSQL full-text/trigram/indexed search; query-time Following feed and simple auditable For You/trending projections;
- minimal realtime transport with database-authoritative chat;
- centralized logs, metrics, errors, health checks, cost budgets and alerts.

Avoid dedicated search, Kafka, Kubernetes solely for scale, data warehouse, microservices, multi-region database, custom recommendation ML, and separate datastore per module.

### Growth: approximately 10,000 DAU

Keep the same architecture. Likely first actions:

- tune indexes/query plans, pagination, connection pooling, and slow-query budgets;
- horizontally scale API and worker; give media/outbox job classes independent concurrency limits to prevent starvation;
- precompute bounded feed/trending/search projections where query-time work breaches targets;
- introduce short-lived cache only for measured hot, non-sensitive data with authorization-safe keys and invalidation;
- optimize image variants, CDN hit ratio, lifecycle rules, and provider/egress cost;
- add read replica only if observed read pressure remains after query/index fixes and replica staleness is acceptable;
- partition/archive high-volume append-oriented tables only when size/write/vacuum measurements justify it.

### Future: approximately 100,000 DAU

Do not assume a rewrite. Continue horizontal API/worker scaling and PostgreSQL tuning/partitioning. Evaluate dedicated search, a managed queue, specialized ranking projections, or extraction of media/chat/notification workloads individually when the triggers below persist. Keep identity, authorization, privacy, block, moderation, and audit policies consistent at every boundary; extraction cannot duplicate policy ad hoc.

Multi-region active-active, sharding, Kafka, and generalized microservices remain unjustified unless measured availability, throughput, geography, or organizational constraints cannot be met more simply.

## 3. Expected bottlenecks and response order

| Area | Early signal | Scale first | Later option, only if needed |
|---|---|---|---|
| PostgreSQL | pool queueing, CPU/IO, lock waits, slow queries, storage/vacuum growth | indexes/plans, bounded cursors, batch writes, pool limits, vertical size | read replica, table partitioning, then carefully scoped data split |
| Feed/ranking | p95 latency, fan-out cost, stale candidates | query simplification, bounded candidate windows, scheduled/materialized projections | dedicated ranking workers/store after sustained load |
| Outbox/workers | oldest-event age, retry rate, DB polling load | indexes, batch claim, concurrency by job class, backpressure | managed queue while retaining outbox as commit bridge |
| Search | p95 latency, CPU, relevance limits, index-update contention | PostgreSQL FTS/trigram/index tuning, scoped queries | dedicated search engine under explicit triggers |
| Media | quarantine backlog, CPU/memory, storage/egress cost | independent workers, safe resource limits, CDN/cache/variant tuning | dedicated media service only for isolation/throughput |
| Chat/realtime | connections, delivery latency, reconnect storm | horizontally scale gateway, backpressure; durable DB commit first | managed pub/sub or isolated delivery service |
| Notifications | provider throttling, backlog/noise | batching, grouping, preferences, rate/backoff controls | isolated delivery workers/provider routing |
| Hot counters | write contention/fake engagement checks | idempotent events, asynchronous aggregate projections | specialized counter/cache only after measurement |
| Admin analytics | production query interference | bounded queries, async aggregates, read-only role | replica/warehouse after workload and governance justify it |

Backpressure is mandatory: cap per-job and per-tenant/user work, reject or defer noncritical work safely, prevent media/notification spikes from exhausting database connections, and expose backlog age. Autoscaling must use saturation/backlog plus safety bounds, not raw CPU alone.

## 4. Search and service-extraction triggers

### Dedicated search engine

Evaluate—not automatically adopt—when PostgreSQL search exceeds approved p95/freshness targets for multiple representative peak periods after schema/query/index tuning; search materially harms transactional SLOs; required relevance/language behavior cannot be delivered safely; or index volume/update rate creates sustained database contention. The proposal must include privacy deletion/block propagation, private/Club document filtering, index rebuild, outage fallback, operational owner, cost, and exit plan.

### Managed queue or event broker

Evaluate when indexed outbox polling creates sustained primary-database pressure, backlog cannot meet freshness after safe worker scaling, delivery fan-out/subscriber isolation becomes operationally unsafe, or retry scheduling requirements exceed the simple worker. The transactional outbox remains the atomic database commit boundary. Kafka is not a V1 default and requires a separately justified architecture decision.

### Service extraction

Extract one bounded capability only when at least one condition is demonstrated: independent scaling/isolation cannot be achieved with separate monolith processes; release ownership/cadence is materially blocked; a distinct availability/security boundary is required; or a specialized datastore/runtime yields measured benefit greater than its cost. Require API/event ownership, authorization strategy, consistency/failure semantics, data migration and rollback, observability, staffing/on-call, security review, and Founder approval for a major architecture change.

High DAU alone, codebase size alone, or fashion is not a trigger.

## 5. Data, privacy, and correctness while scaling

- Cache and projections store the minimum data and include viewer/visibility scope where needed; public, private-account, Club, block, mute, removal, and moderation changes invalidate or recheck at read time.
- A cache hit or search result is never authorization. Server-side policy filters the final response.
- Global engagement events and projections accept only `GLOBAL_PUBLIC` eligible distribution signals. Club events remain Club-scoped; a public ReDrop creates a distinct public distribution whose subsequent eligible public engagement may count globally.
- Read replicas may lag, so authorization, new blocks, moderation removals, session state, and sensitive writes use the authoritative consistency path or fail closed.
- Workers and backfills are idempotent, resumable, rate limited, observable, and compatible with live writes. Counts are derived from trusted events rather than client-supplied totals.
- Retention/archive/partition changes preserve report evidence, safe soft-delete, audit immutability, and Founder-approved privacy/legal policy.

## 6. Cost governance

Track cost by environment and major driver: compute, PostgreSQL/storage/backups, object storage, image processing, CDN/egress, realtime connections, notification/email provider, observability ingestion/retention, and third-party requests. Tag resources consistently and alert on budget and abnormal unit-cost changes.

Review unit economics such as cost per DAU, API request, processed image/GB delivered, realtime connection-hour, notification, and retained telemetry GB. Optimize largest measured drivers first. Apply storage/quarantine/log lifecycle policies only after privacy, evidence, audit, and recovery retention are approved. Sampling is allowed for low-value diagnostics, never for required audit/security evidence.

Significant infrastructure cost increases and cloud-provider changes require Founder approval with forecast, alternatives, security/operational impact, and rollback/exit path. Development and staging use schedules/right-sizing where safe, but staging must retain enough parity for release and recovery tests.

## 7. Capacity and resilience validation

Before launch and material growth milestones:

- model peak/read/write/media/realtime mix and test at expected peak plus approved headroom;
- test private-account, block, Club, removed-content, and Admin authorization paths under load;
- measure API/database pools, slow queries/locks, outbox backlog, worker retry storms, media memory/CPU limits, CDN hit ratio, and provider quotas;
- inject database/provider/realtime degradation and verify graceful failure, backpressure, durable commits, recovery, and no privacy fail-open;
- rehearse backup restore and record achieved RPO/RTO;
- compare measured capacity and monthly forecast to budgets; record the next constraint and owner.

Review capacity monthly initially and before campaigns/releases expected to change traffic materially. Scaling actions are reversible where possible and deployed through the normal Tests → Security → Staging → Founder Approval → Production gates.

## 8. Open decisions and risks

Founder decisions required: FD-15 SLO/KPI and peak assumptions; hosting region/provider and monthly budgets; RPO/RTO/retention; acceptable feed/search/notification freshness; realtime availability target; and approval thresholds for replicas, dedicated search/queue, or service extraction.

Key risks:

- PostgreSQL contention from feed/search/outbox/analytics sharing one primary;
- authorization-safe cache/index invalidation and replica staleness;
- image processing and CDN egress becoming the largest variable cost;
- notification/realtime retry storms amplifying provider outages;
- observability cardinality and retention cost;
- fake engagement increasing write load and corrupting rankings;
- premature distributed systems increasing failure modes and on-call burden.

Mitigate with measurable budgets, bounded queries/events, independent worker concurrency, backpressure, privacy rechecks, cost alerts, load/failure tests, and explicit extraction triggers rather than speculative infrastructure.
