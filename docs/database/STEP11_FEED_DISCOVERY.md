# Step 11 Feed, Search and Discovery Database

Step 11 adds rebuildable PostgreSQL projections while authoritative users, follows/blocks/mutes, Drops and Step 10 engagement remain the source of truth.

## Relations

- scoped ranking facts/events carry source event identity, canonical/public distribution, actor, event type, occurrence time and mandatory `GLOBAL_PUBLIC` or `CLUB_INTERNAL` scope; Club scope requires `club_id` and global scope forbids it.
- ranking snapshots and rows store type/ruleset, complete publication state, window start/end, computed time, entity rank and quantized score. Unique snapshot/rank and snapshot/entity constraints make publication deterministic.
- topics and topic-hashtag mappings provide lightweight curated grouping.
- viewer impression/dismissal projection supports bounded seen penalties without making impressions counted views.
- outbox consumer receipts/ranking job records use unique event/job identities for idempotency and observable retry state.

The physical migration enables `pg_trgm` only where the managed PostgreSQL environment supports the approved extension. User normalized username/display name receive trigram indexes; Drop searchable text uses a generated/maintained `tsvector` with GIN; hashtag normalized value uses B-tree/prefix and trigram indexes. Feed indexes lead with eligibility/equality columns then `(published_at DESC,id DESC)`; social edges retain both-direction lookup indexes. Snapshot rows index `(snapshot_id,rank,entity_id)`.

All search is parameterized. Keyset predicates mirror sort order and avoid unbounded `OFFSET`. Ranking queries use bounded 24-hour (Trending) or seven-day (Top 100) windows and group distinct actors. Representative `EXPLAIN (ANALYZE, BUFFERS)` review must confirm index use and absence of per-item/N+1 queries before staging.

Projections never authorize reads. Every response joins/rechecks authoritative Drop/account state, visibility, block and mute policy. Deleted or newly private data disappears immediately even if a projection is stale. Rebuilds write a new snapshot then atomically publish it; failed/incomplete snapshots are never served.
