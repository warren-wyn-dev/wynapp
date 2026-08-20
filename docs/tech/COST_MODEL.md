# WYN V1 Cost Model

**Status:** ACCEPTED as a planning model. All figures are approximate **USD per month**, exclude tax, labor, premium support, and unusual abuse, and are not quotes or spending authorization. Provider pricing, exchange rates, usage, and plan limits can change; validate current calculators before procurement or scaling.

## Planning assumptions

The bands assume managed services, one modest production footprint, restrained non-production usage, healthy CDN caching, bounded media variants, short telemetry retention, and no dedicated search/realtime cluster. Image volume, delivery bandwidth, chat concurrency, high availability, and log volume can change costs substantially.

| Category | Development / very low traffic | About 1,000 DAU | About 10,000 DAU |
|---|---:|---:|---:|
| Compute (Consumer, Admin, API, worker) | $0–75 | $80–300 | $400–1,500 |
| Managed PostgreSQL and backups | $0–50 | $50–250 | $250–1,000 |
| Object storage | $0–10 | $5–40 | $30–250 |
| CDN / bandwidth | $0–20 | $10–150 | $100–1,200 |
| Redis (optional) | $0–10 | $0–50 | $40–300 |
| Email | $0–20 | $10–100 | $75–500 |
| Monitoring / error tracking / logs | $0–40 | $20–150 | $100–700 |
| Realtime delivery | $0–10 | $0–75 | $50–500 |
| **Illustrative total** | **$0–235** | **$175–1,115** | **$1,045–5,950** |

Realtime is shown separately even when initially hosted within API compute; the band represents incremental connection capacity, fan-out, or a later justified managed provider. Likewise, Redis may remain $0 when it is unnecessary. Vercel plan requirements, managed backend minimums, database high availability, R2 operations, cross-provider transfer, email volume, and Sentry ingestion are major uncertainties.

## Controls and review triggers

Track cost by environment and category, with budget alerts and owner review. Measure cost per DAU, API request, stored/processed image, delivered GB, email, realtime connection-hour/message, and telemetry GB. Bound upload bytes/pixels/variants, cache immutable processed assets, expire quarantine/orphans only under approved retention, cap worker concurrency, and sample nonessential telemetry without sampling required audit evidence.

At 10,000 DAU, rebuild the forecast from actual peak traffic and compare committed compute/database tiers, Redis economics, email tiers, and realtime operations. Before approaching 100,000 DAU, create a new capacity and cost model rather than multiplying these ranges.
