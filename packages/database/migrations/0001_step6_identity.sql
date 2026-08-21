CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TYPE account_state AS ENUM ('ACTIVE','RESTRICTED','SUSPENDED','BANNED','DELETION_PENDING','DELETED');
CREATE TYPE session_realm AS ENUM ('CONSUMER','ADMIN');
CREATE TYPE privacy_state AS ENUM ('PUBLIC','PRIVATE');

CREATE TABLE users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email_normalized text NOT NULL,
 email_verified_at timestamptz, account_state account_state NOT NULL DEFAULT 'ACTIVE',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz,
 CONSTRAINT users_email_format CHECK (email_normalized = lower(btrim(email_normalized)) AND length(email_normalized) BETWEEN 3 AND 320)
);
CREATE UNIQUE INDEX users_email_ci_uq ON users (lower(email_normalized));
CREATE INDEX users_state_idx ON users(account_state);

CREATE TABLE user_credentials (
 user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT, password_hash text NOT NULL,
 password_changed_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE profiles (
 user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT, username_normalized text NOT NULL,
 display_name text NOT NULL, bio text NOT NULL DEFAULT '', website text, location text, avatar_url text, cover_url text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT username_format CHECK (username_normalized ~ '^[a-z0-9_]{3,30}$'),
 CONSTRAINT profile_lengths CHECK (length(display_name) BETWEEN 1 AND 50 AND length(bio) <= 500 AND (location IS NULL OR length(location) <= 100))
);
CREATE UNIQUE INDEX profiles_username_ci_uq ON profiles(lower(username_normalized));

CREATE TABLE privacy_settings (
 user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT, account_visibility privacy_state NOT NULL DEFAULT 'PUBLIC',
 who_can_message text, who_can_mention text, who_can_comment text, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 token_hash text NOT NULL UNIQUE, realm session_realm NOT NULL, audience text NOT NULL, csrf_token_hash text NOT NULL,
 label varchar(100), created_at timestamptz NOT NULL DEFAULT now(), last_used_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL, revoked_at timestamptz, revocation_reason text,
 CONSTRAINT session_audience_realm CHECK ((realm='CONSUMER' AND audience='wyn-consumer') OR (realm='ADMIN' AND audience='wyn-admin'))
);
CREATE INDEX sessions_user_active_idx ON sessions(user_id, realm, expires_at) WHERE revoked_at IS NULL;
CREATE TABLE admin_principals (user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT, enabled boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE email_verification_tokens (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, consumed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_verification_user_idx ON email_verification_tokens(user_id, created_at DESC);
CREATE TABLE password_reset_tokens (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, consumed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX password_reset_user_idx ON password_reset_tokens(user_id, created_at DESC);
CREATE TABLE account_deletion_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 requested_at timestamptz NOT NULL DEFAULT now(), cancelled_at timestamptz, completed_at timestamptz
);
CREATE UNIQUE INDEX account_deletion_pending_uq ON account_deletion_requests(user_id) WHERE cancelled_at IS NULL AND completed_at IS NULL;
CREATE TABLE outbox_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_type text NOT NULL, aggregate_type text NOT NULL, aggregate_id uuid NOT NULL,
 payload jsonb NOT NULL DEFAULT '{}', request_id text NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now(), dispatched_at timestamptz
);
CREATE INDEX outbox_pending_idx ON outbox_events(occurred_at) WHERE dispatched_at IS NULL;
CREATE TABLE security_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES users(id) ON DELETE SET NULL,
 event_type text NOT NULL, request_id text NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now(), metadata jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX security_events_user_time_idx ON security_events(user_id, occurred_at DESC);
