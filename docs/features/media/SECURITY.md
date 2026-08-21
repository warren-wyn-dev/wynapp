# Media Security and Privacy

Controls include authentication, CSRF, strict Zod bodies, purpose allowlist, 15 MiB encoded limit, exact completion metadata, MIME sniffing, strict corruption failure, 12k-axis/40 MP decode bounds, metadata stripping, deterministic safe keys, quarantine non-delivery, ownership checks, state transitions and strict upload rate limiting. Never log signed URLs, bytes, EXIF, keys or provider credentials.

Cleanup may delete expired PENDING quarantine, old FAILED artifacts and delayed unreferenced assets only after checking profile and Drop references in the same authoritative operation. Referenced media must not be deleted. Replaced profile media is eligible only after a grace period and a fresh reference check. Malware scanning is an adapter hook and operational prerequisite if threat intelligence requires it; image decoding is not a general malware scanner.
