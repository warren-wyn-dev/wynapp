# Topics

Topics are a lightweight discovery projection, not NLP classification. A topic has a normalized unique slug, display label, optional curated description and active flag. Topic-to-hashtag mappings group Step 9 normalized hashtags; trending topic groups can reference the same topic.

`GET /v1/topics/:slug` returns safe topic metadata and a cursor page of currently eligible public Drops. Unknown, inactive, or empty-after-policy topics return the normal unavailable/empty contract. Curation is data foundation only in Step 11; no admin workflow is implemented.
