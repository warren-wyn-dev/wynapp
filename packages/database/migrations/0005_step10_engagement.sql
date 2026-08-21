DO $$ BEGIN CREATE TYPE redrop_kind AS ENUM ('STANDARD','QUOTE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE drop_likes (
  drop_id uuid NOT NULL REFERENCES drops(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(drop_id,user_id)
);
CREATE INDEX drop_likes_drop_time_idx ON drop_likes(drop_id,created_at DESC);

CREATE TABLE comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), drop_id uuid NOT NULL REFERENCES drops(id) ON DELETE RESTRICT,
  author_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT, parent_comment_id uuid,
  body text NOT NULL CHECK(length(body) BETWEEN 1 AND 2000), created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(), edited_at timestamptz, deleted_at timestamptz,
  UNIQUE(id,drop_id), FOREIGN KEY(parent_comment_id,drop_id) REFERENCES comments(id,drop_id) ON DELETE RESTRICT,
  CHECK(parent_comment_id IS NULL OR parent_comment_id<>id)
);
CREATE INDEX comments_drop_page_idx ON comments(drop_id,created_at,id);
CREATE INDEX comments_parent_page_idx ON comments(parent_comment_id,created_at,id) WHERE parent_comment_id IS NOT NULL;

CREATE TABLE redrops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), original_drop_id uuid NOT NULL REFERENCES drops(id) ON DELETE RESTRICT,
  author_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT, kind redrop_kind NOT NULL,
  quote_text text CHECK((kind='STANDARD' AND quote_text IS NULL) OR (kind='QUOTE' AND length(quote_text) BETWEEN 1 AND 2000)),
  created_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
CREATE UNIQUE INDEX redrops_standard_active_uq ON redrops(original_drop_id,author_user_id) WHERE kind='STANDARD' AND deleted_at IS NULL;
CREATE INDEX redrops_original_idx ON redrops(original_drop_id,created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX redrops_author_idx ON redrops(author_user_id,created_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE saved_drops (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT, drop_id uuid NOT NULL REFERENCES drops(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,drop_id)
);
CREATE INDEX saved_drops_user_page_idx ON saved_drops(user_id,created_at DESC,drop_id DESC);

-- Raw attempts are retained separately from the race-safe counted bucket.
CREATE TABLE drop_view_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), drop_id uuid NOT NULL REFERENCES drops(id) ON DELETE RESTRICT,
  viewer_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT, occurred_at timestamptz NOT NULL DEFAULT now(), counted boolean NOT NULL
);
CREATE INDEX drop_view_events_drop_time_idx ON drop_view_events(drop_id,occurred_at DESC);
CREATE TABLE drop_views (
  drop_id uuid NOT NULL REFERENCES drops(id) ON DELETE RESTRICT, viewer_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  window_started_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(drop_id,viewer_user_id,window_started_at)
);
CREATE INDEX drop_views_drop_idx ON drop_views(drop_id);

CREATE TABLE drop_share_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), drop_id uuid NOT NULL REFERENCES drops(id) ON DELETE RESTRICT,
  actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT, channel text NOT NULL CHECK(channel IN ('WEB_SHARE','COPY_LINK')),
  window_started_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(drop_id,actor_user_id,channel,window_started_at)
);

CREATE TABLE engagement_idempotency (
  actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT, action text NOT NULL, idempotency_key text NOT NULL,
  resource_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(actor_user_id,action,idempotency_key)
);
