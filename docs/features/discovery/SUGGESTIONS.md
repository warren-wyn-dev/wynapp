# Discovery Suggestions

Suggested users combine follows-of-follows/shared accepted-follow count, recent eligible public creator activity and modest public engagement. They exclude self, already-followed and pending targets, either-direction blocks, outgoing mutes, and unavailable accounts. Stable keyset order uses score then user ID; no ML or private graph detail is exposed.

Suggested content reuses the For You candidate, eligibility and score policy, with freshness and unseen preference, canonical-chain dedupe and creator diversity. It never caches a private per-viewer response under a shared key.

Suggested Clubs is a foundation-only response contract: `data: []`, capability state `implemented: false`. Step 11 creates no fake Club records, membership behavior, ranking or full Club implementation.
