# ADR-015: Vercel Web Apps with Managed Persistent Backend

## Status

**ACCEPTED** — Founder-approved for WYN V1.0.0.

## Context

WYN needs separately deployed Consumer and Admin web apps, persistent API/WebSocket behavior, independently running workers, managed PostgreSQL, CDN-backed media, and low operational burden at roughly 1,000 DAU. The stack must retain a practical path to 10k–100k DAU without premature infrastructure.

## Decision

Deploy Consumer Web and Admin Web as separate **Vercel** projects with isolated origins, configuration, artifacts, and session boundaries. Run the API and worker on managed container/runtime providers suitable for persistent Node.js processes; do not force these workloads into short-lived serverless functions. Use managed PostgreSQL, Cloudflare R2/CDN for media, and managed Redis-compatible infrastructure only when justified.

Use GitHub Actions for required quality/security gates and immutable release artifacts. Exact backend/database providers and regions require an operational evaluation and budget approval. Every production deployment requires explicit Founder approval.

## Alternatives

- All workloads on web-platform functions: simpler vendor surface but unsuitable where persistent WebSockets or workers require long-lived processes and controlled draining.
- All AWS: broad capability but higher V1 operational burden than the preferred managed split.
- Kubernetes: powerful orchestration but unjustified at V1 scale.
- One web deployment: conflicts with the required Consumer/Admin deployment and security boundary.

## Consequences

The web apps gain optimized managed Next.js hosting while API and worker can scale according to their actual persistent workload. Multi-provider operations, transfer costs, observability, secret isolation, and incident ownership need explicit runbooks. Standard Node, PostgreSQL, S3-compatible storage, OCI where supported, and OpenTelemetry-compatible interfaces reduce migration friction.
