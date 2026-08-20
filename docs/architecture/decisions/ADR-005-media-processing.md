# ADR-005: Quarantined Media Processing

## Status

**PROPOSED** — requires Founder approval.

## Context

Images are untrusted and may be oversized, malformed, malicious or privacy-sensitive. Direct uploads are desirable for scale, but uploaded bytes cannot become public or attachable before trusted processing. A Drop must never exceed nine images.

## Decision

Issue short-lived, size/key-constrained upload intents into private quarantine. A resource-limited worker verifies actual bytes, safely decodes, strips metadata, resizes and re-encodes AVIF/WebP plus approved fallback, then copies immutable variants to permanent storage and marks media READY. Only an authorized transaction may attach same-owner READY media, with a database-backed aggregate maximum of nine.

## Alternatives

- Upload through API and serve originals: simpler flow but API bottleneck plus upload and metadata risk.
- Direct-to-public object storage: bypasses validation and attachment authorization.
- Client-side conversion only: clients are untrusted and transformations are inconsistent.
- External media SaaS: reduces implementation but adds provider, privacy, cost and outage dependency requiring later approval.

## Consequences

Unsafe bytes remain isolated and CDN content is normalized. Processing is eventually consistent and needs visible states, retries, cleanup and reconciliation. Object/database lifecycle and evidence retention require policy. Multiple variants increase storage cost but improve delivery performance and privacy.
