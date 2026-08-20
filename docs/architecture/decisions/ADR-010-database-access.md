# ADR-010: Drizzle over PostgreSQL

## Status

PROPOSED

## Context

PostgreSQL is authoritative. WYN needs typed routine access plus explicit transactions, migrations and specialized social/feed/search SQL.

## Decision

Use Drizzle ORM/Kit for typed schema and common parameterized queries, with reviewed parameterized SQL for complex PostgreSQL operations. Keep access behind domain repositories and migrations as reviewable artifacts under later change control.

## Alternatives

- Prisma: excellent tooling, but its generated abstraction/runtime is less direct for specialized SQL.
- Kysely: strong and a credible fallback; thinner schema/migration integration.
- Raw SQL only: maximum control with more mapping/repetition and fewer routine type guarantees.

## Consequences

Queries stay close to PostgreSQL and transaction control stays visible. Engineers still need SQL expertise, must inspect generated migrations, prevent N+1 queries and use query plans/load tests for hot paths.
