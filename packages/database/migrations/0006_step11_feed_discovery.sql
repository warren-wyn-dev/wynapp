CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $$ BEGIN CREATE TYPE engagement_scope AS ENUM ('GLOBAL_PUBLIC','CLUB_INTERNAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE drop_likes ADD COLUMN scope engagement_scope NOT NULL DEFAULT 'GLOBAL_PUBLIC';
ALTER TABLE comments ADD COLUMN scope engagement_scope NOT NULL DEFAULT 'GLOBAL_PUBLIC';
ALTER TABLE redrops ADD COLUMN scope engagement_scope NOT NULL DEFAULT 'GLOBAL_PUBLIC';
ALTER TABLE drop_views ADD COLUMN scope engagement_scope NOT NULL DEFAULT 'GLOBAL_PUBLIC';
-- Existing rows are public. New writes must make distribution scope explicit (deny by default).
ALTER TABLE drop_likes ALTER COLUMN scope DROP DEFAULT;
ALTER TABLE comments ALTER COLUMN scope DROP DEFAULT;
ALTER TABLE redrops ALTER COLUMN scope DROP DEFAULT;
ALTER TABLE drop_views ALTER COLUMN scope DROP DEFAULT;
CREATE INDEX drop_likes_global_rank_idx ON drop_likes(drop_id,created_at) WHERE scope='GLOBAL_PUBLIC';
CREATE INDEX comments_global_rank_idx ON comments(drop_id,created_at) WHERE scope='GLOBAL_PUBLIC' AND deleted_at IS NULL;
CREATE INDEX redrops_global_rank_idx ON redrops(original_drop_id,created_at) WHERE scope='GLOBAL_PUBLIC' AND deleted_at IS NULL;
CREATE INDEX drop_views_global_rank_idx ON drop_views(drop_id,created_at) WHERE scope='GLOBAL_PUBLIC';

ALTER TABLE drops ADD COLUMN search_document tsvector GENERATED ALWAYS AS
  (to_tsvector('simple',coalesce(body,'') || ' ' || coalesce(caption,''))) STORED;
CREATE INDEX drops_search_document_idx ON drops USING gin(search_document);
CREATE INDEX profiles_username_trgm_idx ON profiles USING gin(username_normalized gin_trgm_ops);
CREATE INDEX profiles_display_name_trgm_idx ON profiles USING gin(lower(display_name) gin_trgm_ops);
CREATE INDEX hashtags_trgm_idx ON hashtags USING gin(normalized gin_trgm_ops);

CREATE TABLE topics (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text NOT NULL UNIQUE CHECK(slug ~ '^[a-z0-9-]{1,60}$'),
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 80), description text NOT NULL DEFAULT '',
 is_curated boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE topic_hashtags (
 topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
 hashtag_id uuid NOT NULL REFERENCES hashtags(id) ON DELETE CASCADE, PRIMARY KEY(topic_id,hashtag_id)
);

CREATE TABLE trending_drop_snapshots (
 window_started_at timestamptz NOT NULL, drop_id uuid NOT NULL REFERENCES drops(id) ON DELETE RESTRICT,
 rank integer NOT NULL CHECK(rank>0), score double precision NOT NULL CHECK(score>=0), computed_at timestamptz NOT NULL,
 PRIMARY KEY(window_started_at,drop_id), UNIQUE(window_started_at,rank)
);
CREATE INDEX trending_drop_latest_idx ON trending_drop_snapshots(computed_at DESC,rank);
CREATE TABLE top_creator_snapshots (
 window_started_at timestamptz NOT NULL, creator_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 rank integer NOT NULL CHECK(rank BETWEEN 1 AND 100), score double precision NOT NULL CHECK(score>=0), computed_at timestamptz NOT NULL,
 PRIMARY KEY(window_started_at,creator_user_id), UNIQUE(window_started_at,rank)
);
CREATE INDEX top_creator_latest_idx ON top_creator_snapshots(computed_at DESC,rank);
CREATE TABLE trending_topic_snapshots (
 window_started_at timestamptz NOT NULL, hashtag_id uuid NOT NULL REFERENCES hashtags(id) ON DELETE RESTRICT,
 rank integer NOT NULL CHECK(rank>0), score double precision NOT NULL CHECK(score>=0), computed_at timestamptz NOT NULL,
 PRIMARY KEY(window_started_at,hashtag_id), UNIQUE(window_started_at,rank)
);
CREATE INDEX trending_topic_latest_idx ON trending_topic_snapshots(computed_at DESC,rank);

CREATE TABLE feed_impressions (
 viewer_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT, drop_id uuid NOT NULL REFERENCES drops(id) ON DELETE RESTRICT,
 last_seen_at timestamptz NOT NULL DEFAULT now(), seen_count integer NOT NULL DEFAULT 1 CHECK(seen_count>0),
 PRIMARY KEY(viewer_user_id,drop_id)
);

INSERT INTO outbox_events(event_type,aggregate_type,aggregate_id,payload,request_id)
SELECT 'DiscoveryRankingRecomputeRequested','System',gen_random_uuid(),'{"window":"7 days"}'::jsonb,'migration-step11';
