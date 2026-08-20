# ADR-015: Cloudflare Edge with AWS Singapore Runtime

## Status

PROPOSED

## Context

Thailand-first WYN needs low latency, separate web/admin/API/worker scaling, managed PostgreSQL, media CDN, operational maturity and a non-excessive V1 burden.

## Decision

Propose Cloudflare DNS/CDN/WAF/R2 and AWS `ap-southeast-1` managed compute plus RDS PostgreSQL, with Upstash Redis, Postmark and Sentry as managed adjuncts. Deploy OCI-compatible artifacts through GitHub Actions protected environments. Final AWS compute product follows a small approved operational evaluation; no infrastructure is authorized here.

## Alternatives

- Vercel plus another backend: excellent Next experience but fragments runtime and can increase function/bandwidth coupling.
- Railway/Render: simple, but production region, controls, WebSocket/worker and support posture must be validated.
- All AWS: fewer primary vendors, but less attractive media egress/CDN economics and more setup.

## Consequences

Singapore is a practical regional base and managed services reduce toil. Multi-vendor incidents, transfer paths and billing need monitoring. Standard PostgreSQL/S3/OCI/OTel interfaces reduce—not eliminate—lock-in. Founder must approve providers, budget, region, production and every change-controlled deployment.
