# Step 11 Ranking and Search Workers

The existing PostgreSQL transactional outbox is the only queue; Kafka is not introduced. Domain transactions emit minimal versioned facts. Search projection, Global Trending, topic Trending and Top 100 are separate consumers so one poison delivery cannot hide work from another.

Each consumer claims bounded deliveries with leases, records `(consumer,event_id)` atomically with its projection effect, and acknowledges only after commit. Retries use bounded exponential backoff/jitter; exhausted/schema-invalid deliveries enter a per-consumer dead-letter state and alert. Deletes, privacy/account enforcement and corrections are new facts and also repaired by periodic authoritative recomputation.

Schedules: Global Trending/Topics every 15 minutes over 24 hours; Top 100 hourly over seven days. A deterministic job key combines job kind, ruleset, and window end. Concurrent retries either reuse the completed snapshot or lose a uniqueness race safely. Workers build an unpublished snapshot, validate counts/scope, then publish atomically. Candidate cache is optional and non-authoritative.

Metrics include delivery lag/age, attempts, dead letters, job duration, candidate/event counts, excluded-by-scope counts, snapshot age/version, publication failure and zero-result anomalies. Logs use job/event/correlation IDs and aggregate counts without private content. Alerts cover stale snapshots, repeated failure and any scope-integrity rejection.
