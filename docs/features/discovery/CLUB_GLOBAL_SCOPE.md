# Club and Global Scope Isolation

Every ranking fact has a non-null server-derived distribution scope: `GLOBAL_PUBLIC` or `CLUB_INTERNAL`. Club scope requires a Club identifier; global scope forbids one. Clients cannot select or override scope. Global workers and SQL explicitly predicate `scope = 'GLOBAL_PUBLIC'`; Club workers predicate `scope = 'CLUB_INTERNAL' AND club_id = ?`. There is no query that sums both and subtracts later.

A public redistribution of Club content has a distinct public distribution identity. Only engagement occurring on that authorized public distribution can emit `GLOBAL_PUBLIC` facts. Historical or concurrent Club likes, comments or views are never copied, promoted or used as a boost.

Release-blocking integration tests inject 10,000 Club likes plus Club comments/views and verify the global Drop/topic/creator snapshots are unchanged; then add an event on the public distribution and verify only that event can count. Missing/unknown scope is rejected, not defaulted global. This boundary implements ADR-004 and remains mandatory even before full Clubs exist.
