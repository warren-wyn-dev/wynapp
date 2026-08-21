# Email verification

Random 256-bit URL-safe tokens expire after 24 hours, are stored as SHA-256 hashes, consumed atomically once, and never logged. Resend and verification are rate-limited. Resend always returns a generic accepted response.
