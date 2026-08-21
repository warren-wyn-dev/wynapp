# Step 10 Engagement database

Migration `0005_step10_engagement.sql` creates authoritative likes, comments/replies, ReDrops/quotes, private saves, raw/countable views, validated share facts and idempotency foundation. Counters are simple indexed authoritative `COUNT` queries, appropriate near 1,000 DAU and immune to counter drift; no reconciliation job is required. Composite/partial unique constraints cover duplicate and cross-Drop races.
