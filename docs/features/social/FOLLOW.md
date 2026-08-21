# Follow relationships

Public accounts are followed immediately. `follows(follower_id, followed_id)` has a composite primary key, so retries and concurrent requests cannot create duplicates. Unfollow and follower removal are idempotent deletes. Followers/following counts are computed with indexed `count(*)` queries rather than denormalized counters, eliminating drift in V1; introduce transactional counters plus reconciliation only after measured need.

Lists use deterministic `(created_at, user_id)` keyset cursors, fetch 51 rows for a 50-row page, join profiles in one query, and filter viewer blocks without N+1 queries.
