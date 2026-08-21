# Step 9 database

Migration `0004_step9_drop_core.sql` adds enums, `drops`, the Drop foreign key/validation trigger on `drop_media_attachments`, `hashtags`, `drop_hashtags`, `drop_mentions`, `drop_poll_options`, private `drop_revisions`, and `drop_idempotency`. Partial indexes cover drafts and published author/time/visibility reads; reverse relation indexes cover hashtag and mention lookup. The migration is additive and rolls back by dropping Step 9 objects in reverse dependency order.
