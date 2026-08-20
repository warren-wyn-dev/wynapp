# Domain Module Boundaries

**Status:** PROPOSED. Public interfaces below are conceptual, not frozen endpoints.

## Dependency rules

Dependencies point inward to owning modules and never form cycles. Identity is the stable subject reference; Authentication depends on Identity. Profiles and Social Graph depend on Identity. Content modules depend on identity/visibility policy interfaces. Feed, Search, Discovery and ranking modules build read models from events rather than writing source modules. Safety provides block/mute policy queries; Moderation consumes reports and issues explicit actions; Admin orchestrates permitted commands without owning consumer data. Audit and Feature Flags are cross-cutting ports with no dependency back into callers.

| Module | Responsibility and owned data | Allowed dependencies | Public interfaces/events |
|---|---|---|---|
| Identity | User lifecycle/status and external identity links; `users`, `identities` | none | resolve subject, account status; `UserCreated/StatusChanged` |
| Authentication | Credentials, verification, recovery and sessions | Identity, Audit | register/login/logout, verify/reset, revoke/list sessions |
| Profiles | Public/private profile attributes and privacy settings | Identity, Media | get/update profile, visibility summary; `ProfileUpdated` |
| Social Graph | Follows, requests, blocks and mutes | Identity, Safety policy | follow/request/accept/remove/block/mute; graph queries |
| Drops | Drop lifecycle, visibility, hashtags and mentions | Identity, Profiles, Clubs policy, Media | create/edit/delete/get; `DropCreated/Deleted` |
| Media | Upload intents, quarantine, variants and attachment eligibility | Identity, Safety scanning | create/finalize intent, inspect status, authorize attachment |
| Engagement | Likes, redrops, saves and views with distribution scope | Drops visibility, Clubs policy, Safety | engage/unengage, aggregate; scoped events |
| Comments | Comment/reply lifecycle | Drops visibility, Identity, Safety | create/delete/list; `CommentCreated` |
| Feed | Following and For You candidate assembly/read models | Profiles, Social Graph, Drops, Clubs, Safety; ranking signals | fetch cursor page, explain/internal score metadata |
| Search | PostgreSQL user/drop/hashtag/topic/club indexes | source-module visibility query ports, Safety | typed search with cursor |
| Discovery | Suggested users/clubs and topic surfaces | Search, Social Graph, Clubs, Safety | suggestions/dismissal |
| Trending | Global drops/topics and club-local popular/trending | eligible scoped Engagement events, Moderation | ranked snapshots by scope |
| WYN Top 100 | Eligible public creator ranking | Profiles, global signal read model, Moderation | published snapshot; formula pending FD-07 |
| Clubs | Clubs, membership, roles, requests, pins and scoped post association | Identity, Safety, Audit | join/leave/role/pin policy and commands; `ClubJoined` |
| Chat | 1:1 conversations, requests, messages and read state | Identity, Safety, Media, entity visibility ports | request/send/read/delete/list; `MessageCreated` |
| Notifications | Inbox and preferences | Identity, visibility and Safety policy ports | list/read/preferences; consumes domain events |
| Safety | Report intake plus centralized block/privacy enforcement contract | Identity | visibility/interaction decision, create report; `ReportCreated` |
| Moderation | Cases, evidence references, actions and appeals | Safety, target command ports, Audit | triage/review/action/appeal/resolution |
| Admin | Admin principals, roles/permissions, announcements and orchestration | Authentication (admin realm), all approved command/query ports, Audit | permission-gated `/admin/v1/` use cases |
| Audit | Append-only security/administrative event trail | Identity reference only | append/query under permission; no update/delete |
| Feature Flags | Flag definitions, environments and rollout evaluation | Audit | evaluate/manage; never an authorization result |

## Avoiding cycles

- `SafetyPolicy.canView/canInteract` is a narrow policy port; Safety does not call Feed, Chat, or Drops.
- Clubs answers membership/role/visibility; Drops stores the club scope reference but does not manage membership.
- Engagement records immutable scope captured from trusted distribution context; Trending consumes it asynchronously.
- Notifications store references and re-check source visibility at creation and read time; source modules never call Notifications synchronously.
- Admin invokes module application services; consumer modules never depend on Admin.
- Audit accepts sanitized facts and never drives business behavior.

Cross-module transactions are reserved for invariants that cannot tolerate delay (for example attaching at most nine READY media records to a Drop). Derived counters, notifications, search documents and ranking snapshots are eventually consistent and repairable from authoritative records/events.
