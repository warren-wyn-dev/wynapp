# Observability Architecture

**Status:** PROPOSED — requires Founder approval with the architecture package
**Owner:** DevOps / SRE
**Reviewers:** WYN CTO, Software Architect, QA & Security

## 1. Purpose and principles

Observability must make the Consumer App, Admin, API, background worker, PostgreSQL, object-storage/media pipeline, CDN, and realtime delivery diagnosable without turning telemetry into a privacy leak. Telemetry is operational evidence, not an authorization source and not a substitute for immutable audit records.

V1 uses a small, vendor-neutral stack: structured application logs, centralized error tracking, service and business-safety metrics, dashboards, and actionable alerts. Distributed tracing and a dedicated telemetry platform remain optional until measured debugging needs justify them.

Principles:

- use the same field names and service taxonomy in every environment;
- collect the minimum data needed to operate safely;
- alert on user impact and exhausted capacity, not every transient failure;
- keep Consumer and Admin telemetry access separated by least privilege;
- preserve request-to-worker causality across the transactional outbox;
- define an owner and runbook for every paging alert.

## 2. Signal and identity model

### 2.1 Standard context

Every API response includes an opaque `request_id`; the API creates one when an inbound value is absent or invalid. A `correlation_id` links a user operation across API transactions, outbox events, worker attempts, media processing, notification delivery, and realtime delivery. Neither identifier contains a user ID, email, token, IP address, or other personal data.

Every telemetry record should include, where applicable:

| Field | Rule |
|---|---|
| `timestamp` | UTC, machine generated |
| `environment` | local, development, staging, production |
| `service` | consumer, admin, api, worker, media-worker, or approved dependency |
| `release` | immutable build/artifact identifier |
| `severity` | normalized debug/info/warn/error/fatal |
| `request_id`, `correlation_id` | opaque identifiers propagated across boundaries |
| `operation` | bounded route template or job/event name; never a raw URL with identifiers |
| `outcome`, `error_code` | bounded machine-readable values |
| `duration_ms` | numeric duration |
| `event_id`, `attempt` | for asynchronous processing; identifiers are non-secret |

High-cardinality resource or actor identifiers are excluded from metric labels. If operational investigation genuinely requires a pseudonymous subject reference, log an approved internal opaque ID only in access-restricted logs, never a display name or contact detail.

### 2.2 Propagation

1. Edge/API establishes `request_id` and `correlation_id` and returns the request ID to the caller.
2. Database transactions persist correlation and causation references on outbox events.
3. Workers retain the correlation ID and create a new attempt/job identifier.
4. Outbound providers receive only a provider-safe idempotency/reference value.
5. Realtime delivery records delivery outcome, while the durable database remains authoritative.

Untrusted caller-provided IDs are length/character validated and are never used as log syntax or authorization evidence.

## 3. Structured logs and error tracking

Logs are structured (for example JSON), written to standard output by runtime processes, collected centrally, encrypted in transit/at rest, access controlled, and protected against modification. Production log access is time-bound and auditable; Admin/security logs have a narrower audience than general service logs. Local logs may be human-readable but must retain the same redaction behavior.

Log:

- process lifecycle, release, dependency availability, and configuration version (not values);
- normalized request outcome, latency, response class, and rate-limit decision;
- authentication outcome and session lifecycle category without credentials;
- denied authorization and sensitive Admin action references without private payloads;
- outbox claim, processing result, retry, dead-letter/quarantine state, and lag;
- media stage, rejection reason category, dimensions/size class, and processing duration;
- backup/restore verification, deployment gate, rollback, and feature-flag change references.

Never log passwords, password-reset/email-verification values, session cookies, access or refresh tokens, API keys, secrets, authorization headers, raw uploaded files, private message content, unnecessary post/comment content, full request/response bodies, sensitive personal data, or signed storage URLs. IP addresses and user agents are security data: minimize, truncate/hash where suitable, restrict access, and retain only for the Founder-approved abuse/security period.

Error tracking receives stack traces, release/environment, bounded tags, and scrubbed breadcrumbs. Server-side scrubbing is mandatory; client-side scrubbing alone is insufficient. User-facing errors expose a stable error code and request ID, not stack traces, queries, storage paths, provider details, or private resource existence.

Retention periods, security-event retention, audit-log retention, and who may unmask any pseudonymous data are **Founder Decisions** informed by legal/privacy review.

## 4. Metrics and service-level indicators

### 4.1 Platform metrics

