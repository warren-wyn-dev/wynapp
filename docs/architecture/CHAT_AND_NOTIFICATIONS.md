# Chat and Notifications Architecture

**Status:** PROPOSED. Chat request/read/delete policies require FD-10; shared-Club block behavior requires FD-11.

## Basic 1:1 chat

Only two distinct consumer users may belong to a V1 conversation. A canonical pair key prevents duplicate active 1:1 conversations. The message-request state (`PENDING`, `ACCEPTED`, `DECLINED`) gates interaction; only the recipient can accept/decline. Text, READY image references, replies, and typed shares of Drop/Profile/Club are supported. Shared entities are references, not copied private content, and are re-authorized when rendered.

Send path:

```text
authenticate → authorize participation/request + bidirectional block + target visibility
→ validate/rate limit/idempotency → transactionally commit message and outbox event
→ return durable sequence → worker/realtime attempts delivery
```

PostgreSQL is authoritative. Messages have a conversation-local monotonic ordering key, sender, kind, bounded body/reference, optional reply ID constrained to the same conversation, timestamps and sender-delete marker. Image media must be READY and owned/authorized for chat attachment. Delete-own hides according to the Founder-approved semantics while preserving restricted evidence snapshots/references where legally and operationally necessary.

Authorization and block/privacy are rechecked at request creation, every send, fetch/read, and delivery attempt. Realtime subscribers authenticate with short-lived channel capability and still receive only event hints/IDs; clients fetch authorized durable messages. A revoked/blocking user stops future delivery immediately. Read state is a per-member high-water mark updated monotonically and transactionally; unread counts derive from it and may be cached.

Idempotency keys plus unique sender/client-message IDs prevent retry duplicates. Reporting a message creates access-restricted evidence without exposing reporter identity. Logs exclude message bodies and share previews.

## Event-driven notifications

Like, Comment, Reply, ReDrop/Quote, Follow, Follow Request, Mention, Chat, Club, Trending and System domain transactions write outbox events. A notification worker claims them and, immediately before writing/delivering, checks recipient preferences, current bidirectional block, privacy, entity visibility, moderation state and actor/recipient status.

The notification row stores type, recipient, actor/reference IDs, safe template data, creation/read timestamps and a deterministic deduplication/grouping key—not copied private bodies. Unique `(recipient_id, dedupe_key)` or an approved grouping-window key makes retries safe. Self-notifications are normally suppressed. System notifications may bypass user preference only under a Founder-approved mandatory category, never block/privacy authorization.

Inbox reads re-authorize destinations. If access changed, return a generic unavailable state or suppress the item; never leak cached text. Push/email/realtime are optional delivery channels driven after inbox commit and may fail independently. Each channel records minimal status/attempt metadata, uses exponential backoff and stops on permanent endpoints. Notification creation and delivery lag, suppression reasons, retry/dead-letter counts and unread reconciliation are observable without logging private content.
