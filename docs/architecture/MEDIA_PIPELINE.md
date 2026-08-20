# Drop and Image Media Pipeline

**Status:** PROPOSED. One Drop may contain **0–9 images**, enforced authoritatively.

## State machine and flow

```text
Client → upload intent → authorize quota/purpose → signed bounded upload
→ private quarantine → server verifies receipt → validate bytes/type/dimensions
→ sandboxed safe decode → metadata strip → resize → compress
→ AVIF/WebP plus approved fallback → permanent private origin → READY → CDN
                         ↘ rejection: REJECTED (safe reason; quarantine expiry)
```

Media states are `INTENT_CREATED`, `UPLOADED`, `PROCESSING`, `READY`, `REJECTED`, `EXPIRED`, `ATTACHED`, and `DELETED`. Only the worker can mark a variant READY after all checks and successful permanent copy. Quarantine and permanent buckets/prefixes have distinct least-privilege credentials; quarantined/original bytes are never publicly served. CDN URLs expose immutable derived object keys, not storage credentials.

## Trusted validation

- Intent creation authenticates the subject, validates purpose (`DROP`, profile, chat, club), quotas, declared size/type/count, and issues a short-lived single-object upload capability constrained by key and byte size.
- Completion distrusts filename, extension, MIME and client metadata. Check magic bytes, allowlisted codecs, exact byte limits, dimensions, pixel count, frame/page count and animation policy.
- Decode in an isolated, resource-limited worker using maintained safe libraries; set CPU, memory and time limits to stop decompression/image bombs. Reject malformed, polyglot, unsupported or malicious content; optional malware scanning is defense in depth, not a substitute for decoding.
- Re-encode from decoded pixels, strip EXIF/GPS/ICC and other metadata except explicitly safe color/orientation handling, normalize orientation, resize to bounded variants, and compress. Serve AVIF/WebP by negotiation with a broadly compatible fallback selected during implementation.
- Error responses reveal no bucket path, scanner internals or sensitive metadata. Retain rejected/original bytes only for the approved short retention and evidence policy.

## Authoritative nine-image invariant

Attaching media is an API transaction, never a client promise. The attachment API and database both use zero-based positions `0..8`. The transaction locks the Drop row (or uses serializable/advisory locking), verifies ownership/current authorization, verifies every media record is READY, unattached, owned by the same subject and issued for the compatible purpose, rejects duplicate IDs and positions, and calculates existing active attachments + requested attachments ≤ 9. It inserts ordered `drop_media` rows with a unique `(drop_id, position)`, unique active `media_id`, and `CHECK position BETWEEN 0 AND 8`, then commits with the Drop change/outbox event. Concurrent attach/retry therefore cannot exceed nine. A database trigger or equivalent deferred constraint must guard the aggregate invariant because a simple row CHECK cannot count siblings. Contract and persistence tests must include positions `0` and `8`, reject `-1` and `9`, and verify duplicate positions and a tenth attachment fail.

## Retry, deletion and abuse controls

Intent/finalize/attach commands accept scoped idempotency keys whose stored request hash prevents key reuse with different payloads. Deterministic job/variant keys and compare-and-set state transitions make retries harmless. Cleanup removes expired orphan quarantine objects; reconciliation finds DB/object drift. Deleting a Drop hides references immediately, invalidates CDN access where needed, and schedules physical deletion only under retention/legal policy. Rate limits and per-user storage quotas cover intent creation, bytes, decode work and failures. Direct object upload never grants attachment permission; attachment always repeats current authorization.
