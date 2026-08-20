# ADR-007: pnpm Workspaces with Turborepo

## Status

**ACCEPTED** — Founder-approved for WYN V1.0.0.

## Context

Four separately deployable apps need a small set of shared packages, consistent checks and one reviewable dependency graph without coupling runtime releases.

## Decision

Use pnpm workspaces for packages/install/lockfile and Turborepo only for dependency-aware tasks and caching. Preserve `apps/web`, `apps/admin`, `apps/api`, `apps/worker` and the approved packages. Enforce exports and browser/server dependency boundaries.

## Alternatives

- pnpm scripts alone: viable and simpler, but loses useful task graph/caching as the four apps grow.
- Nx: capable but its generators/plugins/governance are unnecessary V1 complexity.
- Multiple repositories: stronger isolation but duplicate configuration and harder atomic contract changes.

## Consequences

CI and local tasks become consistent and fast. A monorepo does not mean one deployment or one auth boundary. Cache inputs must be correct and remote caches must never contain secrets.
