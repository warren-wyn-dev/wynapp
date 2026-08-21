# Cost and Performance

For about 1,000 DAU, direct-to-object-storage uploads avoid API bandwidth and three bounded WebP variants avoid runtime transforms. Immutable CDN caching reduces egress and origin reads. Quarantine expires promptly; originals are deleted after successful processing. Deterministic keys prevent retry duplication. Worker concurrency must be bounded by measured CPU/memory, with AVIF deferred to avoid unproven CPU cost. Track intent abandonment, rejection rate, processing p95, output/input ratio, worker memory and stored bytes before changing limits.
