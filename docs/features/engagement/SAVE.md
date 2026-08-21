# Saves

Saves are private, idempotent state keyed by `(user_id,drop_id)`. Only `/v1/me/saved` exposes the list and the authenticated user ID always comes from the session. The list rechecks current Drop, account, follow and block visibility; public APIs never expose savers.
