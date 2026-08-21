# Membership

Public join is immediate and idempotent. Private join creates one race-safe pending request. A requester may cancel; Owner/Admin may approve or reject. Approval and membership creation share a transaction. Owner cannot leave. Counts are recalculated while the Club row is locked.
