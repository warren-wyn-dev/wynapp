# Monorepo and Tooling

**Status:** PROPOSED

## Decision

Use **pnpm workspaces** for dependency/workspace management and **Turborepo** only for dependency-aware tasks and local/CI caching. pnpm alone is viable, but Turbo makes four apps and shared packages faster without becoming an architectural runtime dependency. Nx offers more generators/governance than V1 needs; npm/Yarn provide no compelling benefit here.

```text
apps/
  web/          # Consumer Next.js deployment
  admin/        # Admin Next.js deployment
  api/          # Fastify modular monolith
  worker/       # outbox/media/scheduled worker entrypoints
packages/
  ui/           # tokens and accessible primitives, never business authorization
  database/     # schema/query/migration tooling used behind domain repositories
  auth/         # auth adapters and realm-specific server helpers
  config/       # typed non-secret build/runtime configuration helpers
  types/        # stable transport/value types; no database entity leakage
  validation/   # Zod boundary schemas
  observability/# logging, metrics and tracing interfaces
```

Enforce package exports and dependency direction. Browser packages cannot import server, database or secret-bearing modules. `web` and `admin` may share primitives but not session configuration, cookies, layouts, routes or deployment secrets. API domain modules expose explicit application interfaces rather than importing across internals.

Use one lockfile, a pinned `packageManager`, frozen CI installs and task inputs that include environment/schema/code-generation sources. Remote caching must not upload secrets or secret-derived artifacts. Changes should be focused Conventional Commits; merge policy and Founder gates remain those in `GIT_WORKFLOW.md`.
