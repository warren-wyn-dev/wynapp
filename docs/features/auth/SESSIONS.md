# Sessions

Consumer cookie `__Host-wyn_session` and Admin cookie `__Host-wyn_admin_session` are opaque, unrelated realms. Only SHA-256 token hashes are stored. Consumer audience is `wyn-consumer`; Admin is `wyn-admin`. Cookies are HttpOnly, Path `/`, SameSite=Lax and Secure outside local/test. Absolute lifetime is 30 days; revocation is checked server-side. Mutations require an exact Consumer Origin plus double-submit CSRF value whose hash is bound to the session. Password change keeps the current session and revokes all others; reset and deletion revoke all sessions.
