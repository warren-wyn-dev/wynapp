# Drop model

Step 9 adds the `drops` aggregate with `DRAFT`, `PUBLISHED`, and `DELETED` states and `PUBLIC`/`FOLLOWERS` visibility. Body is plain text (5,000 characters), caption is plain text (2,200), and `version` provides optimistic/audit ordering. Drafts have no `published_at`; deletion is soft. Club scope and engagement are excluded.
