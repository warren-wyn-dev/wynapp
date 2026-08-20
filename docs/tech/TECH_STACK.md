# WYN V1.0.0 Technology Stack

**Status:** PROPOSED — technical decision only. No package installation, implementation, infrastructure creation, migration, or deployment is authorized.

## Recommended stack

| Concern | V1 choice |
|---|---|
| Repository | pnpm workspaces; Turborepo only as the task runner/cache |
| Language/runtime | Strict TypeScript; supported Node.js LTS |
| Consumer/Admin | Separate Next.js + React applications and deployments |
| API | Dedicated Node.js TypeScript modular monolith using Fastify |
| Data | Managed PostgreSQL; Drizzle ORM plus reviewed parameterized SQL |
| Authentication | Self-hosted Better Auth, database-backed opaque cookie sessions; separate Consumer/Admin realms |
| Validation | Zod at every trusted boundary |
| Media | Cloudflare R2, private quarantine and processed buckets; Sharp workers; AWS S3 fallback |
| Cache/limits | Managed Redis-compatible Upstash for distributed rate limits and ephemeral state only |
| Search | PostgreSQL FTS plus `pg_trgm`; no search service in V1 |
| Realtime | Dedicated API WebSocket endpoint, PostgreSQL remains authoritative; polling/SSE fallback |
| Jobs | PostgreSQL transactional outbox and polling workers using `FOR UPDATE SKIP LOCKED` |
| UI | Tailwind CSS, internal WYN tokens/components, selective Radix primitives |
| Tests | Vitest, real-PostgreSQL integration tests, Playwright |
| Quality | ESLint, Prettier, strict TypeScript, Conventional Commits |
| Observability | Pino JSON logs, Sentry, OpenTelemetry interfaces, provider metrics/logs |
| Email/push | Postmark; standards-based Web Push with VAPID |
| Flags | Audited database flags for product features; environment flags for infrastructure only |
| Deployment | Cloudflare edge/CDN + AWS `ap-southeast-1` managed runtime/database; GitHub Actions |

Versions are selected and pinned during the implementation gate, not in this architecture decision. Use the then-current supported Node LTS and mutually compatible stable releases; lock the exact dependency graph with `pnpm-lock.yaml`.

## Decision principles

The stack preserves the approved modular monolith, deployable Consumer/Admin/API/worker boundaries, PostgreSQL authority, transactional outbox, Thai-first mobile web delivery, and a measured path from 1,000 to 100,000 DAU. Shared code is limited to non-secret UI primitives, contracts, validation, configuration helpers, and infrastructure adapters; domain authority stays in the API.

## Cross-cutting decisions

- **PWA:** manifest, service worker, installability, offline shell and safe retry. Never cache private API responses or authenticated HTML in shared caches.
- **Email:** Postmark is preferred for deliverability and low operational burden. Resend is the easy fallback; SES is reconsidered when volume makes its setup worthwhile.
- **Push:** store per-device Web Push subscriptions encrypted/limited by retention; send from workers using VAPID; revoke invalid endpoints. Native push is out of scope.
- **Flags:** `clubs_enabled`, `chat_enabled`, `trending_enabled`, and `top100_enabled` are typed, safe-default, environment-scoped, versioned and audited database records. A disabled flag fails closed and never grants permission.
- **CI/CD:** pull requests run frozen install → lint → typecheck → unit → PostgreSQL integration → builds → dependency/secret/SAST checks. Only reviewed artifacts reach staging. Production is a protected GitHub Environment requiring Founder approval.

## Risks and controls

| Risk | Control |
|---|---|
| Auth dependency defect | Pin and monitor Better Auth; review advisories and session tables; threat-model adapters; retain replaceable internal auth interface |
| Cross-realm session confusion | Different cookie names, signing/encryption secrets, audiences, origins, paths and databases/schema scopes; API rejects the wrong realm |
| Upload attacks | Direct-to-quarantine upload intent, MIME/magic-byte decode, pixel/frame/byte/time limits, EXIF removal, malware hook, immutable processed keys |
| SSR/privacy cache leak | Explicit private/no-store policy, cache-key review, authorization at API on every read |
| Redis outage | Fail closed for high-risk mutations; degrade optional cache/presence; never store authoritative state |
| WebSocket loss | Persist first, sequence/cursor replay after reconnect, bounded polling fallback |
| Supply chain | Minimal dependencies, frozen lockfile, Renovate/Dependabot review, provenance where available, CodeQL and secret scanning |
| Vendor concentration | S3 protocol, standard PostgreSQL, OCI artifacts, OpenTelemetry and provider-neutral domain interfaces |

No security policy is decided here: FD-01, FD-08, FD-10, FD-11, FD-14 and retention decisions remain approval gates.

## Scale triggers

Change only from measurements: add PostgreSQL replicas/partitioning after sustained query or I/O saturation; a dedicated search engine after indexed PostgreSQL search cannot meet an approved p95 target or ranking/language needs; a managed queue after outbox lag/SKIP LOCKED contention misses SLOs; managed realtime after concurrent connections or fan-out exceed tested API capacity; split a service only when independent scaling/failure ownership is repeatedly required. Review at 10,000 DAU and load-test before 100,000 DAU.

## Founder decisions remaining

1. Approve this stack and the AWS + Cloudflare multi-vendor operating model, regions and cost ceiling.
2. Approve Better Auth as the security-critical base and the stronger Admin factors/recovery policy under FD-14.
3. Approve account/session/recovery/age policy (FD-01), chat/block policies (FD-10/11), and retention.
4. Set measurable latency, availability, recovery, search and realtime targets (FD-15).
5. Approve staging and, separately later, every production deployment. This proposal grants neither.

## Detailed records

See the focused documents in this directory and ADR-006 through ADR-015. All ADRs remain **PROPOSED** until Founder approval.
