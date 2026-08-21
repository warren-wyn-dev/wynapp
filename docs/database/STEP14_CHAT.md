# Step 14 Chat data model

Migration `0009_step14_chat.sql` adds canonical two-user conversations, constrained memberships, request state, monotonic per-conversation message sequences, high-water read state, typed message references, idempotency uniqueness, cursor indexes, and restricted report evidence.

The sorted participant unique key and transaction advisory lock make conversation creation race-safe. Historical messages use restricted foreign keys and sender deletion is a tombstone; no existing migration is rewritten. Private `CHAT_IMAGE` assets remain owned media references and are never exposed by a global enumeration query.
