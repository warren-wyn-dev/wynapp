# Trending Topics and Drops

Trending is a periodic, rebuildable snapshot over the rolling **24-hour** window, recomputed every 15 minutes. Only trusted `GLOBAL_PUBLIC` facts and currently eligible public Drops/creators participate.

For a Drop:

```
base = 1.0*uniqueCountedViewers + 3.0*uniqueLikers
     + 5.0*uniqueCommenters + 7.0*uniqueRedroppers
quality = min(20, 4*distinctEventTypes)
velocity = min(30, 8*ln(1 + weightedEventsLastHour))
freshness = 30*exp(-ageHours/12)
abusePenalty = min(50, 20*duplicateRatio + 15*burstFlag + 15*selfEngagementRatio)
score = min(60, ln(1+base)*12) + quality + velocity + freshness - abusePenalty
```

A topic score is `18*ln(1+uniqueCreators) + 10*ln(1+eligibleDrops) + min(30,velocity) + freshness - spamPenalty`; unique creators are mandatory and repeated near-duplicate posts by one creator are capped. Stable ties use entity ID. Deleted/private/restricted facts are removed on recompute.

The API serves the newest completed versioned snapshot and reports `computed_at` and window, never partial computation. Redis may cache public snapshot responses but PostgreSQL remains authoritative.
