-- ClubService.create validates avatarMediaId/coverMediaId against
-- media_assets rows with purpose CLUB_AVATAR/CLUB_COVER (matching the
-- PROFILE_AVATAR/PROFILE_COVER split already used for user profiles), and
-- the API's upload-intent schema (packages/media/src/constants.ts) already
-- accepts those two purposes — but the media_purpose enum never included
-- them, so creating an upload intent for a Club avatar/cover was rejected
-- by the database with an invalid-enum-value error on every attempt.
ALTER TYPE media_purpose ADD VALUE IF NOT EXISTS 'CLUB_AVATAR';
ALTER TYPE media_purpose ADD VALUE IF NOT EXISTS 'CLUB_COVER';
