# WYN V1.0.0 Production Readiness

**Assessment date:** 2026-08-21 UTC (original), re-verified 2026-08-22 UTC
**Branch:** `codex/step-16-production-readiness` (original); re-verification run on `claude/wyn-summary-knf8az` against current `main`
**Scope:** Step 16 verification, plus a full re-run of every command and suite below against current `main` — this time with a real local PostgreSQL 16 instance and `TEST_DATABASE_URL` set, so nothing that can run locally was skipped. Still no staging environment, real secrets, or production-data operation.

## Executive gate

Since the original assessment: CI's long-standing "Exit code: 254" failure was root-caused and fixed (a missing `tsx` workspace dependency), Sentry error tracking was wired into all four apps, an admin logout endpoint was added, a Fastify bug that miscategorized every validation error as an unhandled 500 was fixed, migration tooling that can actually apply migrations to a real database was built, and — most relevant to this gate — every previously-skipped integration and E2E test now actually **runs**: 49/49 integration tests and 33/33 E2E tests pass with **zero skipped**, up from 47 skipped and a single `describe.skip` respectively. The repository builds, static checks pass, and the dependency audit still reports no HIGH or CRITICAL vulnerability.

The release is nevertheless still blocked, for different reasons than before: no staging environment has been provisioned, no load/soak validation exists or has been run, several mandatory adversarial security scenarios remain unexercised (see Security and privacy regression below), and Founder/CTO sign-off has not occurred. The local test suite passing is necessary but not sufficient — it proves the code is correct against a disposable local database, not that the system survives real traffic, real infrastructure failure modes, or a hostile user against real deployed services.

## Command evidence

Re-run 2026-08-22 against current `main`, with a real local PostgreSQL 16 (`TEST_DATABASE_URL=postgresql://wyn_test:wyn_test@127.0.0.1:5432/wyn_test`) and headless Chromium for E2E — this sandbox still has no staging environment, so this remains a local, not staging, run.

