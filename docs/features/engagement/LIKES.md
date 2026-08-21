# Likes

Authenticated active users may like a currently visible published Drop. `PRIMARY KEY (drop_id,user_id)` is the race-safe authority; repeated like/unlike requests are successful no-ops and emit an outbox fact only when state changes. Visibility, bidirectional block and both account states are checked in the transaction.
