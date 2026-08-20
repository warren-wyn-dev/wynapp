# V1 Cost Model

**Status:** PROPOSED planning model only. **USD/month, excluding tax and engineering/support labor; not a quote or guaranteed price.** Validate provider calculators, Thailand traffic assumptions, support tiers and exchange rates immediately before procurement. Model date: 2026-08-20; live pricing could not be verified in this documentation pass.

## Assumptions

Thirty-day month; 2 images per creating user on average; processed media dominates bandwidth; CDN cache hit is healthy; staging can sleep/scale low; no enterprise support; modest log retention. Chat/media behavior can change cost by an order of magnitude, so budgets and alerts are mandatory.

| Category | Dev / very low | 1,000 DAU | 10,000 DAU |
|---|---:|---:|---:|
| Compute: web/admin/API/worker | $20–60 | $100–250 | $450–1,200 |
| PostgreSQL incl. backups | $0–30 | $80–180 | $300–900 |
| Redis/realtime transport | $0–10 | $10–40 | $60–250 |
| Object storage | $0–5 | $5–25 | $30–150 |
| CDN/bandwidth | $0–10 | $10–80 | $100–800 |
| Transactional email | $0–15 | $15–60 | $80–300 |
| Monitoring/logs/errors | $0–25 | $25–100 | $100–500 |
| DNS/WAF/secrets/misc. fixed | $0–20 | $20–80 | $50–200 |
| **Illustrative total** | **$20–175** | **$265–815** | **$1,170–4,300** |

“Fixed” baseline is chiefly minimum compute/database/monitoring plans; storage, requests, bandwidth, emails, log ingestion and realtime connections/messages vary with usage. Production high availability, longer retention, premium support or duplicate staging can raise the table materially.

## Cost controls and risks

- Record cost per DAU, per delivered media GB, per email and per realtime connection/message; alert at 50/75/90% of approved budget.
- Bound image count/bytes/dimensions/variants, prefer cached processed variants and expire quarantine/orphans under approved retention.
- Sample traces, cap log cardinality/retention and never pay to ingest useless request bodies.
- Scale workers independently, set hard concurrency/timeout ceilings and load-test before reserving capacity.
- R2 egress economics, AWS cross-zone/NAT/data transfer, database IOPS/backups, Upstash per-request usage, Postmark volume and Sentry events are the principal pricing uncertainties.

At 10,000 DAU, compare reserved AWS capacity, regional Redis, managed realtime and email tiers using measured traffic. At 100,000 DAU, produce a new capacity model rather than multiplying this table.
