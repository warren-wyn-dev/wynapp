# Media Storage

Cloudflare R2 is primary and AWS S3-compatible storage is fallback through the same `MediaStorage` boundary. Quarantine and processed buckets/namespaces use separate least-privilege credentials. Provider credentials remain server/worker-only. Keys are server-generated UUID paths, validated against a traversal-safe allowlist, never derived from raw filenames. Processed keys are deterministic (`processed/<asset-id>/<variant>.webp`) and immutable, with `public,max-age=31536000,immutable` CDN headers.

Private `CHAT_IMAGE` records are owner-addressed and not listable. A later Chat authorization boundary must issue short-lived authorized delivery rather than place them on an enumerable public origin.
