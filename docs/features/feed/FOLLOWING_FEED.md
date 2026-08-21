# Following Feed

Step 11 uses **fan-out on read** for the initial ~1,000 DAU target. `GET /v1/feed/following` selects published Drops by accepted follows and eligible standard/quote ReDrops, then applies the common eligibility policy before returning anything. No per-user timeline or fan-out queue is introduced.

Ordering is distribution time descending, then distribution ID descending. The opaque versioned cursor encodes this tuple; it is validated server-side and never accepts an offset or client score. The service fetches a bounded surplus to backfill rows removed by eligibility or deduplication.

Eligibility requires an active, non-restricted/non-suspended/non-banned author, no block in either direction, no outgoing viewer mute, a live published Drop, and visibility allowed by the accepted follow. Deletion/removal wins over stale projections. ReDrops are deduplicated by canonical Drop ID, retaining the newest eligible distribution. An under-filled page is preferable to a privacy leak.

Feed cards reuse Step 10 engagement and Step 7 follow APIs. A private-account follow action renders `REQUESTED`; optimistic UI must roll back on failure. Rendering is not a view: the Step 10 explicit visibility/dwell-triggered view mutation and hourly viewer/Drop bucket remain authoritative.
