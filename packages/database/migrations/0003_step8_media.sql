DO $$ BEGIN CREATE TYPE media_status AS ENUM ('PENDING','UPLOADED','PROCESSING','READY','FAILED','DELETED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE media_purpose AS ENUM ('PROFILE_AVATAR','PROFILE_COVER','DROP_IMAGE','CLUB_IMAGE','CHAT_IMAGE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  media_type text NOT NULL DEFAULT 'IMAGE' CHECK (media_type='IMAGE'), purpose media_purpose NOT NULL,
  status media_status NOT NULL DEFAULT 'PENDING', source_mime text NOT NULL,
  processed_mime text, width integer CHECK(width>0), height integer CHECK(height>0),
  byte_size bigint NOT NULL CHECK(byte_size>0 AND byte_size<=15728640), storage_key text NOT NULL UNIQUE,
  thumbnail_key text UNIQUE, feed_variant_key text UNIQUE, full_variant_key text UNIQUE, checksum_sha256 text,
  intent_expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz, deleted_at timestamptz,
  CHECK(storage_key ~ '^quarantine/[0-9a-f-]{36}/source$'),
  CHECK(status<>'READY' OR (processed_mime IS NOT NULL AND thumbnail_key IS NOT NULL AND feed_variant_key IS NOT NULL AND full_variant_key IS NOT NULL AND processed_at IS NOT NULL)),
  CHECK((status='DELETED') = (deleted_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS media_owner_created_idx ON media_assets(owner_user_id,created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS media_cleanup_idx ON media_assets(status,intent_expires_at);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_media_id uuid REFERENCES media_assets(id) ON DELETE SET NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_media_id uuid REFERENCES media_assets(id) ON DELETE SET NULL;

-- Step 9 will promote this foundation into its Drop aggregate. A trigger is the final,
-- transaction-authoritative guard; application code additionally serializes per drop.
CREATE TABLE IF NOT EXISTS drop_media_attachments (
  drop_id uuid NOT NULL, media_asset_id uuid NOT NULL REFERENCES media_assets(id) ON DELETE RESTRICT,
  position smallint NOT NULL CHECK(position BETWEEN 0 AND 8), created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(drop_id,media_asset_id), UNIQUE(drop_id,position)
);
CREATE OR REPLACE FUNCTION enforce_drop_media_limit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.drop_id::text,0));
  IF (SELECT count(*) FROM drop_media_attachments WHERE drop_id=NEW.drop_id) >= 9 THEN RAISE EXCEPTION 'DROP_MEDIA_LIMIT' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS drop_media_limit_trigger ON drop_media_attachments;
CREATE TRIGGER drop_media_limit_trigger BEFORE INSERT ON drop_media_attachments FOR EACH ROW EXECUTE FUNCTION enforce_drop_media_limit();
