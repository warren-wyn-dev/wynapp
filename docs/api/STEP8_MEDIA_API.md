# Step 8 Media API

All endpoints return the standard `request_id` envelope, require a Consumer session, and mutations require CSRF/Origin validation. Upload mutations use the strict upload rate bucket.

- `POST /v1/media/upload-intents` — `{purpose,mime,bytes}`; creates PENDING and returns an opaque ID plus short-lived signed PUT instructions.
- `POST /v1/media/:id/complete` — verifies the owned quarantine upload and queues processing; idempotent after upload.
- `GET /v1/media/:id` — owner-addressed status; URLs appear only at READY. No collection/list endpoint exists.
- `DELETE /v1/media/:id` — soft-deletes an owned, unreferenced asset.
- `PUT /v1/me/avatar`, `PUT /v1/me/cover` — `{mediaId}`; attaches matching owned READY media.

Stable media errors include `INVALID_MEDIA`, `UPLOAD_INVALID`, `INVALID_STATE`, `NOT_FOUND`, `NOT_FOUND_OR_REFERENCED`, and `MEDIA_UNAVAILABLE`.
