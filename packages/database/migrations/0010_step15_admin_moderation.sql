DO $$ BEGIN CREATE TYPE admin_role AS ENUM ('OWNER','SUPER_ADMIN','MODERATOR','SUPPORT','ANALYST','CONTENT_ADMIN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE report_target_type AS ENUM ('USER','DROP','COMMENT','CLUB','MESSAGE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE report_status AS ENUM ('RECEIVED','TRIAGED','LINKED_TO_CASE','CLOSED','REJECTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE moderation_case_status AS ENUM ('OPEN','IN_REVIEW','DECIDED','ACTIONED','AWAITING_APPEAL_REVIEW','RESOLVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE moderation_action_type AS ENUM ('NO_ACTION','WARNING','REMOVE_CONTENT','RESTRICT','SUSPEND','BAN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE appeal_status AS ENUM ('SUBMITTED','IN_REVIEW','UPHELD','MODIFIED','OVERTURNED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE admin_principals ADD COLUMN role admin_role;
ALTER TABLE admin_principals ADD COLUMN permissions text[] NOT NULL DEFAULT '{}';
ALTER TABLE admin_principals ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE sessions ADD COLUMN step_up_at timestamptz;

CREATE TABLE reports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reporter_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 target_type report_target_type NOT NULL, target_id uuid NOT NULL, reason_code text NOT NULL CHECK(reason_code ~ '^[A-Z0-9_]{2,50}$'),
 context text CHECK(context IS NULL OR length(context)<=2000), source_surface text NOT NULL CHECK(length(source_surface) BETWEEN 1 AND 50),
 status report_status NOT NULL DEFAULT 'RECEIVED', idempotency_key text NOT NULL CHECK(length(idempotency_key) BETWEEN 8 AND 100),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(reporter_user_id,idempotency_key)
);
CREATE INDEX reports_queue_idx ON reports(status,created_at,id);
CREATE INDEX reports_target_idx ON reports(target_type,target_id,created_at DESC);

CREATE TABLE moderation_cases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), target_type report_target_type NOT NULL, target_id uuid NOT NULL,
 status moderation_case_status NOT NULL DEFAULT 'OPEN', priority smallint NOT NULL DEFAULT 3 CHECK(priority BETWEEN 1 AND 5),
 assignee_admin_id uuid REFERENCES admin_principals(user_id) ON DELETE RESTRICT, version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX moderation_cases_queue_idx ON moderation_cases(status,priority,created_at,id);
CREATE TABLE case_reports (case_id uuid NOT NULL REFERENCES moderation_cases(id) ON DELETE RESTRICT, report_id uuid NOT NULL UNIQUE REFERENCES reports(id) ON DELETE RESTRICT, PRIMARY KEY(case_id,report_id));

CREATE TABLE moderation_actions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), case_id uuid NOT NULL REFERENCES moderation_cases(id) ON DELETE RESTRICT,
 actor_admin_id uuid NOT NULL REFERENCES admin_principals(user_id) ON DELETE RESTRICT, action_type moderation_action_type NOT NULL,
 permission_used text NOT NULL, reason_code text NOT NULL CHECK(length(reason_code) BETWEEN 2 AND 50), notes text CHECK(notes IS NULL OR length(notes)<=2000),
 effective_until timestamptz, idempotency_key text NOT NULL CHECK(length(idempotency_key) BETWEEN 8 AND 100), request_id text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(actor_admin_id,idempotency_key)
);
CREATE INDEX moderation_actions_case_idx ON moderation_actions(case_id,created_at,id);

CREATE TABLE appeals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), action_id uuid NOT NULL REFERENCES moderation_actions(id) ON DELETE RESTRICT,
 appellant_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT, reason text NOT NULL CHECK(length(reason) BETWEEN 10 AND 2000),
 status appeal_status NOT NULL DEFAULT 'SUBMITTED', reviewer_admin_id uuid REFERENCES admin_principals(user_id) ON DELETE RESTRICT,
 decision_reason text CHECK(decision_reason IS NULL OR length(decision_reason) BETWEEN 3 AND 2000), version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz
);
CREATE UNIQUE INDEX appeals_open_action_user_uq ON appeals(action_id,appellant_user_id) WHERE status IN ('SUBMITTED','IN_REVIEW');

CREATE TABLE admin_audit_logs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_admin_id uuid REFERENCES admin_principals(user_id) ON DELETE RESTRICT,
 action text NOT NULL, permission_used text, target_type text NOT NULL, target_id uuid, reason text,
 before_state jsonb NOT NULL DEFAULT '{}', after_state jsonb NOT NULL DEFAULT '{}', request_id text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_audit_logs_time_idx ON admin_audit_logs(created_at DESC,id DESC);
CREATE OR REPLACE FUNCTION immutable_admin_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'admin audit logs are append-only' USING ERRCODE='55000'; END $$;
CREATE TRIGGER admin_audit_immutable BEFORE UPDATE OR DELETE ON admin_audit_logs FOR EACH ROW EXECUTE FUNCTION immutable_admin_audit();

CREATE TABLE system_announcements (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL CHECK(length(title) BETWEEN 1 AND 120), body text NOT NULL CHECK(length(body) BETWEEN 1 AND 4000), status text NOT NULL CHECK(status IN ('DRAFT','PUBLISHED','ARCHIVED')), created_by_admin_id uuid NOT NULL REFERENCES admin_principals(user_id) ON DELETE RESTRICT, published_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), CHECK((status='PUBLISHED')=(published_at IS NOT NULL)));
CREATE TABLE feature_flags (key text PRIMARY KEY CHECK(key ~ '^[a-z][a-z0-9_.-]{2,80}$'), enabled boolean NOT NULL DEFAULT false, rollout_percent smallint NOT NULL DEFAULT 0 CHECK(rollout_percent BETWEEN 0 AND 100), description text NOT NULL DEFAULT '', version integer NOT NULL DEFAULT 1, updated_by_admin_id uuid REFERENCES admin_principals(user_id) ON DELETE RESTRICT, updated_at timestamptz NOT NULL DEFAULT now());
