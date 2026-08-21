# Upload Flow

1. An authenticated, CSRF-protected and rate-limited request supplies purpose, declared MIME and byte count—not a key or filename.
2. The API validates JPEG/PNG/WebP and 1–15 MiB, creates `PENDING`, generates `quarantine/<uuid>/source`, and returns a 15-minute signed upload.
3. Completion checks owner, state, object existence, exact byte count and content type, then atomically records `UPLOADED` plus processing events. Repeated completion is safe.
4. The worker moves to `PROCESSING`, reads private quarantine bytes, sniffs/decodes, transforms and stores variants, then atomically moves to `READY` and removes quarantine. Failure records `FAILED`; originals are never public.
