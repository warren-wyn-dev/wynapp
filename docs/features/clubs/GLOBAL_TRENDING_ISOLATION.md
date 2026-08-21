# Global trending isolation

Database triggers derive engagement scope from `drops.club_id`; clients cannot choose it. Club engagement becomes `CLUB_INTERNAL`. Existing global feed and snapshot queries explicitly filter `GLOBAL_PUBLIC`, so internal likes, comments, views, and redrops never contribute. A later explicit public distribution would create separate global events, never rewrite originals.
