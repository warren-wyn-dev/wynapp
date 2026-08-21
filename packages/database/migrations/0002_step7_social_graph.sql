CREATE TYPE follow_request_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'CONVERTED');

CREATE TABLE follows (
  follower_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  followed_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followed_id),
  CONSTRAINT follows_no_self CHECK (follower_id <> followed_id)
);
CREATE INDEX follows_followers_page_idx ON follows (followed_id, created_at DESC, follower_id DESC);
CREATE INDEX follows_following_page_idx ON follows (follower_id, created_at DESC, followed_id DESC);

CREATE TABLE follow_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  target_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status follow_request_status NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT follow_requests_no_self CHECK (requester_id <> target_id),
  CONSTRAINT follow_requests_resolution CHECK (
    (status = 'PENDING' AND resolved_at IS NULL) OR
    (status <> 'PENDING' AND resolved_at IS NOT NULL)
  )
);
CREATE UNIQUE INDEX follow_requests_pending_pair_uq ON follow_requests (requester_id, target_id) WHERE status = 'PENDING';
CREATE INDEX follow_requests_requester_pending_idx ON follow_requests (requester_id, target_id) WHERE status = 'PENDING';
CREATE INDEX follow_requests_incoming_page_idx ON follow_requests (target_id, created_at DESC, id DESC) WHERE status = 'PENDING';

CREATE TABLE blocks (
  blocker_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  blocked_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT blocks_no_self CHECK (blocker_id <> blocked_id)
);
CREATE INDEX blocks_blocked_lookup_idx ON blocks (blocked_id, blocker_id);
CREATE INDEX blocks_page_idx ON blocks (blocker_id, created_at DESC, blocked_id DESC);

CREATE TABLE mutes (
  muter_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  muted_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (muter_id, muted_id),
  CONSTRAINT mutes_no_self CHECK (muter_id <> muted_id)
);
CREATE INDEX mutes_target_lookup_idx ON mutes (muted_id, muter_id);
CREATE INDEX mutes_page_idx ON mutes (muter_id, created_at DESC, muted_id DESC);
