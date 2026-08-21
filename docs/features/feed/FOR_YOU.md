# For You Feed

The V1 pipeline is: bounded candidate generation, eligibility, safety/privacy, deterministic ranking, diversity/deduplication, and keyset pagination. Candidate pools are recent public Drops, public engagement in the ranking window, recent active public creators, and a modest followed-creator relationship boost. There is no ML service.

Only `PUBLIC`, published, non-deleted Drops from active public creators are admitted. Blocks and outgoing mutes are applied before scoring. Private/follower-only/Club-internal facts cannot become candidates or signals. Ranking uses trusted database facts, never client counts or a client-provided score.

A page includes a maximum of two items per creator, never adjacent items by one creator when another candidate is available, and one item per canonical Drop/ReDrop chain. Recently seen candidates receive the documented penalty; excessively seen candidates are excluded. The cursor binds ranking policy version, snapshot time, quantized score, publication time, and ID so a bounded snapshot stays stable.

Empty, loading, error/retry and cursor exhaustion are explicit UI states. Refresh requests a new snapshot; it does not replay or mutate the prior cursor chain.
