DO $$ BEGIN CREATE TYPE club_visibility AS ENUM ('PUBLIC','PRIVATE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE club_role AS ENUM ('OWNER','ADMIN','MODERATOR','MEMBER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE club_join_request_status AS ENUM ('PENDING','APPROVED','REJECTED','CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TYPE media_purpose ADD VALUE IF NOT EXISTS 'CLUB_AVATAR';
ALTER TYPE media_purpose ADD VALUE IF NOT EXISTS 'CLUB_COVER';

CREATE TABLE clubs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 name text NOT NULL CHECK(length(name) BETWEEN 2 AND 80), slug text NOT NULL CHECK(slug=lower(slug) AND slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' AND length(slug) BETWEEN 2 AND 50),
 description text NOT NULL DEFAULT '' CHECK(length(description)<=2000), visibility club_visibility NOT NULL,
 avatar_media_id uuid REFERENCES media_assets(id) ON DELETE RESTRICT, cover_media_id uuid REFERENCES media_assets(id) ON DELETE RESTRICT,
 member_count integer NOT NULL DEFAULT 1 CHECK(member_count>=1), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz,
 CONSTRAINT clubs_reserved_slug CHECK(slug NOT IN ('admin','support','wyn','system','official','security')),
 UNIQUE(id,owner_user_id)
);
CREATE UNIQUE INDEX clubs_slug_ci_active_uq ON clubs(lower(slug)) WHERE deleted_at IS NULL;
CREATE INDEX clubs_discovery_idx ON clubs(visibility,member_count DESC,created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX clubs_search_idx ON clubs USING gin(to_tsvector('simple',name||' '||slug||' '||description)) WHERE deleted_at IS NULL;

CREATE TABLE club_members (
 club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE RESTRICT, user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 role club_role NOT NULL DEFAULT 'MEMBER', joined_at timestamptz NOT NULL DEFAULT now(), restricted_until timestamptz,
 PRIMARY KEY(club_id,user_id), UNIQUE(club_id,user_id,role)
);
CREATE INDEX club_members_role_idx ON club_members(club_id,role,joined_at,user_id);
CREATE INDEX club_members_user_idx ON club_members(user_id,joined_at DESC);
CREATE OR REPLACE FUNCTION protect_club_owner() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cid uuid := COALESCE(NEW.club_id,OLD.club_id); uid uuid := COALESCE(NEW.user_id,OLD.user_id);
BEGIN
 IF EXISTS(SELECT 1 FROM clubs WHERE id=cid AND owner_user_id=uid AND deleted_at IS NULL)
    AND (TG_OP='DELETE' OR NEW.role<>'OWNER') THEN RAISE EXCEPTION 'club owner membership is protected' USING ERRCODE='23514'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER club_owner_protection BEFORE DELETE OR UPDATE OF role ON club_members FOR EACH ROW EXECUTE FUNCTION protect_club_owner();

CREATE TABLE club_join_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE RESTRICT, user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 status club_join_request_status NOT NULL DEFAULT 'PENDING', decided_by_user_id uuid REFERENCES users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz
);
CREATE UNIQUE INDEX club_join_requests_pending_uq ON club_join_requests(club_id,user_id) WHERE status='PENDING';
CREATE INDEX club_join_requests_queue_idx ON club_join_requests(club_id,status,created_at,id);

CREATE TABLE club_rules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE RESTRICT,
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 120), description text NOT NULL CHECK(length(description) BETWEEN 1 AND 1000),
 position smallint NOT NULL CHECK(position BETWEEN 0 AND 49), enabled boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(club_id,position)
);
ALTER TABLE drops ADD COLUMN club_id uuid REFERENCES clubs(id) ON DELETE RESTRICT;
ALTER TABLE drops ADD CONSTRAINT drops_club_visibility_ck CHECK(club_id IS NULL OR visibility='PUBLIC');
CREATE INDEX drops_club_feed_idx ON drops(club_id,published_at DESC,id DESC) WHERE club_id IS NOT NULL AND status='PUBLISHED' AND deleted_at IS NULL;

CREATE TABLE club_pinned_drops (
 club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE RESTRICT, drop_id uuid NOT NULL REFERENCES drops(id) ON DELETE RESTRICT,
 pinned_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT, pinned_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(club_id,drop_id)
);
CREATE INDEX club_pins_order_idx ON club_pinned_drops(club_id,pinned_at DESC);

CREATE TABLE club_bans (
 club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE RESTRICT, user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 reason text NOT NULL CHECK(length(reason) BETWEEN 3 AND 1000), created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz, PRIMARY KEY(club_id,user_id)
);
CREATE TABLE club_audit_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE RESTRICT, actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 action text NOT NULL, target_user_id uuid REFERENCES users(id) ON DELETE RESTRICT, drop_id uuid REFERENCES drops(id) ON DELETE RESTRICT,
 reason text, metadata jsonb NOT NULL DEFAULT '{}', request_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX club_audit_idx ON club_audit_events(club_id,created_at DESC,id DESC);

-- Existing engagement scope columns are the single source of truth. Club Drop engagement must be CLUB_INTERNAL.
CREATE OR REPLACE FUNCTION enforce_engagement_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM drops WHERE id=NEW.drop_id AND club_id IS NOT NULL) THEN NEW.scope='CLUB_INTERNAL'; ELSE NEW.scope='GLOBAL_PUBLIC'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER drop_likes_scope BEFORE INSERT OR UPDATE OF drop_id ON drop_likes FOR EACH ROW EXECUTE FUNCTION enforce_engagement_scope();
CREATE TRIGGER comments_scope BEFORE INSERT OR UPDATE OF drop_id ON comments FOR EACH ROW EXECUTE FUNCTION enforce_engagement_scope();
CREATE TRIGGER drop_views_scope BEFORE INSERT OR UPDATE OF drop_id ON drop_views FOR EACH ROW EXECUTE FUNCTION enforce_engagement_scope();
CREATE OR REPLACE FUNCTION enforce_redrop_scope() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS(SELECT 1 FROM drops WHERE id=NEW.original_drop_id AND club_id IS NOT NULL) THEN NEW.scope='CLUB_INTERNAL'; ELSE NEW.scope='GLOBAL_PUBLIC'; END IF; RETURN NEW; END $$;
CREATE TRIGGER redrops_scope BEFORE INSERT OR UPDATE OF original_drop_id ON redrops FOR EACH ROW EXECUTE FUNCTION enforce_redrop_scope();
