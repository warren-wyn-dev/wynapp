# Block

Block is a bidirectional safety boundary even though the stored action has a blocker and target. Pair advisory locks serialize block/follow races. Blocking removes follows in both directions and cancels pending requests in both directions in the same transaction. Blocked users receive unavailable responses for profile/relationship access. Unblock deletes only the block and never restores follows or requests.
