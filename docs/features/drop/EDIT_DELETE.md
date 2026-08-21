# Edit and delete

The server clock enforces a 30-minute edit window from `published_at`. Text, caption, visibility, link, and location may be edited; the previous snapshot is stored in private `drop_revisions`, `edited_at` is set, and an outbox event is written. Delete is author-only, idempotent soft deletion; normal reads hide deleted content and media is not hard-deleted.
