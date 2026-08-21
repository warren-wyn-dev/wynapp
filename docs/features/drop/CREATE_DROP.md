# Create and publish

Authenticated creation validates with Zod, derives the author from the session, serializes writes in PostgreSQL, writes attachments/relations and a transactional outbox event, then commits. `Idempotency-Key` is persisted with a request digest; conflicting reuse is rejected. Published empty Drops are rejected.
