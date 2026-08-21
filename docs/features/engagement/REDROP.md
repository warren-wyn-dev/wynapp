# ReDrop

A standard ReDrop stores an immutable reference to the original Drop and the sharing actor. One active standard ReDrop per actor/original is enforced by a partial unique index. Reads and writes must re-authorize the original, so FOLLOWERS/private content never gains broader visibility.
