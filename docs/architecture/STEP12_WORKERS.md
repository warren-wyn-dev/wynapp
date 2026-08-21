# Step 12 Notification Worker

The PostgreSQL dispatcher materializes per-consumer deliveries and workers claim due rows using `SKIP LOCKED` plus a 30-second lease. Notification insertion and dedupe are transactionally safe. Failures record bounded attempt count, safe error class, next availability, and dead-letter timestamp at attempt five. Metrics/log integration should track pending age, attempts, suppression outcomes and dead letters without event payloads.
