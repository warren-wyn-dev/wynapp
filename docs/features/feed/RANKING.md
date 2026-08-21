# Feed Ranking Policy

## For You V1 (`foryou-v1`)

All inputs use globally eligible public facts from the trailing 24 hours unless stated otherwise. For candidate `d`:

```
ageHours = clamp(hours(snapshotAt - publishedAt), 0, 168)
recency = 40 * exp(-ageHours / 18)
engagement = 8*ln(1+uniqueLikes) + 12*ln(1+uniqueComments)
           + 14*ln(1+uniqueRedroppers) + 5*ln(1+uniqueCountedViewers)
velocity = 10*ln(1 + weightedEventsLastHour / max(1, weightedEventsPrevious23Hours/23))
relationship = authorIsFollowed ? 12 : 0
quality = min(8, 2*distinctPublicEngagementTypes)
abusePenalty = min(35, 15*duplicateRatio + 10*burstFlag + 10*selfEngagementRatio)
seenPenalty = min(24, 8*viewerPriorImpressions)
score = recency + min(42,engagement) + min(18,velocity)
      + relationship + quality - abusePenalty - seenPenalty
```

Event weights for velocity are view `0.25`, like `1`, comment `2`, and ReDrop `3`. `ln(1+x)`, caps, distinct actors, hourly view dedupe, self-action discount, and burst/duplicate penalties prevent raw volume domination. Inputs and thresholds are server-owned tunables. Ties are publication time descending and ID descending.

A newer candidate outranks a stale candidate with otherwise identical signals. Eligibility is not a score: an ineligible row is removed, not penalized. Diversity is a deterministic post-rank constraint, and a policy-version change starts a new cursor snapshot.