| Command                          | Result                      | Evidence                                                                                                                                                                                            |
| -------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install`                   | PASS                        | Lockfile resolved cleanly.                                                                                                                                                                          |
| `pnpm format:check`              | PASS                        | One real formatting violation found and fixed (`apps/mobile/App.tsx`, from the same-day mobile prototype); clean after.                                                                             |
| `pnpm lint`                      | PASS                        | 33/33 Turbo tasks succeeded.                                                                                                                                                                        |
| `pnpm typecheck`                 | PASS                        | 34/34 Turbo tasks succeeded.                                                                                                                                                                        |
| `pnpm test`                      | PASS                        | 33/33 package tasks succeeded.                                                                                                                                                                      |
| `pnpm test:unit`                 | PASS                        | 3 files / 10 tests passed.                                                                                                                                                                          |
| `pnpm test:integration`          | **PASS** — was BLOCKED      | 10 files / **49 tests passed, 0 skipped** (previously 47 skipped for lack of `TEST_DATABASE_URL`).                                                                                                  |
| `pnpm test:e2e`                  | **PASS** — was BLOCKED      | **33 tests passed, 0 skipped** (previously a single `describe.skip`; zero journeys executed).                                                                                                       |
| `pnpm build`                     | PASS                        | 20/20 Turbo tasks succeeded, including Consumer, Admin, API, and Worker.                                                                                                                            |
| `pnpm audit --audit-level high`  | PASS at requested threshold | 0 HIGH/CRITICAL; 9 MODERATE and 2 LOW findings remain (esbuild, fast-xml-parser, uuid, `@opentelemetry/core`, turbo, postcss — all dev/build-time or transitive, none on the runtime request path). |
| `scripts/backup-restore-test.sh` | **PASS** — was BLOCKED      | Ran against the local test database: `pg_dump` → isolated `pg_restore` → schema-integrity check all passed. Proves the mechanism works; still not exercised against a real staging database.        |

## P0 journey gate

Re-verified against the actual current E2E and integration suites rather than assumed. "PASS" below means an automated test genuinely exercises that flow today, not that manual QA has signed off — see each row's notes for what is and isn't covered.

| Journey                                                                 | Required proof                                           | Status                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Register, verify email, login/logout, reset password, revoke sessions   | Browser plus API and persisted-session assertions        | **PASS** — `auth.spec.ts` (register/login/session-persistence/logout), `email-verification.spec.ts` (verify-email link, resend, password reset), `security.spec.ts` (revoked session can't replay).                                                                                                                                                        |
| Profile/privacy update, private follow request, accept/deny, block/mute | Two-user browser/API checks                              | PARTIAL — `social.spec.ts` + `social.integration.test.ts` cover follow/private-request/accept/block/mute thoroughly at the API/DB level. No E2E test drives a profile/privacy-settings _update_ through the UI.                                                                                                                                            |
| Create/edit/delete Drop, media upload, visibility, poll                 | Ownership, malicious-upload, and UI checks               | PARTIAL — `drop.spec.ts` (publish/reject-empty), `media.spec.ts` + `media.test.ts` (upload, MIME-spoof rejection, path-traversal rejection, processing-privacy). No test covers edit, poll creation, or Drop deletion by its owner through the UI.                                                                                                         |
| Following/For You/search/trending                                       | Privacy, block, mute, pagination, and ranking assertions | PARTIAL — `search.spec.ts` + `discovery.integration.test.ts` cover search (incl. SQL-injection resistance and blocked/private/deleted-content exclusion) and feed pagination. Trending ranking itself has no dedicated end-to-end test.                                                                                                                    |
| Like/comment/redrop/quote/save/view                                     | Idempotency, ownership, abuse, and counters              | PASS at the DB/API level — `engagement.integration.test.ts` covers idempotent like/save/redrop, reply/quote ownership, and authorization on private/blocked/deleted content. No dedicated UI-driven E2E test for this journey.                                                                                                                             |
| Notification delivery/preferences and chat                              | Cross-user privacy, realtime, and failure behavior       | PASS core flow — `notifications.spec.ts` (real worker delivery + preferences), `notifications.integration.test.ts` (dedupe, forged-fact rejection, outbox retry), `chat.spec.ts` + `chat.integration.test.ts` (message requests, ownership, blocks).                                                                                                       |
| Club create/join/private access/roles/moderation                        | Nonmember and role-boundary checks                       | PARTIAL — `clubs.spec.ts` covers public/private join and role management end-to-end. Club-specific moderation actions (ban, audit trail) are not separately E2E-tested.                                                                                                                                                                                    |
| Admin report/user/content/club actions and audit trail                  | Every Admin role plus Consumer denial                    | PARTIAL — `admin-api.spec.ts` + `admin-ui.spec.ts` cover Consumer-denial, OWNER triage/warn/step-up, and logout. `admin.integration.test.ts` covers confidential reporting, forged-role rejection, and immutable audit records. Only the OWNER role is exercised end-to-end; other Admin roles (support moderator, content moderator, user admin) are not. |

**Net change from the original assessment:** every row went from fully BLOCKED (zero journeys executed) to at least PARTIAL, with two rows (auth, notifications/chat core flow) now fully PASS. The remaining gaps are specific and enumerable — not "nothing has been tested" — but the P0 gate is not yet fully green.

## Authorization matrix

Every row must be exercised both through the intended client and direct API calls. Database-backed cross-principal coverage now exists for social graph (follow/block/mute), engagement (like/save/redrop/reply/quote), chat, notifications, and admin actions (see integration test list above) — a substantial improvement on the original "entirely skipped" state. It is not yet complete: Admin/Consumer cookie-confusion, cross-role Admin denial (only OWNER is tested end-to-end), and privilege escalation beyond forged-role rejection remain unexercised. The matrix below is not yet fully accepted.

| Resource/action                | Anonymous | Consumer non-owner   | Owner/member      | Club moderator/owner        | Support moderator      | Content moderator               | User admin      | Super admin              |
| ------------------------------ | --------- | -------------------- | ----------------- | --------------------------- | ---------------------- | ------------------------------- | --------------- | ------------------------ |
| Public content read            | Allow     | Allow unless blocked | Allow             | Allow                       | Allow in Admin         | Allow in Admin                  | Metadata only   | Allow                    |
| Private profile/content read   | Deny      | Deny unless approved | Allow             | Deny by club role alone     | Deny                   | Deny except reported scope      | Metadata only   | Break-glass/audited      |
| Drop edit/delete               | Deny      | Deny                 | Allow own         | Club moderation action only | Deny                   | Moderate, not impersonate owner | Deny            | Moderate/audited         |
| Private club read              | Deny      | Deny                 | Member allow      | Allow                       | Report context only    | Report context only             | Deny            | Audited                  |
| Club membership/role change    | Deny      | Request only         | Leave             | Role-limited allow          | Deny                   | Deny                            | Deny            | Audited override         |
| Chat read/send/delete          | Deny      | Participants only    | Participants only | No club-derived access      | Deny                   | Report context only             | Deny            | Break-glass/audited      |
| User suspension/account action | Deny      | Deny                 | Self-service only | Deny                        | Limited support action | Deny                            | Allow by policy | Allow/audited            |
| Admin role/policy change       | Deny      | Deny                 | Deny              | Deny                        | Deny                   | Deny                            | Deny            | Super admin only/audited |

## Security and privacy regression

Real automated coverage now exists for several previously-untested items: CSRF and hostile-Origin rejection, session revocation/replay, one IDOR case (cross-user Drop deletion), SQL-injection resistance in search, MIME-spoofing and path-traversal rejection on upload, blocked/private/deleted-content leak prevention, and forged-role/forged-system-fact rejection (see `security.spec.ts`, `discovery.integration.test.ts`, `media.test.ts`, `notifications.integration.test.ts`, `admin.integration.test.ts`). The codebase also contains CORS allowlisting, CSRF/session separation, rate-limit declarations, generic error responses, request IDs, structured-log redaction, scoped Admin authorization, and upload validation.

The following mandatory adversarial scenarios remain genuinely unexercised, and are still a HIGH release blocker until they are: session fixation (revocation/replay is covered, fixation is not); Admin/Consumer cookie confusion; privilege escalation beyond the one forged-role-rejection case; XSS payload storage/rendering; oversized-upload rejection specifically (malicious _type_ is covered, size limits are not); engagement/realtime/rate-limit abuse under load; account deletion and data-export lifecycle (no test exercises `account_deletion_requests` end-to-end); and sensitive-log-capture verification under real request traffic.

### Club/Global Trending isolation

The discovery unit test asserts every global engagement source uses `GLOBAL_PUBLIC` and excludes `CLUB_INTERNAL`, and `discovery.integration.test.ts` now runs a real seeded check — 100 `CLUB_INTERNAL` engagements are ignored while `GLOBAL_PUBLIC` ones are counted. This is real evidence, up from none, but it is at 100 events, not the ~10,000-event mixed-load scale the original assessment specified. Isolation is implemented and evidenced at small scale; the larger-scale release-verification test has not been run.

## Capacity and performance (~1,000 DAU)

Unchanged since the original assessment: no deployable staging URL, workload credentials, production-like dataset, or metrics backend exists, and no load-testing tooling has been built. Consequently, no concurrency, soak, queue-backlog, connection-pool, ranking-worker, chat, upload, or p95/p99 validation has been executed. Before approval, run a staged workload representing peak rather than average DAU, publish request/error/latency percentiles, database saturation and slow queries, worker lag, and recovery after load. Acceptance targets require Founder/CTO confirmation; this reassessment does not invent them. (`docs/release/WYN_V1_STAGING_DEPLOYMENT_RUNBOOK.md` Section 7 flags this as the next concrete gap to close, pending a tool choice such as k6 or Artillery.)

## PostgreSQL migrations and recovery

- Migrations `0001` through `0011` are present and build/typecheck successfully (`0011` was added since the original assessment).
- Fresh migration validation is **no longer blocked**: `migrate-deploy.integration.test.ts` runs against a real local PostgreSQL and passed — applies all 11 on a fresh database, no-ops on redeploy, and re-applies only a deliberately-removed ledger entry. All other real-PostgreSQL integration tests ran as well (49/49 passed, 0 skipped).
- There was previously no operator-facing way to apply migrations to a real (non-test) database at all — `migrate()` was test/E2E-only and `drizzle-kit migrate` is non-functional. This is now closed: `deployMigrations()` (`packages/database/src/migrate.ts`) tracks applied migrations in a `schema_migrations` ledger and only runs what's new, each in its own transaction. `scripts/migrate-deploy.ts` (`pnpm db:migrate:deploy -- --yes`) is the CLI wrapper.
- `scripts/backup-restore-test.sh` **ran successfully** against the local test database this reassessment (see Command evidence). It is still only proven against a local database, not a real staging one — the mechanism now has evidence, but "PASS locally" and "PASS in staging" are not the same claim.
- Media/object-storage versioning, retention, restore, and referential reconciliation remain to be demonstrated in staging — unchanged.

## Environment, secrets, flags, and production safety

`pnpm readiness:env` validates required configuration without printing values, requires HTTPS-separated Consumer/Admin/API origins, enforces a minimum session-secret length, validates PostgreSQL URL shape, and rejects malformed feature flags. Re-run with no environment set this reassessment: it correctly fails closed, listing every missing required variable (`WYN_ENV`, `DATABASE_URL`, `APP_ORIGIN`, `ADMIN_ORIGIN`, `API_ORIGIN`, `SESSION_SECRET`, storage/email/observability variables, and origin isolation) — unchanged behavior from the original assessment. No real staging/production values have been supplied.

Flags are required to use explicit `true`/`false` values for Clubs, Chat, Notifications, and Admin Moderation. Rollout defaults and emergency disable behavior must be exercised in staging. Secrets must be injected by the deployment platform, scoped least-privilege, rotated before launch, and absent from images, client bundles, logs, CI artifacts, and Git. Production must additionally verify secure/HTTP-only/SameSite cookies, TLS, exact CORS origins, Admin `noindex`, disabled test endpoints, non-development email/storage adapters, database guards, rate limits, and generic errors.

## Observability gate

Since the original assessment, Sentry error capture is now actually wired into all four apps: `@sentry/node` in API and Worker (gated by `OBSERVABILITY_DSN`, soft-fallback if unset), `@sentry/nextjs` in Web and Admin (client, server, and edge runtimes, plus root-layout error boundaries). Health/readiness routes, request IDs, structured logging, redaction utilities, and Worker graceful shutdown still exist as before.

Runtime verification in a real environment remains blocked: no DSN has been pointed at a real Sentry project, so actual event delivery, alert routing, and dashboards are still unobserved — the code path exists but has not fired against production infrastructure. Database/queue metrics, worker dead-letter/failure visibility, audit-log access, log retention, PII/token redaction under real requests, trace correlation, and on-call notification also remain unobserved outside this local environment. `/ready` still defaults to success unless a dependency-aware callback is configured — this must prove dependency health before launch, not just before this local run.

## Legal/privacy technical readiness

Before approval, staging evidence must demonstrate data minimization, consent/cookie behavior where applicable, privacy defaults, account deletion and retention, export/access workflows required by policy, block/mute enforcement across derived surfaces, notification/email unsubscribe behavior, upload rights/report flow, Admin audit access/retention, subprocessors/data-region inventory, and privacy/contact/legal-document links. Legal sufficiency is a Founder/counsel decision; this technical review does not provide legal approval. Unchanged since the original assessment — account deletion/export specifically still has no automated test (see Security and privacy regression above).

## Incident and rollback runbook

1. **Detect and declare:** on-call acknowledges the alert, opens an incident channel/timeline, assigns incident commander and communications lead, records release SHA/flag state, and avoids secrets or private user data.
2. **Contain:** stop rollout; disable the affected feature via an approved flag when safer than rollback; revoke compromised sessions/credentials when indicated; preserve audit evidence.
3. **Rollback application:** redeploy the last known-good immutable Consumer, Admin, API, and Worker artifacts together; verify schema compatibility first. Never reverse a destructive migration during an incident.
4. **Database recovery:** prefer a forward fix. If recovery is required, isolate writes, obtain Founder approval for destructive production action, restore to a new database from the verified backup/PITR point, run integrity checks, then perform a controlled cutover with an explicit abort point.
5. **Validate:** check health and dependency readiness, authentication, a read and write journey, Worker lag, error/latency dashboards, audit logging, and Admin/Consumer isolation. Roll back the flag/config change if validation fails.
6. **Communicate and learn:** provide status without private data, record impact and recovery point/time, retain evidence, complete a blameless post-incident review, and track corrective actions.

Required pre-launch proof: named on-call owner/escalation path, monitoring links, immutable prior artifacts, feature-flag operator permissions, database PITR/backup retention, tested restore timing, DNS/config rollback ownership, status-page/customer-support path, and a completed staging rollback drill. `docs/release/WYN_V1_STAGING_DEPLOYMENT_RUNBOOK.md` (new since the original assessment) is the step-by-step procedure for actually standing up staging and producing this evidence.

## Staging readiness checklist

- [ ] Isolated production-like staging domains, database, object storage, email sandbox, push, and realtime services
- [ ] Secret-safe `pnpm readiness:env` passes and flag on/off behavior is recorded
- [x] Fresh migrations plus all integration tests execute with zero skipped — **done locally** (49/49, 2026-08-22); not yet re-run against a real staging database
- [x] All P0 Consumer/Admin E2E journeys execute with zero skipped — **done locally** (33/33, 2026-08-22); coverage breadth per journey is still partial, see P0 journey gate table above
- [ ] Authorization, security, privacy, and 10,000-event ranking isolation regressions pass — partial coverage now exists (see Security and privacy regression); several scenarios and the full 10,000-event scale remain
- [ ] ~1,000 DAU target load/soak report passes approved SLOs and cost review
- [x] Database backup/restore drill passes — **done locally** (2026-08-22); application/flag rollback drills and a real-staging backup/restore run still needed
- [ ] Logs, metrics, traces, alerts, audit records, redaction, and on-call delivery are observed — Sentry is now wired in code; real delivery against a live project is unobserved
- [ ] QA/Security records zero unresolved CRITICAL/HIGH findings; moderate dependencies are dispositioned
- [ ] CTO final review completes; Founder production approval is separately recorded

## Findings

### CRITICAL

None confirmed, then or now.

### HIGH — release blockers

1. ~~Database integration suite reports 47 skipped tests~~ — **resolved 2026-08-22**: 49/49 pass, 0 skipped, against a real local PostgreSQL.
2. ~~E2E suite reports its sole test skipped~~ — **resolved 2026-08-22**: 33/33 pass, 0 skipped, covering every P0 journey area at least partially.
3. Staging configuration/services are still absent, blocking load, full observability delivery, and rollback-drill verification in a real environment. (Security/privacy and ranking-isolation verification has meaningfully progressed — see above — but is not complete.)
4. ~~Database/media backup and restore were not executed~~ — **partially resolved 2026-08-22**: the database backup/restore script now runs and passes locally; media/object-storage backup/restore, and any real-staging run of either, remain undemonstrated.
5. _(New)_ Several specific adversarial security scenarios remain unexercised even locally: session fixation, Admin/Consumer cookie confusion, privilege escalation beyond one forged-role case, XSS payload handling, oversized-upload rejection, and account deletion/export lifecycle. Listed explicitly (not just "security tests are skipped") because most _are_ now covered — these are the specific remaining gaps.
6. No load/soak testing tooling exists yet; capacity at ~1,000 DAU remains completely unvalidated.

### MEDIUM

1. Dependency audit contains nine MODERATE findings requiring owner disposition before approval (up from seven at the original assessment, all in dev/build-time or transitive packages — see Command evidence).
2. pnpm ignored a dependency build script (`@sentry/cli`, needed only for source-map upload, which is explicitly disabled); the final deployment image must still prove native dependencies and approved lifecycle-script policy work.
3. API readiness (`/ready`) still defaults to success unless a dependency-aware callback is configured.

## Required path to approval

Provision an isolated production-like staging environment; execute every unchecked staging item with captured secret-safe evidence (including re-running the now-passing local suites against staging, not just locally); close the specific remaining security gaps listed under HIGH finding 5; build and run load/soak validation; resolve/disposition all findings; complete QA/Security and CTO final review; then present the evidence to the Founder. Production deployment remains a separate, explicitly approved action.

**NOT READY FOR PRODUCTION** — closer than the original assessment (the entire local-verification gate that was previously impossible to clear is now clear), but staging has not been stood up and several concrete, enumerable gaps remain above.
