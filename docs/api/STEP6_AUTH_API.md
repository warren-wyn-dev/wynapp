# Step 6 API

Implemented endpoints: `POST /v1/auth/register`, `login`, `logout`, `logout-all`, `verify-email`, `resend-verification`, `forgot-password`, `reset-password`, `change-password`; `GET /v1/me`; `PATCH /v1/me/profile`; `GET /v1/me/sessions`; `DELETE /v1/me/sessions/:sessionId`; `PATCH /v1/me/privacy`; `POST /v1/me/delete-request`; and `GET /v1/users/:username`. `/admin/v1/session` is the minimal realm-separation proof, not an Admin product flow.
