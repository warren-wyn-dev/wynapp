# Deployment and CI/CD Stack

**Status:** ACCEPTED — platform direction only. No infrastructure creation or deployment is authorized by this document; production always requires explicit Founder approval.

## Preferred V1 topology

- **Consumer Web:** its own Vercel project and deployment.
- **Admin Web:** a different Vercel project, origin, environment, secrets, artifact, and session realm.
- **API:** a managed container or persistent Node runtime that supports long-lived HTTP and WebSocket connections, health checks, graceful draining, regional placement, and independent scaling.
- **Worker:** a separately scalable managed container/runtime process with no public ingress and reliable long-running job behavior.
- **Database:** managed PostgreSQL with TLS, backups, point-in-time recovery where available, restore testing, monitoring, and connection pooling.
- **Media:** Cloudflare R2 plus CDN; AWS S3 is the documented fallback.
- **Redis:** managed Redis-compatible service such as Upstash only if measurements justify it.

Do not force the API, WebSockets, or worker onto short-lived serverless functions when persistent behavior would be unreliable. Select the exact backend and PostgreSQL providers only through an operational evaluation covering region/Thailand latency, WebSocket and worker behavior, backups, security controls, observability, support, portability, and approved cost.

## GitHub Actions and release gates

CI uses frozen pnpm installs, least-privilege credentials, pinned actions, dependency caching without secrets, and protected environments. Required order is **install → lint → typecheck → unit tests → integration tests → build → security/dependency checks**. Security checks include Dependabot, secret scanning, dependency review where available, and `pnpm audit` as supporting—not sole—evidence.

Build one immutable, identifiable artifact per deployable. Staging validates health, smoke flows, WebSocket drain/reconnect, worker shutdown/retry, database compatibility, monitoring, backup/restore, and rollback. Production is a separate protected action requiring explicit Founder approval for the exact staged release; retain the previous artifact and a tested rollback path. Migrations require their own later authorization and expand/contract plan.

Keep development, staging, and production projects, databases, storage, credentials, telemetry, and hostnames isolated. Public ingress reaches only intended web/API/realtime endpoints; workers, databases, secret stores, and administrative storage interfaces remain private or tightly access-controlled.
