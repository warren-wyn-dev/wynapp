# Authentication security

Authentication endpoints have network rate limits; deployments should add a shared identifier-aware limiter before horizontal scaling. Request IDs appear in stable error envelopes. Logs exclude email, passwords, cookies, raw URLs, and tokens. Consumer and Admin middleware query exact database realm and audience; headers and Consumer cookies cannot establish Admin authority. Production email fails explicitly until Resend credentials/adapter are configured.
