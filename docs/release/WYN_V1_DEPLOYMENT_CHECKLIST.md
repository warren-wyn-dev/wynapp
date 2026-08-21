# WYN V1.0.0 Deployment Checklist

**Purpose:** an exact, code-verified list of what each deployable process
needs to actually run — not a provider recommendation (see
[`docs/tech/DEPLOYMENT_STACK.md`](../tech/DEPLOYMENT_STACK.md) for that) and
not a substitute for the release gates in
[`AGENTS.md`](../../AGENTS.md#release-gates). Every variable below was
confirmed by reading the code that consumes it, not by copying an existing
list — several existing references (`.env.example`,
`scripts/verify-production-env.mjs`) were themselves found to be incomplete
or to name variables nothing reads; those gaps are called out explicitly
below.

This document does not authorize a deployment. Production deployment,
cloud-provider selection, and infrastructure cost commitments all require
explicit Founder approval per `AGENTS.md`.

## How to use this

1. Work through **Section 1** to provision the pieces each process needs.
2. Set the env vars in **Section 2** for each deployment target.
3. Run `pnpm readiness:env` (wraps `scripts/verify-production-env.mjs`)
   against the target environment before deploying it — it fails closed on
   missing/insecure values and never prints secret values.
4. Read **Section 3** before telling anyone this is ready for real users —
   these are launch-blocking even once every env var is set.

---

## 1. What to provision

| Piece                                                                                                                                                          | Used by                                               | Notes                                                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PostgreSQL 16 database                                                                                                                                         | API, Worker                                           | Managed instance with TLS and backups. Run `pnpm --filter @wyn/database exec drizzle-kit` migrations (`packages/database/migrations/0001`–`0011`) against it before first boot.                                              |
| S3-compatible object storage: **two buckets** (quarantine + processed)                                                                                         | API, Worker                                           | Cloudflare R2 primary, AWS S3 fallback per the tech stack doc. Quarantine bucket holds unprocessed uploads; processed bucket is what the CDN serves publicly — keep them separate, matching `packages/media/src/storage.ts`. |
| CDN in front of the processed bucket                                                                                                                           | API (constructs URLs), browsers (fetch them directly) | The public origin browsers load images from.                                                                                                                                                                                 |
| Resend account with a verified sending domain                                                                                                                  | API                                                   | Wired via `RESEND_API_KEY`/`EMAIL_FROM` (see below). Sends are rejected if `EMAIL_FROM`'s domain isn't verified in Resend.                                                                                                   |
| Sentry project (or any DSN-compatible ingest)                                                                                                                  | API, Worker                                           | Wired via `OBSERVABILITY_DSN` (see below). Web/Admin have no client-side error tracking yet — see Section 3.                                                                                                                 |
| Hosting: Consumer Web + Admin Web (separate Vercel projects), API + Worker (persistent Node runtime, not serverless — the worker is a long-lived polling loop) | —                                                     | Per `docs/tech/DEPLOYMENT_STACK.md`.                                                                                                                                                                                         |

## 2. Environment variables by process

Only variables the code actually reads are listed as "required" — this
list was built by grepping the real `zod` config schemas in
`apps/api/src/server.ts` and `apps/worker/src/main.ts`, not by guessing.

### `apps/api` (consumer + admin API)

| Variable                                                            | Required                          | Example                                      | Notes                                                                                                                                                                                                                |
| ------------------------------------------------------------------- | --------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WYN_ENV`                                                           | recommended                       | `production`                                 | Defaults to `development`. Gates two things: email adapter selection, and whether `AUTH_RATE_LIMIT_MAX` can override the real rate limit (it's silently ignored when `WYN_ENV=production`, by design).               |
| `DATABASE_URL`                                                      | **yes**                           | `postgresql://user:pass@host:5432/wyn`       |                                                                                                                                                                                                                      |
| `API_HOST`                                                          | no                                | `0.0.0.0`                                    | Defaults to `127.0.0.1`; you almost certainly need `0.0.0.0` behind a real load balancer/container runtime.                                                                                                          |
| `API_PORT`                                                          | no                                | `4000`                                       |                                                                                                                                                                                                                      |
| `APP_ORIGIN`                                                        | **yes**                           | `https://wyn.example`                        | Consumer web origin. Used for CORS, and the CSRF check compares it against the request `Origin` header — must exactly match what the Consumer Web app is actually served from.                                       |
| `ADMIN_ORIGIN`                                                      | **yes**                           | `https://admin.wyn.example`                  | Same, for the Admin app/session realm. Must differ from `APP_ORIGIN` — the API refuses same-origin Consumer/Admin setups (`consumer, admin, and API origins must be isolated`, enforced by the readiness script).    |
| `OBJECT_STORAGE_REGION`                                             | for media                         | `auto` (R2) / `us-east-1` (S3)               |                                                                                                                                                                                                                      |
| `OBJECT_STORAGE_ENDPOINT`                                           | for media, provider-dependent     | `https://<account>.r2.cloudflarestorage.com` | Omit entirely for real AWS S3 (SDK default routing). Required for R2/any non-AWS S3-compatible provider.                                                                                                             |
| `OBJECT_STORAGE_FORCE_PATH_STYLE`                                   | for media, provider-dependent     | `true`                                       | Set for R2/most non-AWS providers; omit for AWS S3.                                                                                                                                                                  |
| `OBJECT_STORAGE_QUARANTINE_BUCKET`                                  | for media                         | `wyn-quarantine`                             |                                                                                                                                                                                                                      |
| `OBJECT_STORAGE_BUCKET`                                             | for media                         | `wyn-processed`                              | This is the **processed/public** bucket, despite the generic name (kept for compatibility with the existing readiness-script variable name).                                                                         |
| `OBJECT_STORAGE_CDN_ORIGIN`                                         | for media                         | `https://media.wyn.example`                  | Public URL prefix the API writes into `profiles.avatar_url`/`cover_url` and computes for Drop image URLs.                                                                                                            |
| `OBJECT_STORAGE_ACCESS_KEY_ID` / `OBJECT_STORAGE_SECRET_ACCESS_KEY` | for media, provider-dependent     | —                                            | Omit if using an IAM role/instance profile instead of static keys.                                                                                                                                                   |
| `AUTH_RATE_LIMIT_MAX`                                               | **do not set in production**      | —                                            | Only for non-production load/E2E runs that need more than 10 logins/minute from one IP. Ignored outright when `WYN_ENV=production`.                                                                                  |
| `RESEND_API_KEY`                                                    | **yes when `WYN_ENV=production`** | `re_...`                                     | The API refuses to start in production without this and `EMAIL_FROM` both set — fails fast at boot, not on the first user's registration request.                                                                    |
| `EMAIL_FROM`                                                        | **yes when `WYN_ENV=production`** | `no-reply@wyn.example`                       | Must be an address on a domain verified in Resend.                                                                                                                                                                   |
| `OBSERVABILITY_DSN`                                                 | recommended                       | `https://<key>@o0.ingest.sentry.io/0`        | Unlike `RESEND_API_KEY`, missing this is a soft fallback (no error reporting), not a startup failure — it degrades observability, not user-facing behavior. 500-level errors are reported; 400s (bad input) are not. |

Without every `OBJECT_STORAGE_*` variable present, media routes respond
`503 MEDIA_UNAVAILABLE` — this is the existing, deliberate fallback
behavior, not a crash.

### `apps/worker` (background jobs)

| Variable                     | Required             | Notes                                                                                                                                                                                                                                                             |
| ---------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WORKER_ID`                  | no                   | Defaults to `local-worker`; set something identifying per-instance if you run more than one.                                                                                                                                                                      |
| `DATABASE_URL`               | **yes**              | Same database as the API.                                                                                                                                                                                                                                         |
| `WORKER_HEALTH_PORT`         | no                   | Defaults to `4100`. Exposes `GET /health` — point your platform's liveness probe at it.                                                                                                                                                                           |
| `WORKER_POLL_INTERVAL_MS`    | no                   | Defaults to `1000`. How often it polls when idle.                                                                                                                                                                                                                 |
| `OBSERVABILITY_DSN`          | recommended          | Same soft-fallback behavior as the API. Reports every failed dispatch-loop iteration (a bad claim, a transient DB error) — the loop already logs and retries on its own either way, so this only adds visibility, not resilience.                                 |
| All `OBJECT_STORAGE_*` above | for media processing | **Same values as the API.** If the worker's storage config is missing while the API's isn't, uploads will accept but never leave status `UPLOADED` (nothing processes them) — the worker logs a startup warning (`media processing is disabled`) if this happens. |

The worker runs two independent polling loops (notifications, media) in
one process and must stay running continuously — it is not a cron job or
a one-shot script.

### `apps/web` (Consumer)

| Variable     | Required | Notes                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `API_ORIGIN` | **yes**  | Server-side only (not `NEXT_PUBLIC_*`) — used by `next.config.ts`'s `rewrites()` to proxy `/v1/*` to the API same-origin. This is load-bearing: the API's session/CSRF cookies are `__Host-` prefixed and same-origin only, so the browser must always talk to `/v1/*` on the Web app's own origin, never directly to the API's origin. Set this on whatever platform runs `next start` (e.g. as a Vercel environment variable). |
| `PORT`       | no       | Defaults to Next.js's own default (3000).                                                                                                                                                                                                                                                                                                                                                                                        |

### `apps/admin`

| Variable     | Required | Notes                                                                                                                                         |
| ------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `API_ORIGIN` | **yes**  | Same rationale as `apps/web`'s `API_ORIGIN` — `next.config.ts` proxies `/admin/v1/*` same-origin so the `__Host-` admin session cookie works. |
| `PORT`       | no       | The `start` script hardcodes `-p 3001`; override the script (not this var) to change it.                                                      |

Covers login, the report queue, case triage, and moderation actions
(including step-up). Users/Content/Clubs/Analytics/Settings are still
placeholders — see Section 3.

## 3. Known gaps — launch-blocking even with every variable above set

These are things the code does not do today, found while wiring the rest
of this together. None of them are "missing configuration"; they need
actual implementation or a product decision, not just an env var.

- **The Admin app only covers moderation.** Login, logout, the report
  queue, case triage, and moderation actions (with step-up re-auth) are
  implemented and covered by a real browser E2E test
  (`tests/e2e/admin-ui.spec.ts`), not just the API-level
  `tests/e2e/admin-api.spec.ts`. Users/Content/Clubs/Analytics/Settings
  are still static placeholders — there is no backend API for them yet,
  so there was nothing to build a UI against. That's a real gap, but it
  doesn't block the moderation workflow itself.
- **Web and Admin have no client-side error tracking.** `OBSERVABILITY_DSN`
  wires server-side reporting (unhandled 500s in the API, failed
  dispatch-loop iterations in the Worker) via `packages/observability`'s
  `createSentryErrorCapture`, but nothing in `apps/web` or `apps/admin`
  reports a browser-side exception anywhere — a React render error or an
  unhandled client-side rejection is invisible today. Would need the
  Sentry browser SDK wired into both Next.js apps, a separate piece of
  work from this.
- **`SESSION_SECRET` and the `FEATURE_*_ENABLED` flags in
  `scripts/verify-production-env.mjs`'s required list are not read by any
  application code.** Sessions are opaque random tokens stored
  server-side (hashed) in Postgres, not signed with a shared secret, so
  there is nothing for `SESSION_SECRET` to configure today. The feature
  flags aren't wired to any conditional either. Keep requiring them in the
  readiness script if a signing secret or flag system is added later;
  otherwise treat their current "required" status as a placeholder from
  an earlier design, not a real blocker to fix by hunting for a value.
- **No deployment has ever been attempted**, so nothing above has been
  validated outside this local/CI-only environment. Budget for a real
  staging pass — including the `pnpm readiness:backup-restore` drill
  against the actual managed database and object storage, not just the
  disposable local Postgres it currently targets — before pointing a real
  domain at any of this. (Even the CI-only environment wasn't reliable
  until recently: the `verify` GitHub Actions job's E2E step was failing
  on every push — `tsx` was only a devDependency of `apps/api`/
  `apps/worker`, not the workspace root, so a clean `pnpm install
--frozen-lockfile` couldn't resolve it for
  `playwright.config.ts`'s mock-S3 webServer entry. Fixed; the `verify`
  job is green as of this writing.)

## 4. Suggested order

1. Provision the database; run migrations 0001–0011.
2. Provision the two object-storage buckets + CDN; provision email +
   observability providers.
3. Deploy the API + Worker to a persistent runtime with the variables
   above; confirm `GET /health` on both.
4. Deploy Consumer Web with `API_ORIGIN` pointed at the API's real origin;
   confirm `/v1/auth/register` works end to end through the browser (not
   just via `curl`), and that a session cookie is actually set — the
   `__Host-` cookie requirements make this worth confirming with a real
   browser, not just an API client.
5. Run `pnpm readiness:env` against the real environment variables (copy
   them into a shell that never gets committed anywhere) and resolve every
   reported error.
6. Only then take Section 3's gaps to the Founder/CTO for a scope
   decision — ship without them, or block launch until they're closed.
