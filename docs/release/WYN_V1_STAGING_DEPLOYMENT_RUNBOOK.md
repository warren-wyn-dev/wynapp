# WYN V1.0.0 Staging Deployment Runbook

**Status:** draft — has not been executed. Nothing in this document
authorizes production deployment; see the gate at the bottom of this file
and [`AGENTS.md`](../../AGENTS.md#release-gates).

**Relationship to other docs:** [`WYN_V1_DEPLOYMENT_CHECKLIST.md`](./WYN_V1_DEPLOYMENT_CHECKLIST.md)
is the reference for exactly which env var goes on which process and why.
This document is the reference for the order of operations to actually
stand up a staging environment and prove it works, ending with the
checklist [`WYN_V1_PRODUCTION_READINESS.md`](./WYN_V1_PRODUCTION_READINESS.md)
requires before a Founder can approve production. Read the checklist
alongside this — this file assumes it, rather than repeating every
variable's rationale.

---

## 0. Blocker to resolve before Step 1

**There is currently no safe, operator-facing way to apply the 11 SQL
migrations to a real (non-test) database.** Two things exist, and neither
covers it:

- `packages/database/src/migrate.ts`'s `migrate(url)` runs the 11 files in
  `packages/database/migrations/*.sql` in order — but it's only ever
  called from test/E2E setup code, with no CLI entry point exposed for
  running it against an arbitrary target. A sibling function,
  `assertTestDatabase()`, refuses non-test-shaped URLs, but callers have
  to invoke it themselves — `migrate()` itself has no built-in guard.
- `drizzle-kit migrate` (the `db:migrate` script in
  `packages/database/package.json`) is wired to `src/schema.ts`, which is
  an intentionally empty placeholder (`export {}`) — there is no Drizzle
  schema for it to diff, and no `migrations/meta/_journal.json`, so it has
  never actually applied these hand-written SQL files and isn't
  positioned to.

Before Step 1 can run for real, someone needs to add a small script (e.g.
`packages/database/scripts/migrate-deploy.mjs` or similar) that calls
`migrate(process.env.DATABASE_URL)` directly against whatever URL is
passed in, with its own explicit confirmation step (not
`assertTestDatabase`, which is designed to refuse exactly this). This is a
short, well-scoped piece of work — flag it back if you want it built next,
rather than treating "run migrations 0001–0011" below as something you can
already do.

---

## 1. Prerequisites

Confirm all of these before starting. Do not provision anything until
they're true.

- [ ] `main` is green: `pnpm lint && pnpm typecheck && pnpm test && pnpm run test:integration && pnpm build && pnpm audit --audit-level high` all pass locally or in CI on the commit you intend to deploy.
- [ ] The migration blocker in Section 0 is resolved.
- [ ] You (Founder) have decided on providers per [`DEPLOYMENT_STACK.md`](../tech/DEPLOYMENT_STACK.md)'s preferred topology, or an explicit deviation from it.
- [ ] A place to put staging secrets exists that is not this chat, not a committed file, and not `.env.example` — your hosting platform's own secret store.
- [ ] You've read [`WYN_V1_DEPLOYMENT_CHECKLIST.md`](./WYN_V1_DEPLOYMENT_CHECKLIST.md) Section 3 (known gaps) and are deploying with those accepted, not surprised by them later.

---

## 2. Provision infrastructure

Do these in this order — each later step's config depends on the
previous one's output (a real hostname/URL/key), not a placeholder.

1. **Database.** Managed PostgreSQL 16, TLS required, automated backups
   and point-in-time recovery enabled if the provider supports it. Do
   not reuse the production database or its credentials for staging —
   `WYN_V1_PRODUCTION_READINESS.md` requires full isolation.
2. **Object storage.** Two buckets: one for unprocessed uploads
   ("quarantine"), one for the CDN-served processed output. Cloudflare
   R2 is the documented primary choice; AWS S3 is the fallback (see
   `packages/media/src/storage.ts` for what the code actually expects —
   S3-compatible, region + endpoint + path-style config).
3. **CDN** in front of the processed bucket only (never the quarantine
   bucket — nothing in it has been validated yet).
4. **Resend account**, verified sending domain. `EMAIL_FROM` must be an
   address on that domain or sends are rejected outright.
5. **Sentry project.** One DSN is enough to start; the checklist allows
   using the same one for API/Worker (`OBSERVABILITY_DSN`) and Web/Admin
   (`NEXT_PUBLIC_SENTRY_DSN`/`SENTRY_DSN`), or splitting them later.
6. **Hosting**, four separate deployables:
   - Consumer Web (`apps/web`) — Vercel-style static/edge hosting is fine, it's pure Next.js.
   - Admin Web (`apps/admin`) — separate project from Consumer Web. Do not host both under one project/origin — the `__Host-` session cookies and CORS checks are origin-locked by design, and sharing an origin defeats the Consumer/Admin realm separation.
   - API (`apps/api`) — persistent Node runtime, not serverless functions. It's a long-lived Fastify process; `apps/api`'s own `build` script produces `dist/server.js` via esbuild, and `start` runs `node dist/server.js`.
   - Worker (`apps/worker`) — same requirement, persistent runtime, no public ingress needed (it exposes only `GET /health` for a liveness probe). This is a polling loop, not a cron job — it must stay running continuously, and restarting it is safe (it resumes where the outbox queue leaves off) but stopping it for any length of time means notifications and media processing silently stall, not that anything wrong.

At the end of this step, write down every real hostname/URL/key you
generated — you need them for Section 3, and they should never appear in
this repo or in this chat.

---

## 3. Configure environment variables

Set the variables listed for each process in
[`WYN_V1_DEPLOYMENT_CHECKLIST.md`](./WYN_V1_DEPLOYMENT_CHECKLIST.md)
Section 2, using the real values from Section 2 above. Two things worth
restating because getting them wrong fails silently or confusingly:

- `APP_ORIGIN`, `ADMIN_ORIGIN`, and the API's own origin must be three
  genuinely distinct hostnames. The API refuses to start if any two
  collide (`consumer, admin, and API origins must be isolated`).
- `WYN_ENV=staging` (or `production`) on the API and Worker — this is
  what gates the Resend/Sentry "fail fast at boot vs. soft-fallback"
  behavior described in the checklist, and it's what
  `scripts/verify-production-env.mjs` checks for.

Run the readiness check against the real values before deploying
anything:

```bash
WYN_ENV=staging \
DATABASE_URL=... APP_ORIGIN=... ADMIN_ORIGIN=... API_ORIGIN=... \
SESSION_SECRET=... OBJECT_STORAGE_BUCKET=... OBJECT_STORAGE_QUARANTINE_BUCKET=... \
OBJECT_STORAGE_REGION=... OBJECT_STORAGE_CDN_ORIGIN=... EMAIL_FROM=... \
OBSERVABILITY_DSN=... \
pnpm readiness:env
```

It fails closed and never prints the values back, so it's safe to run in
a shell that has the real secrets exported. `SESSION_SECRET` and the
`FEATURE_*_ENABLED` flags are required by this script but read by no
application code today (see the deployment checklist's Section 3) — set
them to satisfy the check, but don't spend time hunting for a "correct"
value; any 32+ character string and `true`/`false` values are fine.

---

## 4. Apply migrations

Blocked on Section 0. Once the migration script exists:

```bash
DATABASE_URL=<staging DB> node packages/database/scripts/migrate-deploy.mjs
```

(or whatever the actual script ends up being called). Confirm all 11
migrations applied by checking a table each one introduces exists — e.g.
`admin_principals` (0010) and the `CLUB_AVATAR`/`CLUB_COVER` enum values
on `media_purpose` (0011) are the last two and easiest to spot-check.

---

## 5. Deploy

Order matters: the API and Worker need the database migrated first; Web
and Admin need the API's real origin to route their rewrites to.

1. Deploy API + Worker with the Section 3 variables. Confirm:
   - `GET /health` returns `{"status":"ok"}` on both (Worker's is on
     `WORKER_HEALTH_PORT`, default 4100; it does not share the API's
     port).
   - `GET /ready` on the API returns healthy — this endpoint just
     reflects a configured readiness callback today (it doesn't
     independently prove the database is reachable), so don't treat a
     green `/ready` alone as proof the DB connection actually works;
     confirm with a real request in step 3 instead.
2. Deploy Consumer Web with `API_ORIGIN` pointed at the API's real
   origin.
3. Deploy Admin Web the same way, with its own `API_ORIGIN` (same API,
   the app is what's different).
4. Through a real browser (not curl — the point is proving the
   `__Host-` cookie chain actually works over the real origins):
   - Register a real staging account on Consumer Web. Confirm the
     verify-email link (sent via the real Resend account you configured)
     lands and `/verify-email?token=...` actually verifies it.
   - Log in, confirm the session persists across a page reload and a
     new tab.
   - Log in to Admin Web with a seeded admin principal (you'll need to
     insert one directly — there is no self-service admin signup by
     design; see how `tests/e2e/global-setup.ts` seeds
     `admin_principals` for the exact shape).
   - Trigger the step-up flow once (any `moderation.*` action) to
     confirm password re-verification works against the real session
     store, not just in tests.
5. Confirm Sentry is actually receiving events: throw a deliberate test
   error (e.g. hit a route that doesn't exist and check whether the
   404 path is excluded as expected — it should **not** appear in
   Sentry, since that's not a bug; then force a genuine 500 and confirm
   it **does**).

---

## 6. Backup/restore drill

Required before this counts as a validated staging pass, per
`WYN_V1_PRODUCTION_READINESS.md`'s staging checklist.

```bash
DATABASE_URL=<staging DB, never production> WYN_ENV=staging \
pnpm readiness:backup-restore
```

Read `scripts/backup-restore-test.sh` before running it — it refuses to
run against anything with `prod`/`production` in the URL or
`WYN_ENV` outside `test`/`staging` as a safety check, but "refuses to run
against production" is not the same guarantee as "safe to run
unattended" — it does a real `pg_dump`/`pg_restore` cycle against the
target and creates/drops a temporary database, so run it against the
actual staging database only once you're comfortable with that.

---

## 7. Load/soak validation

`WYN_V1_PRODUCTION_READINESS.md` calls for validating capacity at
~1,000 DAU before production approval: request/error/latency
percentiles, database saturation, worker lag under backlog, and recovery
after load. No tooling for this exists in the repo yet — this needs a
follow-up decision on what tool to use (k6, Artillery, etc.) and what
"peak" load looks like for 1,000 DAU, which is a product/ops call, not
something to invent here. Flag this back if you want a load-test harness
built next.

---

## 8. Sign-off before taking this to the Founder for production approval

This is the staging exit gate — not a production launch gate. All of
these should be true, with evidence (screenshots, dashboard links, log
excerpts), before asking for the separate, explicit production approval
`AGENTS.md` requires:

- [ ] Every checkbox in Section 1 (prerequisites) and this document's
      Sections 2–7 is complete
- [ ] `WYN_V1_PRODUCTION_READINESS.md`'s "Staging readiness checklist"
      section is fully checked, with its stale findings (dated before
      this session's fixes — it predates the working E2E suite, Resend,
      admin logout, and Sentry wiring landing) re-verified against the
      current `main`, not assumed still true
- [ ] No unresolved CRITICAL or HIGH finding from QA/Security
- [ ] A named on-call owner and escalation path exist for the staging
      window, per the incident/rollback runbook in
      `WYN_V1_PRODUCTION_READINESS.md`

Production deployment itself is a separate, later, explicitly-approved
action — this runbook stops at staging.
