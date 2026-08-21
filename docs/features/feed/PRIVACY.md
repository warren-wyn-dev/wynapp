# Feed Privacy and Safety

Authorization is enforced on every request after candidate retrieval and before ranking/serialization. A cache or projection can propose an ID but cannot authorize it. The policy denies deleted/draft/removed content; restricted, suspended, banned, deletion-pending or deleted creators; bidirectional blocks; viewer mutes; visibility failures; and scope failures.

Following may admit follower-visible content only through a current accepted follow. For You is public-only. Block is evaluated before ranking so blocked behavior cannot affect viewer-specific scores. Mute is a private viewer preference and is never exposed to its target. Responses contain the existing public Drop/profile contract only and use indistinguishable not-found/unavailable behavior.

Regression tests must cover direct IDs, cursor continuation after privacy changes, stale snapshots, both block directions, mute, private-account revocation, deletion and account enforcement. Privacy changes take effect at read time even while workers lag.
