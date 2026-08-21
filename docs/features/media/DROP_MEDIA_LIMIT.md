# Drop Media Limit Foundation

A future Drop accepts 1–9 unique `READY`, owner-held `DROP_IMAGE` assets. The client constant and request boundary reject more than nine; `MediaService.attachDrop` repeats validation, acquires a per-Drop PostgreSQL advisory transaction lock, checks the authoritative count and inserts atomically. The database trigger takes the same lock and rejects a tenth row, while primary/unique constraints reject duplicate assets and positions. This is only a Step 9 integration interface; no Drop product flow exists in Step 8.
