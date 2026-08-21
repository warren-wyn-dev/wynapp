# Step 6 authentication requirements

WYN owns email/password identity. Email is trimmed and lower-cased; UUID is the business identity. Account states are `ACTIVE`, `RESTRICTED`, `SUSPENDED`, `BANNED`, `DELETION_PENDING`, and `DELETED`. Only ACTIVE and RESTRICTED accounts authenticate. Restricted accounts have no Step 6 moderation workflow.

Usernames are trimmed/lower-cased, 3–30 ASCII letters, digits, or underscore, unique case-insensitively. `admin`, `administrator`, `support`, `security`, `system`, `wyn`, `wynadmin`, and `moderator` are reserved.
