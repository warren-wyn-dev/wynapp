# WYN V1.0.0 Approved Technology Stack

**Status:** ACCEPTED — these Step 4 technology decisions are Founder-approved. This record authorizes documentation only; it does not authorize application implementation, package installation, migrations, infrastructure changes, or deployment.

## Approved stack

| Concern | V1 decision |
|---|---|
| Language | TypeScript in strict mode on a supported Node.js LTS |
| Repository | pnpm, pnpm workspaces, and Turborepo |
| Consumer App | Separate Next.js + React mobile-first Web/PWA |
| WYN Admin | Separate Next.js app, deployment, and session/auth boundary |
| API | Dedicated Node.js + TypeScript Fastify modular monolith |
| Worker | Dedicated Node.js + TypeScript process; PostgreSQL transactional outbox; idempotent handlers |
| Data | Managed PostgreSQL; Drizzle ORM; explicit migrations; reviewed parameterized SQL for complex queries |
| Validation | Zod at trusted boundaries; server-owned business validation |
| Authentication | Application-owned email/password authentication and secure server-side sessions; Argon2id |
| Media | Cloudflare R2 primary, AWS S3 fallback; CDN delivery; Sharp quarantine processing |
| Cache and limits | Managed Redis-compatible service only when justified; never authoritative; provisioning may be deferred |
| Search | PostgreSQL full-text search and `pg_trgm` with appropriate indexes |
| Realtime | Provider-agnostic WebSockets after durable PostgreSQL commit |
| UI | Tailwind CSS, internal WYN design system, selective accessible headless primitives |
| Tests | Vitest unit/integration, real PostgreSQL integration coverage, Playwright E2E, required authorization/security regressions |
| Quality | TypeScript strict mode, ESLint, Prettier |
| Observability | Structured JSON logs with Pino or equivalent, request/correlation IDs, Sentry, useful OpenTelemetry-compatible abstractions |
| Email and push | Resend primary; AWS SES or Postmark fallback; Web Push for PWA V1 |
| Feature flags | Database-backed product flags; environment flags only for infrastructure/configuration |
| CI/CD | GitHub Actions with install → lint → typecheck → unit → integration → build → security/dependency gates |
| Hosting | Vercel for separate Consumer/Admin deployments; managed persistent runtime for API/worker; managed PostgreSQL; R2/CDN |

Versions will be selected and pinned during an authorized implementation step. Shared UI, types, validation, and configuration packages are allowed, but database entities, secrets, authorization decisions, and Consumer/Admin session configuration must not leak across trust boundaries.

## Architectural constraints

WYN V1 is a modular monolith optimized for roughly 1,000 DAU with a practical measurement-led path to 10k–100k DAU. V1 does not use microservices, Kafka, Kubernetes, a dedicated search cluster, or premature multi-region architecture. PostgreSQL is authoritative; Redis, WebSockets, the CDN, and search projections cannot grant access or establish product truth.

Feature flags never replace authorization. Private data must not enter public or shared caches. Production remains gated by staging validation, security review, rollback readiness, and explicit Founder approval.

## Detailed records

The remaining files in this directory define the approved boundaries, alternatives, security controls, operations, and estimated cost bands. ADR-006 through ADR-015 record these Step 4 decisions as **ACCEPTED**; earlier product and architecture decisions retain their existing status and approval requirements.
