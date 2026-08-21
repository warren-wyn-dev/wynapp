# Step 13 database

Migration `0008_step13_clubs.sql` adds enums; Clubs, members, join requests, rules, pins, bans and audit tables; `drops.club_id`; case-insensitive active slug uniqueness; partial feed, lookup, queue, membership, audit, search and ranking indexes; Owner-protection and engagement-scope triggers. Foreign keys use `RESTRICT` to avoid accidental destructive cascades. Member counts are transactionally recalculated after membership changes.
