# Database and Search Stack

**Status:** ACCEPTED — no physical schema or migration is created.

## Decision

Use managed **PostgreSQL** as the authoritative store and **Drizzle ORM/Kit** for typed schema, common queries and reviewable SQL migrations. Use Drizzle's parameterized SQL escape hatch for recursive comments, feeds, moderation queues, ranking and search. Transactions remain explicit and domain repositories hide persistence details.

| Option | Strength | Why not primary |
|---|---|---|
| Drizzle | Close to SQL, strong TS inference, lightweight, explicit migrations/transactions | Chosen; team must still understand PostgreSQL |
| Prisma | Excellent onboarding and tooling | Generated client/query abstraction can impede specialized SQL and deploy/runtime footprint |
| Kysely | Excellent typed query builder and SQL control | Migration/schema ecosystem is intentionally thinner; credible fallback |
| SQL-first only | Maximum PostgreSQL control | More manual mapping/repetition and fewer shared type checks for routine CRUD |

Migrations are immutable, reviewed SQL artifacts generated/edited during a later implementation gate; production uses expand/migrate/contract and separate approval. Use least-privilege roles, TLS, PITR/backups, restore drills, statement/lock timeouts and connection pooling. Never expose database connections to browsers or workers beyond their bounded role.

## Search

V1 uses weighted `tsvector` fields and GIN indexes for public searchable text, with Thai tokenization quality validated against a representative corpus. Use `pg_trgm` GIN/GiST indexes for normalized username/display-name/hashtag prefix and fuzzy matching, plus partial/composite indexes that include visibility/moderation eligibility and stable keyset ordering. Always apply block, private-account, Club-membership and moderation filters before returning results.

Add a dedicated search service only when representative load tests show indexed PostgreSQL cannot meet the Founder-approved p95/SLO, Thai relevance requires analyzers PostgreSQL cannot provide, or indexing load materially harms authoritative transactions. Search remains a rebuildable projection, never an authorization source.
