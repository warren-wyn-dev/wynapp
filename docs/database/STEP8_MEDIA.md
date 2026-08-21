# Step 8 Media Schema

Migration `0003_step8_media.sql` creates enums `media_status` and `media_purpose`; `media_assets`; owner/cleanup indexes; nullable profile avatar/cover media foreign keys; and the future-facing `drop_media_attachments` table. Checks enforce image-only type, positive dimensions/bytes, 15 MiB, generated quarantine-key shape, READY completeness and DELETED timestamp. Foreign keys prevent dangling owners/assets. Drop primary/unique constraints and a lock-taking trigger authoritatively enforce uniqueness, position 0–8 and at most nine attachments under concurrency.
