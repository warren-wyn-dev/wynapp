# Search

Step 11 remains PostgreSQL-only: B-tree indexes for state/keyset predicates, `pg_trgm` similarity indexes for normalized username/display name/hashtag lookup, and a GIN full-text vector for Drop body/caption. No Elasticsearch, OpenSearch or Meilisearch is deployed.

Queries are normalized, length-bounded and passed as parameters. User search combines exact, prefix and modest trigram similarity and emits public-safe profile fields. Drop search selects published eligible text/caption/hashtags and applies account, visibility, deletion and bidirectional-block policy before snippets. Hashtags use Step 9 NFKC/lowercase normalization. The combined endpoint returns independently bounded typed sections; dedicated endpoints use opaque keyset cursors.

Routes are `GET /v1/search`, `/v1/search/users`, `/v1/search/drops`, and `/v1/search/hashtags`, with `q`, `cursor`, and bounded `limit`. All require an authenticated Consumer session, request ID and search rate limit. Unsafe syntax is treated as text, not SQL or a raw `tsquery`. Draft/private/deleted/blocked content is never indexed as authorization truth and is rechecked at read time.
