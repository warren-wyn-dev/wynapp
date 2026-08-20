# Deployment and Environment Architecture

**Status:** PROPOSED — no infrastructure or deployment is authorized by this document
**Owner:** DevOps / SRE
**Reviewers:** WYN CTO, Software Architect, Database Engineer, QA & Security

## 1. Deployable boundaries

WYN V1 is a modular monolith operated as four independently releasable boundaries:

1. **WYN Consumer App** — its own build, origin, deployment, public security policy, and Consumer session integration.
2. **WYN Admin** — separate build, origin, deployment, stricter network/browser policy, Admin-only session, and granular permission UI backed by server enforcement.
3. **API** — one codebase/runtime may expose `/v1/...` and `/admin/v1/...`, but the edge, middleware, session audience, authorization policy, rate limits, telemetry, and CORS/CSRF allowlists are separate. Admin credentials are never accepted on Consumer routes and Consumer sessions never authorize Admin routes.
4. **Background Worker** — independently scaled process using the same approved release artifact/modules, with no public ingress and narrowly scoped credentials for outbox/media/notification duties.

V1 adds managed PostgreSQL, quarantine and permanent object-storage areas, CDN, email provider, and a minimal realtime/queue mechanism only as justified by the approved design. No Kafka, Kubernetes requirement, microservice fleet, multi-region active-active database, dedicated search cluster, or bespoke infrastructure platform is assumed.

## 2. Environments and isolation

| Environment | Purpose | Data and access | Promotion rule |
|---|---|---|---|
| Local | individual development and deterministic tests | local/emulated resources and synthetic fixtures; no production secrets or personal data | developer checks only |
| Development | shared integration and ephemeral preview where useful | isolated accounts/projects, synthetic data, least-privilege developer access; instability allowed | automated checks and integration evidence |
| Staging | production-like release candidate and operational rehearsal | isolated from production; synthetic/anonymized data; topology/config parity where cost-effective; production credentials forbidden | exact immutable artifact passes smoke, security, migration, observability, backup/restore, and rollback rehearsal |
| Production | approved user service | production-only accounts/network/data/secrets; tightly restricted audited access | exact staged artifact plus explicit Founder approval |

Environment names are included in every resource and telemetry event. Credentials, databases, storage buckets, CDN namespaces, session signing/encryption keys, domains, and provider projects are not shared between staging and production. Admin and Consumer origins/sessions remain separate in every environment. Development cannot reach production by default; exceptional break-glass access is time-limited, approved, MFA-protected, and audited.

Production personal data is not copied down. A future exceptional diagnostic dataset requires explicit approval, minimization/anonymization, purpose, access expiry, and verified deletion.

## 3. Artifact and configuration model

- CI creates immutable, content-addressed/versioned Consumer, Admin, API, and worker artifacts from a reviewed commit; build once and promote the same artifacts.
- A release manifest records source revision, artifact digests, schema compatibility range, configuration version, feature flags expected, and test evidence.
- Build provenance, dependency lockfiles, vulnerability/license checks, and artifact integrity verification are required before promotion.
- Runtime configuration is environment-specific and validated at startup. Safe non-secret defaults may live in source; secrets never do.
- Consumer/Admin client builds receive only explicitly public configuration. A value needed by a browser is not a secret.

No package/framework installation, resource creation, or provider selection is performed in this architecture step.

## 4. Secrets and privileged access

Use an approved managed secret store with encryption, versioning, audit logs, rotation, and identity-based retrieval. Grant each deployable and environment only the exact secrets/actions it needs. Prefer short-lived workload identity over static credentials; prohibit secrets in Git, CI definitions/output, images, frontend bundles, logs, fixtures, tickets, and documentation.

Separate database roles for API runtime, worker, migration runner, backup/restore, read-only analytics, and administrators. Migration credentials are unavailable to normal runtime. Quarantine writers cannot publish directly to permanent/CDN paths; media processors read quarantine and write only validated derivatives. CI deployment authority is separate from code-review authority. Production interactive access requires MFA, just-in-time approval, bounded duration, and audit.

Rotation is rehearsed without downtime for database credentials, session keys, provider credentials, and signing keys. Suspected exposure means revoke/rotate, assess logs/artifacts, invalidate affected sessions if needed, and record the incident—never merely delete the visible string.

## 5. CI/CD and release gates

The release path is:

`Development → automated tests/build → QA & Security review → CTO final review → Staging → Founder approval → Production`

Required evidence before staging includes scoped requirements, architecture approval, code review, formatting/lint/type/unit/integration/E2E checks as applicable, negative authorization/privacy/upload/abuse tests, dependency and secret scanning, artifact provenance, migration expand/contract and rollback plan, and no unresolved CRITICAL security finding.

Staging validates:

