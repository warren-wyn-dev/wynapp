# Social graph security

All mutations derive the actor from a live Consumer session and require the session-bound CSRF token and exact Consumer Origin. Request IDs and stable non-enumerating errors are retained. Central policies cover follow, view, request ownership, follower removal, block, mute, and interaction checks. Database pair locks, unique constraints, row locks, and block checks defend direct API and concurrency bypasses. Per-network mutation rate limiting limits spam/churn without locking an account.

## Verification

The real-PostgreSQL integration suite recreates the schema from migrations and covers idempotency, ownership negatives, self-relationship constraints, private redaction, unauthenticated mutation rejection, block enforcement, mute non-disclosure, and concurrent follow/unfollow, approve/cancel, block/request, block/follow, and private-to-public/request races. A target-facing response never includes inverse mute state.
