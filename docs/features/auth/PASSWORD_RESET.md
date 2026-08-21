# Password reset

Forgot-password always returns the same response. Eligible users receive a 256-bit one-hour token through the email adapter. Reset locks and consumes the token, changes the Argon2id hash, revokes sessions, and writes a domain/security fact atomically. Replays and expired tokens return the same invalid-token error.
