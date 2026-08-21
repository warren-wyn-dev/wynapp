# Club model

Step 13 adds public/private Clubs, normalized unique non-reserved slugs, an owner, READY-purpose media references, a transactionally maintained member count, soft deletion, rules, memberships, requests, pins, bans, and audit events. Migration `0008_step13_clubs.sql` is additive and rollback is application rollback followed by a reviewed down migration.