- the exact release manifest and all four deployables;
- Consumer/Admin origin, session, CORS/CSRF, and authorization isolation;
- smoke journeys, worker/outbox idempotency and retries, media quarantine flow, and provider failure modes;
- production-like migration rehearsal against a representative synthetic dataset;
- observability, paging, capacity assumptions, backup, point-in-time recovery readiness, and application rollback;
- feature flags default safely and do not replace authorization.

Production requires the Founder to approve the exact staged release. Approval records approver, version/digests, scope, risks, change window, migration and rollback steps. Silence, approval of a previous release, or merge approval is not deployment approval. DevOps deploys through the controlled pipeline, monitors release health, performs post-deploy smoke checks, and records completion or rollback.

Progressive/rolling deployment is preferred: remove unhealthy instances using readiness, limit concurrency, and stop automatically when error, latency, integrity, or security guardrails regress. Consumer, Admin, API, and worker may roll independently only within manifest compatibility constraints. Feature flags reduce rollout blast radius but cannot grant access or bypass release gates.

## 6. Database changes and rollback

Future schema changes use reviewed, forward-compatible migrations; none are created now. Use expand/migrate/contract:

1. backup and verify recovery readiness;
2. add backward-compatible structures/indexes with bounded locking;
3. deploy code able to operate across the compatibility window;
4. backfill through resumable, throttled, observable jobs;
5. validate counts/invariants and switch reads/writes;
6. remove old structures only in a later approved release.

Migration commands run once under a dedicated identity and advisory/other safe lock. Define timeouts, estimated duration/storage, failure handling, and replica/traffic impact. Destructive migration or production data deletion always requires explicit Founder approval and a verified recovery plan.

Application rollback redeploys the last known-good immutable manifest. Schema rollback normally rolls application forward/back within the compatibility window rather than reversing destructive DDL. Media/API events remain backward compatible for at least the active rollback window. If rollback could lose or reinterpret accepted writes, stop and use the approved incident/migration plan; do not improvise deletion.

## 7. Backup, restore, and disaster recovery

Production PostgreSQL requires encrypted automated backups plus point-in-time recovery when supported; object-storage source/derivative protection uses versioning or equivalent lifecycle protection appropriate to retention. Backups use a separate least-privilege identity, are isolated from routine runtime deletion, monitored for freshness/failure, and have documented retention and regional/account placement. Audit-critical records receive protection consistent with their immutable trail.

A backup is not accepted until restore is tested. On a scheduled cadence and before high-risk releases, restore into an isolated environment, validate schema and checksums/count/invariants, exercise representative authorized reads, record achieved recovery point/time, and securely destroy the restored copy. Never expose restored private data to development users.

Founder must approve Recovery Point Objective (RPO), Recovery Time Objective (RTO), retention, legal holds, and whether cross-region/account copies are required. The recovery runbook defines incident command, dependency order (database before API/worker), DNS/CDN/provider considerations, session/key recovery, integrity checks, communication, and criteria to resume writes. Restoration does not automatically republish deleted/quarantined media or bypass retention policy.

## 8. Operational security and network boundaries

- TLS is required for public and service traffic; encryption at rest uses managed controls.
- Public ingress reaches only intended Consumer/Admin origins and API/realtime endpoints; databases, worker, secret store, and storage administration have no public administrative ingress.
- Admin receives stricter rate limits, origin allowlist, session audience, CSP, step-up authentication, and monitored access; network restriction may be added based on Founder-approved operating model.
- Egress is allowlisted where practical, especially for media processing, to reduce SSRF/data exfiltration risk.
- Quarantine objects are private, non-executable, non-CDN, short-lived, and isolated from permanent READY derivatives.
- Infrastructure and deployment changes use reviewable declarative definitions only after implementation approval; drift and privilege changes are detected.

## 9. Failure handling and release acceptance

The API uses bounded timeouts and graceful degradation for nonessential providers. Workers are retry-safe/idempotent with exponential backoff, jitter, attempt limits, a visible terminal-failure/quarantine path, and controlled replay. During provider outage, durable state/outbox is preserved; realtime or notification delivery is never authoritative.

Rollback triggers include sustained release-correlated error/latency regression, failed authorization isolation, data-integrity violation, invalid Global/Club ranking scope, worker backlog beyond the approved limit, or security finding. A rollback itself is observed and verified. If a migration prevents safe rollback, stop rollout and execute the pre-approved recovery plan.

Post-deployment checks cover health/readiness, critical Consumer and Admin journeys, error/latency saturation, database/worker/media state, outbox lag, audit emission, and security alerts. Release is complete only after the observation window and evidence are recorded.

## 10. Open Founder decisions

- cloud/provider and regional placement, budget threshold, and any significant cost increase;
- production SLO/RPO/RTO, maintenance window, backup and log/audit retention;
- Admin network-access model, strong/step-up authentication, and break-glass owners;
- release strategy/observation window and incident/on-call coverage;
- production data residency, legal hold, and disaster-recovery region/account;
- approval of the architecture ADRs and, later, each exact production release.

This document does not authorize infrastructure creation, migration execution, deployment, or production access.
