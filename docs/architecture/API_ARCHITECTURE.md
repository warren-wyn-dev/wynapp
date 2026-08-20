# API Architecture and Conventions

**Status:** PROPOSED. This document sets conventions; endpoint contracts are not frozen.

## Namespaces and transport

- Consumer resources live under `/v1/...`; Admin resources live under `/admin/v1/...` with separate middleware, session audience and origin allowlist.
- HTTPS only outside local development. JSON is the default representation; media bytes use bounded signed object-upload flows.
- Breaking changes require a new URL major version. Additive fields are allowed; clients ignore unknown fields. Deprecations are measured and communicated before removal.

## Request pipeline

Assign or validate a bounded `X-Request-ID` at the edge and propagate a correlation ID across outbox/jobs. Authenticate from the appropriate realm, rate-limit by risk, authorize the concrete action/resource server-side, validate syntax and business invariants, execute the transaction, and serialize an allowlisted response. Never trust client identity, role, ownership, visibility, counts, engagement scope or feature access.

Validation rejects unknown/oversized structures where practical, enforces types/ranges/Unicode/URL rules and returns field-safe errors. Queries are parameterized. Output is context-encoded by clients and unsafe rich HTML is not accepted.

## Pagination and consistency

Collections use bounded limits and opaque, tamper-evident/versioned keyset cursors derived from deterministic `(sort_value, id)` tuples. Responses provide `items` and `next_cursor`; they do not expose total counts unless cheap and privacy-safe. Ranking cursors include snapshot/policy version. Invalid/expired cursors return a stable client error. Writes may return a resource version/ETag; destructive or conflicting updates use optimistic preconditions.

## Idempotency

Retryable creates/actions accept `Idempotency-Key`, scoped to authenticated principal + route + purpose. Store a canonical request hash and terminal response for a bounded window. Reuse with a different payload is a conflict. Database unique constraints remain the final defense. GET/HEAD are safe; clients must not retry non-idempotent operations blindly.

## Error envelope

```json
{
  "error": {
    "code": "DROP_NOT_VISIBLE",
    "message": "The requested resource is unavailable.",
    "request_id": "...",
    "fields": [{"field": "body", "code": "TOO_LONG"}]
  }
}
```

Stable codes distinguish validation (400/422), unauthenticated (401), forbidden/unavailable (403/404 chosen to prevent enumeration), conflict (409), rate limit (429), and server failure (5xx). No stack trace, SQL, storage path, token, private state or authorization oracle is exposed. `Retry-After` accompanies applicable 429/503 responses.

## Rate limits and security

Use route-risk buckets: strict for login/recovery/admin/upload/report/message/engagement; broader for reads. Combine subject, session, IP/network and resource dimensions with abuse detection, and make limits observable. Cookie-authenticated state changes use CSRF tokens plus Origin/SameSite defenses. CORS is exact-origin and credential-aware. Request/body timeouts, maximum sizes and concurrency limits protect resources.

OpenAPI/schema documentation, contract tests and authorization-negative tests are required before implementation contracts become approved.
