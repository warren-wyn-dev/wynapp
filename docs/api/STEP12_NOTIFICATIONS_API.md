# Step 12 Notification API

All routes require a Consumer session; mutations also require Origin/CSRF validation. Responses use `{data,request_id}` and the stable error envelope.

- `GET /v1/notifications?cursor=&limit=` — privacy-safe newest-first inbox.
- `GET /v1/notifications/unread-count`.
- `POST /v1/notifications/:id/read`; `POST /v1/notifications/read-all`.
- `GET /v1/me/notification-preferences`; `PATCH /v1/me/notification-preferences` with `{preferences:[{category,in_app_enabled?,web_push_enabled?}]}`.
- `POST /v1/me/push-subscriptions` with `{endpoint,keys:{p256dh,auth},permission_state}`.
- `DELETE /v1/me/push-subscriptions/:id`.

There is deliberately no consumer notification-create or system-announcement endpoint.
