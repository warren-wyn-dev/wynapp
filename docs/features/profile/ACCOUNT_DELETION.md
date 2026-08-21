# Account deletion

The user reauthenticates with the current password. A transaction creates an idempotent pending request, sets `DELETION_PENDING`, revokes sessions, and emits `AccountDeletionRequested`. No hard deletion occurs. Retention, cancellation, cleanup timing, and legal holds are deferred for Founder/legal approval.
