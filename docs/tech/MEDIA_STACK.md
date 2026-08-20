# Media and Object Storage Stack

**Status:** PROPOSED

## Storage

Prefer **Cloudflare R2** behind a WYN-controlled CDN/domain because it is S3-compatible and its public-delivery economics are attractive. **AWS S3 in `ap-southeast-1` plus CloudFront** is the fallback with broader regional/service maturity but potentially higher egress complexity/cost. Supabase Storage is convenient but couples storage authorization to another platform and adds no benefit to the chosen database/runtime.

Use separate private quarantine and processed namespaces/buckets, separate least-privilege credentials and lifecycle rules. The API creates a bounded upload intent; the client uploads directly using a short-lived signed request. Object keys are opaque and immutable. Database state—not bucket listing—is authoritative. Only processed variants are publishable; private originals/variants use authorization and short-lived URLs/cookies as appropriate.

## Processing

Use **Sharp/libvips in isolated workers**. Decode untrusted bytes rather than trust extensions/MIME; cap encoded bytes, decoded pixels, dimensions, frames, metadata, CPU time and memory; reject unsupported/polyglot/corrupt inputs; auto-orient then strip EXIF/GPS; produce bounded thumbnails/display variants in WebP and AVIF only where measured benefit justifies extra CPU. Never serve quarantine bytes.

Maintain idempotent processing keyed by content/version, verify output, publish with an atomic state transition and clean orphans through delayed reconciliation. Add malware/scanning hooks and abuse limits. A managed transformation service is a later option if processing load/format security/operations exceed workers; a hybrid remains portable because originals and variant metadata stay WYN-owned.
