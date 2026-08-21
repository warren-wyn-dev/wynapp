# Step 8 Media Architecture

**Status:** IMPLEMENTED FOR FOUNDER REVIEW. Step 9 and product flows are excluded.

PostgreSQL is authoritative for ownership and lifecycle. Browser uploads go only to a private quarantine namespace through a 15-minute signed PUT. A worker safely decodes bytes with Sharp and publishes immutable processed variants. Only `READY` variants may be attached or delivered. The domain depends on `MediaStorage`, with Cloudflare R2 primary and any correctly configured AWS S3-compatible endpoint as fallback.

Events `MediaUploadRequested`, `MediaUploaded`, `MediaProcessingRequested`, `MediaReady`, `MediaFailed`, and `MediaDeleted` are written to the transactional outbox in the same transaction as state changes. Jobs are idempotent: READY is terminal for processing and deterministic variant keys make retries overwrite the same objects rather than multiply storage.
