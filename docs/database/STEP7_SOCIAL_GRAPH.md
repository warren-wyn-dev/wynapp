# Step 7 Social Graph Schema

Migration `0002_step7_social_graph.sql` creates `follows`, `follow_requests`, `blocks`, and `mutes`. Foreign keys use restricted deletion, pair uniqueness prevents duplicate relationships, check constraints reject self-relationships, and the partial unique request index permits at most one pending request per pair.

Keyset pagination indexes cover both directions of follows and incoming pending requests. Reverse block/mute lookup indexes support pair privacy checks, while owner/time/id indexes support settings lists. Pair advisory transaction locks serialize competing follow, request, block, and visibility transitions; row locks protect request resolution and target visibility changes.

Follower and following counts are computed from indexed relationship rows. Step 7 deliberately avoids denormalized counters, so no reconciliation job is required. If measurements later justify counters, they must be updated in the same transaction and periodically reconciled from `follows`.
