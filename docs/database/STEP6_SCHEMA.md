# Step 6 database schema

Migration `0001_step6_identity.sql` creates users, credentials, profiles, privacy settings, sessions, Admin eligibility, verification/reset tokens, deletion requests, outbox, and security events. UUID primary/foreign keys, checks, partial active indexes, hashed-token uniqueness, and case-insensitive unique email/username indexes enforce invariants. It is additive and does not delete data.
