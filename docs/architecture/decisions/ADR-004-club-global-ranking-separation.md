# ADR-004: Club and Global Ranking Separation

## Status

**PROPOSED** — requires Founder approval; ranking formulas remain FD-06/FD-07.

## Context

Private/scoped Club engagement has a different audience and must not manipulate or leak into Global Trending. Public redistribution of club content creates a legitimate but distinct public context.

## Decision

The server assigns every distribution and engagement event either `GLOBAL_PUBLIC` or `CLUB` scope, with a club ID required for Club scope. Global aggregates consume only eligible engagement on a public distribution. Publicly ReDropped club content gets a distinct authorized public distribution; only engagement occurring there counts globally. Club popular/trending uses club-partitioned data.

## Alternatives

- Combine all engagement: leaks private activity and makes global ranking manipulable.
- Exclude club-origin content forever: ignores legitimate public engagement after authorized sharing.
- Subtract club counts during ranking: fragile because provenance is lost and corrections are difficult.

## Consequences

Privacy and ranking integrity are explainable and testable, at the cost of explicit distribution IDs/scope on writes and projections. Historical club signals cannot be promoted. Recomputable snapshots can remove moderated/fraudulent signals. Top 100 club eligibility remains excluded by safe default until Founder decision.
