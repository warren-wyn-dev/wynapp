# Deployment and CI/CD Stack

**Status:** PROPOSED — no infrastructure, account, environment or deployment is authorized.

## V1 topology

- Cloudflare DNS/CDN/WAF and R2 for processed media near Thai users.
- AWS `ap-southeast-1` (Singapore): two separate Next.js services, Fastify API/WebSocket service and independently scalable worker service on App Runner/ECS Fargate (choose by a small proof-of-operation); managed PostgreSQL on RDS with backups/PITR and connection pooling.
- Upstash Redis in the nearest suitable region for ephemeral state; Postmark for transactional email; Sentry plus AWS logs/metrics.
- Distinct development, staging and production accounts/projects, databases, buckets, Redis namespaces, secrets and hostnames. Admin is a separately restricted origin/deployment.

Singapore provides practical Thailand latency while keeping a conventional managed stack. Vercel is excellent for Next.js but splits runtime operations and can create bandwidth/function coupling; Railway/Render are simpler for early prototypes but region/control/production posture must be verified; all-in AWS has lower vendor count but S3 egress/media delivery may cost more. OCI-compatible artifacts, standard Node/PostgreSQL/S3 interfaces and IaC in a later approved step preserve portability.

## Delivery gates

GitHub Actions uses least-privilege OIDC, pinned action SHAs and protected environments. PR: frozen install → lint → typecheck → unit → real-DB integration → web/admin/API/worker build → dependency/license, secret and CodeQL checks. Merge produces one immutable provenance-tagged artifact per deployable. Staging deploys with health/smoke/migration compatibility and rollback validation. Production is a separate manual action requiring explicit Founder approval; use rolling/canary deployment and retain the prior artifact. Database changes are expand/contract and independently approved.

Do not place secrets in GitHub variables intended for clients, build logs or Turbo cache. Define readiness/liveness, graceful WebSocket/job drain, backup restore drills, alarms, budgets and runbooks before production.
