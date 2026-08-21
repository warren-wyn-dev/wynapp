# Notification Architecture — Step 12

A domain transaction appends a minimal event to `outbox_events`. `NotificationWorker.dispatch` creates the `notifications` consumer delivery and marks dispatch atomically; `runOnce` leases it, then `NotificationService` rechecks current account state, bidirectional blocks, entity visibility/deletion, preferences and deterministic deduplication before committing the inbox row. Delivery is at least once. Five bounded exponential-backoff attempts lead to a visible dead letter; no failure is silently discarded.

PostgreSQL remains authoritative. In-app commit is independent of optional push. `CLUB_*` and `CHAT_*` are reserved namespaces only: Step 12 creates no fake events or product flows.
