# Feed, Search, Discovery and Ranking

**Status:** PROPOSED. Formula choices in FD-04, FD-06 and FD-07 remain Founder decisions.

## Common eligibility filter

Every candidate is filtered server-side at read time (and when materialized) for active author, viewer block in either direction, viewer mute, account privacy/follow status, Drop removal/moderation status, club visibility/current membership, and distribution scope. A stale cache/index may remove results but may never authorize them. Pages may be under-filled after filtering; bounded backfill is allowed.

## Following feed

Generate candidates with a bounded PostgreSQL query over recent public/follower-visible Drops and eligible ReDrops by accepted follows. Include club-scoped content only when the viewer is an active member and the surface explicitly admits club content. Sort deterministically by creation/distribution time descending and ID descending. Use an opaque signed/versioned keyset cursor containing the last sort tuple, never an offset. Deduplicate by canonical Drop ID, retaining the newest eligible distribution reason.

## For You feed

V1 uses explainable candidate pools: recent eligible public Drops, recent public engagement velocity, followed/topic affinity from explicit activity, and a small discovery pool. Apply a simple weighted score with time decay, capped engagement contribution, author diversity and quality/safety eligibility. No private or club-only behavior becomes a global signal. Persist a ranking-policy version and internal reason codes for audit/experimentation; do not expose sensitive signals. Tie-break by stable ID. Cursor carries policy/snapshot version, score and ID so pagination remains deterministic within a bounded snapshot.

Start with fan-out-on-read plus indexed queries and periodic aggregate snapshots. Move to precomputed per-user timelines only after measured latency/DB load demands it. Ranking counters derive from trusted deduplicated engagement, not client counts; rate/abuse filters exclude suspicious signals.

## Trending scopes

Events include `distribution_scope` (`GLOBAL_PUBLIC` or `CLUB`), optional `club_id`, canonical content ID, public distribution ID, actor, event type, occurred time and idempotency ID. Scope is determined by the server from the surface/resource—not supplied by the client.

- **Global Trending Drops/Topics:** only eligible `GLOBAL_PUBLIC` events, weighted by unique actors, event type and decay; removed/private/restricted actors/content are excluded on recompute.
- **Club Popular/Trending:** only `CLUB` events for that club and visible only under its policy; each club has a separate partition/snapshot.
- A club Drop shared/ReDropped publicly creates an authorized public distribution record. Only subsequent engagement on that public distribution emits `GLOBAL_PUBLIC` events; historical or concurrent club engagement is never copied to global.
- **WYN Top 100:** a versioned snapshot of eligible active public creators. Formula, window, cadence, ties and club eligibility await FD-07; the safe default is to exclude club-scoped engagement.

Deduplicate source events by event ID/business uniqueness and cap repeated actor influence. Periodic recomputation enables moderation corrections.

## PostgreSQL search and discovery

V1 searches Users, Drops, Hashtags/Topics and Clubs using normalized columns, B-tree equality/prefix indexes, GIN full-text indexes for Drop/topic text, and `pg_trgm` GIN/GiST indexes for username/display/club-name similarity if the approved PostgreSQL extension is available. Queries are type-separated, bounded and keyset-paginated; rank combines exact/prefix, text relevance and modest recency/popularity. Search documents contain only approved public text and IDs. Apply common eligibility after retrieval and before snippets.

Suggested users/clubs use simple popularity plus graph overlap/recency, with dismissed items stored per policy. A dedicated search engine is a future optimization only when corpus/query volume, language relevance, p95 latency or PostgreSQL resource isolation misses approved SLOs despite indexing and query tuning.
