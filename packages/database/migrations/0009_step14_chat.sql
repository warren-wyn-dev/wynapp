DO $$ BEGIN CREATE TYPE message_request_status AS ENUM ('PENDING','ACCEPTED','DECLINED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE message_kind AS ENUM ('TEXT','IMAGE','DROP_SHARE','PROFILE_SHARE','CLUB_SHARE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'CHAT_MESSAGE';
ALTER TYPE notification_category ADD VALUE IF NOT EXISTS 'CHAT';
ALTER TABLE notifications DROP CONSTRAINT notifications_entity_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_entity_type_check CHECK(entity_type IN ('DROP','COMMENT','USER','TOPIC','SYSTEM','CONVERSATION'));

CREATE TABLE conversations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), pair_low_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 pair_high_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT, next_sequence bigint NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(pair_low_user_id < pair_high_user_id), UNIQUE(pair_low_user_id,pair_high_user_id)
);
CREATE TABLE conversation_members (
 conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE RESTRICT, user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 last_read_sequence bigint NOT NULL DEFAULT 0 CHECK(last_read_sequence>=0), joined_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(conversation_id,user_id)
);
CREATE INDEX conversation_members_inbox_idx ON conversation_members(user_id,conversation_id);
CREATE OR REPLACE FUNCTION enforce_direct_members() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM conversations c WHERE c.id=NEW.conversation_id AND NEW.user_id IN(c.pair_low_user_id,c.pair_high_user_id))
 THEN RAISE EXCEPTION 'invalid direct participant' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER conversation_member_pair BEFORE INSERT OR UPDATE ON conversation_members FOR EACH ROW EXECUTE FUNCTION enforce_direct_members();

CREATE TABLE message_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id uuid NOT NULL UNIQUE REFERENCES conversations(id) ON DELETE RESTRICT,
 sender_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT, recipient_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 status message_request_status NOT NULL DEFAULT 'PENDING', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz,
 CHECK(sender_user_id<>recipient_user_id), UNIQUE(conversation_id,sender_user_id,recipient_user_id)
);
CREATE INDEX message_requests_recipient_idx ON message_requests(recipient_user_id,status,created_at DESC,id DESC);

CREATE TABLE messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE RESTRICT,
 sequence bigint NOT NULL, sender_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT, kind message_kind NOT NULL,
 body text, media_asset_id uuid REFERENCES media_assets(id) ON DELETE RESTRICT, drop_id uuid REFERENCES drops(id) ON DELETE RESTRICT,
 profile_user_id uuid REFERENCES users(id) ON DELETE RESTRICT, club_id uuid REFERENCES clubs(id) ON DELETE RESTRICT,
 reply_to_message_id uuid, client_message_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz,
 UNIQUE(conversation_id,sequence), UNIQUE(sender_user_id,client_message_id), UNIQUE(id,conversation_id),
 FOREIGN KEY(reply_to_message_id,conversation_id) REFERENCES messages(id,conversation_id) ON DELETE RESTRICT,
 CHECK(deleted_at IS NOT NULL OR (kind='TEXT' AND body IS NOT NULL AND length(body) BETWEEN 1 AND 4000 AND media_asset_id IS NULL AND drop_id IS NULL AND profile_user_id IS NULL AND club_id IS NULL)
 OR (kind='IMAGE' AND media_asset_id IS NOT NULL AND body IS NULL AND drop_id IS NULL AND profile_user_id IS NULL AND club_id IS NULL)
 OR (kind='DROP_SHARE' AND drop_id IS NOT NULL AND body IS NULL AND media_asset_id IS NULL AND profile_user_id IS NULL AND club_id IS NULL)
 OR (kind='PROFILE_SHARE' AND profile_user_id IS NOT NULL AND body IS NULL AND media_asset_id IS NULL AND drop_id IS NULL AND club_id IS NULL)
 OR (kind='CLUB_SHARE' AND club_id IS NOT NULL AND body IS NULL AND media_asset_id IS NULL AND drop_id IS NULL AND profile_user_id IS NULL))
);
CREATE INDEX messages_cursor_idx ON messages(conversation_id,sequence DESC);
CREATE INDEX messages_sender_idx ON messages(sender_user_id,created_at DESC);

CREATE TABLE message_reports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), message_id uuid NOT NULL REFERENCES messages(id) ON DELETE RESTRICT,
 reporter_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT, reason text NOT NULL CHECK(length(reason) BETWEEN 3 AND 500),
 evidence jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(message_id,reporter_user_id)
);
