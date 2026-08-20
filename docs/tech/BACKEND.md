# Backend, Validation and Jobs

**Status:** PROPOSED

## API/runtime

Use a dedicated **Node.js LTS + TypeScript + Fastify** application. Next route handlers would couple domain capacity and releases to the web surfaces and are awkward for WebSockets/workers. NestJS supplies strong conventions but its DI/decorator surface is unnecessary for this modular monolith. Fastify offers a small, testable HTTP core, lifecycle hooks and schema-aware serialization without dictating domain design.

Modules follow transport → application/use case → domain → repository/adapter. Authentication, action/resource authorization, validation and output allowlisting occur server-side. Consumer `/v1` and Admin `/admin/v1` pipelines have distinct origins, session audiences, CSRF policy and limits. OpenAPI is generated/reviewed from explicit transport contracts; shared TypeScript types never substitute for runtime checks.

## Runtime validation and quality

Use Zod for request/response DTOs where useful, environment configuration and shared form constraints. The server independently validates all client values and business invariants. Set TypeScript `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `useUnknownInCatchVariables`; forbid unchecked `any` at trusted boundaries. ESLint handles correctness/security rules, Prettier formatting, and Conventional Commits communicate intent.

## Jobs

Write domain changes and minimal versioned outbox facts in one PostgreSQL transaction. Worker processes claim bounded batches with `FOR UPDATE SKIP LOCKED`, short leases, exponential backoff/jitter, idempotency receipts and dead-letter state. Separate concurrency pools prioritize moderation/security, notifications, media, ranking and cleanup. Scheduled jobs use a single elected/leased scheduler and idempotent handlers.

BullMQ/Redis would add a second durability system and cannot make domain writes atomic. `pg-boss` is credible but hides mechanics already specified by the architecture. Cloud queues become appropriate only if observed outbox contention/lag or isolation requires them; Kafka remains excluded.
