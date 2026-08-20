# ADR-009: Dedicated Fastify Node API

## Status

**ACCEPTED** — Founder-approved for WYN V1.0.0.

## Context

The API must enforce domain authorization, serve two realms, run a modular monolith, support WebSockets/workers and scale independently of UI rendering.

## Decision

Use a dedicated strict-TypeScript Fastify application on supported Node.js LTS. Organize domain modules behind application interfaces; keep `/v1` and `/admin/v1` middleware/session policies distinct. Workers are separate processes sharing approved server packages, not Next.js functions.

## Alternatives

- Next.js route handlers: convenient but couples domain capacity/releases to UI deployments and is less suitable for persistent realtime/workers.
- NestJS: mature conventions but adds DI/decorator complexity not justified for V1.
- Go/Java service: no measured need for a second language/runtime.

## Consequences

API testing, security boundaries and independent scaling improve at the cost of another deployable. Fastify remains transport infrastructure; domain code must not depend on framework request objects.
