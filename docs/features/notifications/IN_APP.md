# In-app Inbox

The inbox is newest-first keyset pagination on `(created_at,id)`, limited to 50. Reads always scope by authenticated recipient; mark-one uses both notification and recipient IDs. Unread count uses the partial unread recipient index rather than a counter at the V1 scale. Expired rows are excluded. V1 stores individual rows; aggregation may be a privacy-aware query-layer enhancement later.
