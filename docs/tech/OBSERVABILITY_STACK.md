# Observability Stack

**Status:** PROPOSED

Use **Pino** JSON logs to stdout, provider log retention/search, **Sentry** for redacted frontend/backend errors and performance sampling, and **OpenTelemetry-compatible interfaces** for traces/metrics that become useful. Start with platform/database metrics plus a small set of product-integrity operational metrics rather than running a full observability cluster.

Propagate generated request, correlation, causation and job/event IDs. Record service/version/environment/route template and safe result class—not raw URLs, tokens, cookies, email, message text, reset links, signed URLs or arbitrary request bodies. Sentry `sendDefaultPii` remains off; use allowlist scrubbing and sampling. Audit records are a separate immutable business/security trail and never replaced by logs.

Initial dashboards/alerts cover availability/latency/error rate, PostgreSQL saturation/pool/locks, outbox oldest age/dead letters, worker failures, upload rejection/processing latency, WebSocket connections/reconnects, auth/recovery anomalies and rate-limit pressure. Set numeric SLOs after FD-15 and baseline measurement. Export via standard protocols and keep short hot retention to control cost; increase sampling/retention only for a documented need.

Sentry lock-in is limited through WYN-owned error interfaces and OpenTelemetry context. A hosted Grafana/OTel backend is the next step when cross-provider correlation, longer retention or metric cardinality justifies it.