- API traffic, success/error rate, p50/p95/p99 latency by bounded route group, saturation, restarts, and availability;
- PostgreSQL connections, transaction rate, lock waits/deadlocks, slow-query count, CPU/storage/IO, replication/backup health, and pool queue time;
- worker throughput, queue/outbox lag, oldest unprocessed event age, retries, permanent failures, and processing duration;
- object storage/CDN request failures, cache hit ratio, egress, quarantine age, media throughput/failure by stage;
- realtime connection count, delivery attempts/failures, reconnects, and durable-to-delivery latency;
- email/push provider latency, rejection/bounce/failure categories and budget consumption, without destination addresses;
- build/deployment success, rollback count, release error-rate change, and backup/restore status.

### 4.2 Integrity and safety metrics

Track bounded, aggregate counts for authentication failures, password resets, rate-limit denials, authorization denials, reports, moderation queue age, media rejection, suspected duplicate/fake engagement, block-policy delivery suppression, and Admin sensitive actions. These are detection signals, never automatic proof of abuse. Access is restricted and aggregation thresholds prevent exposing an individual.

Global and Club ranking telemetry is explicitly scoped (`GLOBAL_PUBLIC` versus `CLUB:<opaque-id>` in secure diagnostic data). Dashboards and queries must never combine Club engagement into Global Trending. A metric/alert detects any invalid-scope event reaching a global projection.

### 4.3 Initial objectives and alert calibration

Exact V1 availability, latency, recovery, and freshness SLOs depend on Founder decision FD-15. Before production, owners must approve measurable targets for API availability/latency, feed freshness, chat durable-commit success, notification/outbox lag, media processing time, and recovery objectives. Initial staging baselines inform thresholds; undocumented aspirational numbers are not release contracts.

Page only for sustained user-visible failure, security-critical signal, data-integrity risk, failed production backup, inability to roll back, or risk of resource exhaustion. Ticket lower urgency capacity trends and intermittent provider degradation. Alerts include environment, impact, dashboard, runbook, release, and owner; they must not contain secrets or private payloads.

## 5. Health checks and dashboards

- **Liveness:** process event loop/runtime is alive; it does not query every dependency or trigger restart storms.
- **Readiness:** instance can safely receive traffic and required dependencies are within bounded timeouts. A nonessential provider should degrade its feature rather than remove the whole API from service.
- **Startup:** long initialization is distinguished from liveness failure.
- **Deep/synthetic checks:** separately exercise critical read/write journeys with dedicated non-production or synthetic accounts; never mutate real user content.

Health endpoints reveal only a coarse status to public callers. Dependency and version details require operational authentication. The worker reports heartbeat and progress; backlog age, rather than heartbeat alone, determines useful health. Media quarantine and permanent-store checks must not publish bucket/object names.

Minimum dashboards: release health; API and database; worker/outbox; media; chat/realtime; notifications; authentication/abuse; moderation operations; cost/capacity; and Global-versus-Club ranking integrity. Consumer and Admin route groups remain distinguishable.

## 6. Audit logs versus operational telemetry

Important Admin, moderation, Club governance, feature-flag, security, and production actions write an immutable/auditable domain trail in the authoritative datastore. Operational logs may reference its event ID but cannot replace it. Audit entries capture actor, permission/action, target reference, reason where required, outcome, timestamp, and correlation ID; they exclude credentials and unnecessary evidence/content. Ordinary administrators cannot edit/delete audit history.

Clock synchronization, append-only access controls, integrity monitoring, encrypted backup, retention, and auditable export are required. Founder approval is required for retention/deletion policy and any exceptional destructive operation.

## 7. Incident operations and acceptance checks

Runbooks cover API/database saturation, outbox backlog, media processing failures, realtime/provider outage, suspected credential exposure, privacy leak, ranking-scope contamination, failed deployment, failed backup, and restore. Incidents assign commander, severity, containment, evidence preservation, communications, recovery, and retrospective actions. Destructive containment still requires applicable Founder approval unless a Founder-approved runbook explicitly pre-authorizes that exact step.

Before production:

- verify redaction with seeded secret/private-message canaries that must never appear in telemetry;
- verify request/correlation propagation through API → outbox → worker;
- generate each paging alert and validate routing/runbook ownership;
- test health behavior during dependency failure without restart cascades;
- validate dashboards distinguish Admin/Consumer and Global/Club scopes;
- restore telemetry/audit backups where applicable and verify access auditing;
- confirm monitoring continues during rollback and partial provider outages.

## 8. Open decisions and risks

Founder decisions: SLOs and capacity targets (FD-15), telemetry and audit retention, security-data/IP handling, approved observability provider/budget, on-call coverage, and incident communication policy.

Principal risks are excessive cardinality/cost, sensitive-data ingestion, alert fatigue, false health from heartbeat-only checks, blind spots during async lag, and provider lock-in. Mitigate through bounded schemas, deny-list plus allow-list scrubbing, sampled low-value events (never audit/security events), quarterly alert/access review, and vendor-neutral export formats.
