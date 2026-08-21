# Observability foundation

API and Worker emit structured Pino JSON to stdout with service identity. Request and correlation identifiers are generated or accept bounded safe caller values. Redaction covers passwords, tokens, cookies, authorization, secrets, and sessions. Applications use WYN-owned error-capture and metrics interfaces with no-op defaults; provider wiring is intentionally deferred. Do not log request bodies, personal data, raw session IDs, signed URLs, or credentials.
