# Step 14 Chat API

All routes require an active Consumer session. Mutations additionally require the existing origin-bound CSRF token. Actor and participant identity always come from the session.

- `GET|POST /v1/conversations` lists accepted direct conversations or creates the canonical participant pair.
- `GET /v1/message-requests` and `POST /v1/message-requests/:id/{accept|reject}` manage incoming requests.
- `GET|POST /v1/conversations/:id/messages` reads by `before` sequence cursor and durably commits text, image, reply, Drop, Profile, or Club messages.
- `POST /v1/conversations/:id/read` advances the monotonic read high-water mark.
- `DELETE /v1/messages/:id` tombstones only the sender's own message.
- `POST /v1/messages/:id/report` preserves a minimal, restricted evidence reference for Step 15 moderation.

Messages use a caller-generated UUID `clientMessageId` for idempotency. Successful sends commit the message and `MessageCreated` outbox fact in one transaction. Realtime transports publish only IDs and sequence hints; reconnecting clients replay this API, and delivery rechecks membership, account state, and bidirectional block.
