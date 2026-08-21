# Step 11 Feed and Discovery API

All responses use `{ "data": ..., "request_id": "..." }`; failures use the existing stable error envelope. Consumer authentication is required. `limit` is server-bounded (default 20, maximum 50), cursors are opaque/versioned and invalid or mismatched cursors return validation errors. Lists expose `items` and nullable `next_cursor`.

## Feed

- `GET /v1/feed/following?cursor=&limit=` — recency keyset feed of accepted follows.
- `GET /v1/feed/for-you?cursor=&limit=` — policy/snapshot-bound ranked public feed.

Feed item contracts reuse Step 9 Drop and Step 10 engagement state and add a public-safe author relationship state. Follow/unfollow and engagement mutations remain the Step 7/10 endpoints; no duplicate mutations are introduced. The API does not accept rank scores. A rendered item is not automatically a counted view.

## Search and topics

- `GET /v1/search?q=&cursor=&limit=` — bounded typed users/Drops/hashtags response.
- `GET /v1/search/users?q=&cursor=&limit=`
- `GET /v1/search/drops?q=&cursor=&limit=`
- `GET /v1/search/hashtags?q=&cursor=&limit=`
- `GET /v1/topics/:slug?cursor=&limit=`

Queries are normalized, parameterized and rate limited. Search results expose only eligible public fields after viewer authorization.

## Discovery and rankings

- `GET /v1/discovery/trending-drops?limit=`
- `GET /v1/discovery/trending-topics?limit=`
- `GET /v1/discovery/top-creators?limit=` — up to 100 public creators from the latest complete seven-day snapshot.
- `GET /v1/discovery/suggested-users?limit=`
- `GET /v1/discovery/suggested-content?cursor=&limit=`

Suggested Clubs remains a UI/data-contract-only empty state with no fake Club records or functional Club endpoint.

Public ranking responses include `computed_at`, `window_start`, `window_end`, and ruleset version. Snapshot cursors bind snapshot identity, score/rank and stable ID. Removal/account/privacy enforcement is rechecked before serialization; pages may therefore be under-filled.
