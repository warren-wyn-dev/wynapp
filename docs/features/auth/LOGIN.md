# Login and password hashing

Passwords use maintained `argon2` Argon2id with 64 MiB memory, three iterations, and parallelism one. Encoded hashes retain parameters. On login a later calibration can use `needsRehash` and replace a hash after successful verification. Login returns one generic invalid-credentials response, creates a fresh random session, and never accepts a supplied role.
