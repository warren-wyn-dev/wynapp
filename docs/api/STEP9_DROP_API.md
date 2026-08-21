# Step 9 Drop API

All mutations require a Consumer session, CSRF token, request ID, and rate limit. Create/publish accept `Idempotency-Key`.

- `POST /v1/drops`; `GET|PATCH|DELETE /v1/drops/:id`
- `GET /v1/me/drafts`
- `POST /v1/drafts`; `GET|PATCH|DELETE /v1/drafts/:id`
- `POST /v1/drafts/:id/publish`

Responses use `{ data, request_id }`; errors use the established stable error envelope. Detail is visibility-filtered. Draft routes are owner-only.
