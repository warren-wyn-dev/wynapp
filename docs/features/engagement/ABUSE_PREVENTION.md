# Abuse prevention

Engagement mutations use authenticated actor identity, CSRF/origin verification, a 40-request/minute route bucket, strict Zod bodies, database uniqueness and transactional authorization. Like/save/ReDrop retries are idempotent. View hour buckets neutralize refresh and same-session replay. These conservative V1 controls should be tuned from rate-limit pressure without weakening database invariants.
