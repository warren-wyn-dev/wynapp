# Social graph security

All mutations derive the actor from a live Consumer session and require the session-bound CSRF token and exact Consumer Origin. Request IDs and stable non-enumerating errors are retained. Central policies cover follow, view, request ownership, follower removal, block, mute, and interaction checks. Database pair locks, unique constraints, row locks, and block checks defend direct API and concurrency bypasses. Per-network mutation rate limiting limits spam/churn without locking an account.
