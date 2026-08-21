# Notification Privacy

The worker evaluates current state, not event-time assumptions. Either-direction blocks suppress delivery, including events queued before the block. Drop-backed events require a published, undeleted entity and current owner/follower/public visibility. Deleted comments are suppressed. Inbox payloads contain allowlisted template data only; content is fetched and authorized separately. Self-notifications are suppressed, including self-mentions/replies. Mutes may suppress presentation later but never reveal mute state.
