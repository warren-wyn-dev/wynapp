CREATE TYPE notification_type AS ENUM (
 'DROP_LIKED','COMMENT_CREATED','COMMENT_REPLIED','DROP_REDROPPED','QUOTE_REDROP_CREATED',
 'USER_FOLLOWED','FOLLOW_REQUEST_RECEIVED','FOLLOW_REQUEST_APPROVED','USER_MENTIONED',
 'TRENDING_ACHIEVED','TOP100_ACHIEVED','SYSTEM_ANNOUNCEMENT'
);
CREATE TYPE notification_category AS ENUM
 ('LIKES','COMMENTS','REPLIES','REDROPS','FOLLOWS','FOLLOW_REQUESTS','MENTIONS','TRENDING','SYSTEM');

CREATE TABLE notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 recipient_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
 type notification_type NOT NULL,
 entity_type text NOT NULL CHECK(entity_type IN ('DROP','COMMENT','USER','TOPIC','SYSTEM')),
 entity_id uuid,
 payload jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(payload)='object' AND pg_column_size(payload)<=2048),
 read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 dedupe_key text NOT NULL CHECK(length(dedupe_key) BETWEEN 16 AND 200), expires_at timestamptz,
 UNIQUE(recipient_user_id,dedupe_key)
);
CREATE INDEX notifications_recipient_cursor_idx ON notifications(recipient_user_id,created_at DESC,id DESC);
CREATE INDEX notifications_unread_idx ON notifications(recipient_user_id,created_at DESC) WHERE read_at IS NULL;

CREATE TABLE notification_preferences (
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 category notification_category NOT NULL, in_app_enabled boolean NOT NULL DEFAULT true,
 web_push_enabled boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,category),
 CONSTRAINT mandatory_system_in_app CHECK(category<>'SYSTEM' OR in_app_enabled)
);
CREATE INDEX notification_preferences_user_idx ON notification_preferences(user_id);

CREATE TABLE push_subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 endpoint text NOT NULL CHECK(length(endpoint) BETWEEN 12 AND 2048), p256dh text NOT NULL CHECK(length(p256dh)<=512),
 auth_secret text NOT NULL CHECK(length(auth_secret)<=512), permission_state text NOT NULL DEFAULT 'GRANTED'
   CHECK(permission_state IN ('GRANTED','DENIED','PROMPT')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), invalidated_at timestamptz,
 UNIQUE(user_id,endpoint)
);
CREATE INDEX push_subscriptions_active_user_idx ON push_subscriptions(user_id) WHERE invalidated_at IS NULL;

CREATE TABLE outbox_deliveries (
 event_id uuid NOT NULL REFERENCES outbox_events(id) ON DELETE CASCADE, consumer text NOT NULL,
 available_at timestamptz NOT NULL DEFAULT now(), delivered_at timestamptz, attempt_count integer NOT NULL DEFAULT 0,
 locked_until timestamptz, last_error_code text, dead_lettered_at timestamptz, PRIMARY KEY(event_id,consumer),
 CHECK(attempt_count BETWEEN 0 AND 5)
);
CREATE INDEX outbox_delivery_claim_idx ON outbox_deliveries(available_at,event_id)
 WHERE delivered_at IS NULL AND dead_lettered_at IS NULL;
