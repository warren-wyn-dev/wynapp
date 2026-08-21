# Private-account follow requests

Private targets receive one active pending request per requester/target pair. Only the target can approve or reject; only the requester can cancel. Approval locks the request and relationship pair before creating a follow. Rejected, cancelled, approved, and converted rows retain their resolution timestamp for bounded history.

When an account changes PRIVATE → PUBLIC, its user row and pending requests are locked in one transaction. Every unblocked request is converted to an idempotent follow and every request becomes `CONVERTED`. Existing followers remain. PUBLIC → PRIVATE retains existing followers and causes only new follows to require approval.
