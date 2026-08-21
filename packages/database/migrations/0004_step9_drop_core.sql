DO $$ BEGIN CREATE TYPE drop_status AS ENUM ('DRAFT','PUBLISHED','DELETED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE drop_visibility AS ENUM ('PUBLIC','FOLLOWERS'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE drops (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), author_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 status drop_status NOT NULL DEFAULT 'DRAFT', visibility drop_visibility NOT NULL DEFAULT 'PUBLIC',
 body text NOT NULL DEFAULT '', caption text NOT NULL DEFAULT '', external_url text, location_label text,
 poll_question text, poll_expires_at timestamptz, published_at timestamptz, edited_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz,
 version integer NOT NULL DEFAULT 1 CHECK(version > 0),
 CHECK(length(body)<=5000 AND length(caption)<=2200),
 CHECK(location_label IS NULL OR length(location_label) BETWEEN 1 AND 120),
 CHECK(external_url IS NULL OR external_url ~ '^https?://'),
 CHECK(poll_question IS NULL OR length(poll_question) BETWEEN 1 AND 280),
 CHECK((status='DRAFT' AND published_at IS NULL AND deleted_at IS NULL) OR
       (status='PUBLISHED' AND published_at IS NOT NULL AND deleted_at IS NULL) OR
       (status='DELETED' AND deleted_at IS NOT NULL)),
 CHECK(edited_at IS NULL OR (published_at IS NOT NULL AND edited_at>=published_at))
);
CREATE INDEX drops_author_drafts_idx ON drops(author_user_id,updated_at DESC,id) WHERE status='DRAFT';
CREATE INDEX drops_author_published_idx ON drops(author_user_id,published_at DESC,id) WHERE status='PUBLISHED';
CREATE INDEX drops_visibility_published_idx ON drops(visibility,published_at DESC,id) WHERE status='PUBLISHED';

ALTER TABLE drop_media_attachments ADD CONSTRAINT drop_media_drop_fk FOREIGN KEY(drop_id) REFERENCES drops(id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION validate_drop_media() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d_author uuid; m_owner uuid; m_status media_status; m_purpose media_purpose;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.drop_id::text,0));
 SELECT author_user_id INTO d_author FROM drops WHERE id=NEW.drop_id FOR UPDATE;
 SELECT owner_user_id,status,purpose INTO m_owner,m_status,m_purpose FROM media_assets WHERE id=NEW.media_asset_id FOR SHARE;
 IF d_author IS NULL OR m_owner IS DISTINCT FROM d_author OR m_status<>'READY' OR m_purpose<>'DROP_IMAGE' THEN
   RAISE EXCEPTION 'DROP_MEDIA_INVALID' USING ERRCODE='23514';
 END IF;
 IF (SELECT count(*) FROM drop_media_attachments WHERE drop_id=NEW.drop_id) >= 9 THEN
   RAISE EXCEPTION 'DROP_MEDIA_LIMIT' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS drop_media_limit_trigger ON drop_media_attachments;
CREATE TRIGGER drop_media_limit_trigger BEFORE INSERT OR UPDATE ON drop_media_attachments FOR EACH ROW EXECUTE FUNCTION validate_drop_media();

CREATE TABLE hashtags (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), normalized text NOT NULL UNIQUE CHECK(normalized ~ '^[[:alnum:]_]{1,50}$'), created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX hashtags_normalized_idx ON hashtags(normalized);
CREATE TABLE drop_hashtags (drop_id uuid NOT NULL REFERENCES drops(id) ON DELETE RESTRICT, hashtag_id uuid NOT NULL REFERENCES hashtags(id) ON DELETE RESTRICT, PRIMARY KEY(drop_id,hashtag_id));
CREATE INDEX drop_hashtags_hashtag_idx ON drop_hashtags(hashtag_id,drop_id);
CREATE TABLE drop_mentions (drop_id uuid NOT NULL REFERENCES drops(id) ON DELETE RESTRICT, mentioned_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT, PRIMARY KEY(drop_id,mentioned_user_id));
CREATE INDEX drop_mentions_user_idx ON drop_mentions(mentioned_user_id,drop_id);

CREATE TABLE drop_poll_options (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), drop_id uuid NOT NULL REFERENCES drops(id) ON DELETE RESTRICT,
 position smallint NOT NULL CHECK(position BETWEEN 0 AND 3), label text NOT NULL CHECK(length(label) BETWEEN 1 AND 100),
 UNIQUE(drop_id,position), UNIQUE(drop_id,label)
);

CREATE TABLE drop_revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), drop_id uuid NOT NULL REFERENCES drops(id) ON DELETE RESTRICT,
 revision integer NOT NULL CHECK(revision>0), snapshot jsonb NOT NULL, edited_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 request_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(drop_id,revision)
);
CREATE INDEX drop_revisions_drop_idx ON drop_revisions(drop_id,revision DESC);

CREATE TABLE drop_idempotency (
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT, action text NOT NULL, idempotency_key text NOT NULL,
 request_hash text NOT NULL, drop_id uuid NOT NULL REFERENCES drops(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,action,idempotency_key)
);
