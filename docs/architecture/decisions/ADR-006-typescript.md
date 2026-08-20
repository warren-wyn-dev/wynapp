# ADR-006: TypeScript as the Primary Language

## Status

PROPOSED

## Context

WYN needs mobile web and Admin clients, a modular Node API, workers, runtime validation and deliberately shared contracts. A small team benefits from one strongly typed language, but compile-time types cannot validate untrusted traffic.

## Decision

Use strict TypeScript across Next.js frontends, Fastify API, workers, packages and tooling on a supported Node.js LTS. Enable `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` and `useUnknownInCatchVariables`. Validate trusted boundaries at runtime with Zod and keep database/authorization models server-owned.

## Alternatives

- Java/Kotlin or Go backend: strong operations, but adds language/tooling boundaries without a measured V1 need.
- JavaScript: simpler syntax but loses important refactoring and contract safety.
- TypeScript without strict mode: rejected because optional/null/unknown behavior is security-relevant.

## Consequences

Frontend, backend, workers and tools share expertise and safe value contracts. The team must avoid type-only trust, unsafe assertions and leaking persistence types to clients. CPU-intensive image work stays in native-backed Sharp or isolated services.
