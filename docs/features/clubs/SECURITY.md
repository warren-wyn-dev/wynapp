# Club security

Inputs use Zod plus database constraints and parameterized SQL. Private resources fail closed, role input is ignored except on the authorized role endpoint, media must be owned, READY, and purpose-matched, pending requests are unique, and slug uniqueness is case-insensitive. Tests must cover IDOR, forged roles, owner takeover, request races, XSS rendering, and global-ranking isolation.
