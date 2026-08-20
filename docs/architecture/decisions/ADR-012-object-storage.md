# ADR-012: Cloudflare R2 Object Storage

## Status

**ACCEPTED** — Founder-approved for WYN V1.0.0.

## Context

Drops carry up to nine hostile image uploads and require quarantine, transformations, controlled delivery, CDN reach and sustainable bandwidth cost.

## Decision

Use Cloudflare R2 as S3-compatible V1 storage, separated into private quarantine and processed namespaces with least-privilege credentials and lifecycle rules. Serve only validated immutable variants through WYN-controlled delivery. AWS S3 plus CloudFront in Singapore is the fallback.

## Alternatives

- AWS S3/CloudFront: strongest regional ecosystem but likely more transfer/configuration cost; retained fallback.
- Supabase Storage: convenient but adds platform coupling without benefit to the selected data/runtime stack.
- Local disk: not durable, independently scalable or safe for multi-instance deployment.

## Consequences

R2 can reduce delivery cost and provides an S3 portability path, though API/behavior/egress migrations are not perfectly interchangeable. Availability across Cloudflare/AWS and signed-delivery behavior require testing; PostgreSQL remains metadata authority.
