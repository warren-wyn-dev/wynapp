# Feed, Search and Discovery Security

All endpoints authenticate the Consumer, validate Zod query limits/cursors, apply origin/CSRF rules where mutation applies, use parameterized SQL, rate limit by actor and route, and return a request ID. Ranking scores, scope, creator identity, counters and snapshot time are server authority.

Privacy authorization is repeated at response time. Search/ranking projections are derived hints; stale data cannot grant access. Public caches contain only completed globally public snapshots. Viewer feeds and suggestions are never shared across cache keys. Logs contain request/correlation IDs and policy reason codes, not query-derived private content or inverse mute state.

Abuse controls use distinct actors, Step 10 counted-view buckets, logarithmic/capped signals, self-engagement discounts, duplicate/burst penalties, bounded windows and recomputation after enforcement. Security tests include SQL injection strings, unsafe full-text syntax, blocked/private/draft/deleted resources, cursor tampering, cross-user cache attempts, restricted creators and Club/global contamination. Any contamination or private-content result is CRITICAL and blocks release.
