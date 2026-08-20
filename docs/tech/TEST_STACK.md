# Testing and Security Verification Stack

**Status:** ACCEPTED

Use **Vitest** for TypeScript unit/component tests and API application tests, a disposable real PostgreSQL database for repository/transaction/outbox integration tests, and **Playwright** for independent Consumer and Admin browser suites. Mock only external providers at stable adapters; do not use SQLite as a PostgreSQL substitute. Run migration-up/down safety checks only when migrations are later authorized.

Required suites include:

- table-driven authorization negatives for cross-user read/edit/delete, private resources, block/mute, Club roles, moderation state and Consumer/Admin realm crossing;
- HTTP contract, validation, CSRF/CORS, idempotency, pagination, concurrency and rate-limit tests;
- transaction rollback, unique/foreign/check constraints, outbox at-least-once/idempotency/dead-letter and search eligibility tests;
- upload signature, type spoofing, decompression/image bombs, EXIF removal and quarantine non-disclosure;
- Consumer registration/feed/Drop/privacy/chat/report flows and separate Admin moderation/audit/least-privilege flows;
- security regressions for enumeration, session fixation/replay/revocation, recovery races, SSR cache leaks, direct API bypass, engagement manipulation and malicious links.

PR gates run lint, strict typecheck, unit, integration, both builds, dependency audit/OSV-equivalent scan, CodeQL/SAST, secret scan and focused Playwright smoke tests; broader E2E and restore/load tests run on staging/nightly. Flaky tests are quarantined only with owner/expiry and never silently retried into green for security gates. Any CRITICAL security finding blocks release.
