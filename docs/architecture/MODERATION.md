# WYN V1.0.0 Safety and Moderation Architecture

**Owners:** Safety and Moderation modules
**Reviewers:** QA & Security Engineer, WYN CTO, Software Architect, Database Engineer
**Status:** PROPOSED — architecture only

## 1. Scope and principles

V1 supports confidential reports against **User, Drop, Comment, Club and Message** and outcomes **No Action, Warning, Remove Content, Restrict, Suspend and Ban**. Appeals are an Admin capability whose V1 priority and policy remain subject to Founder approval. The workflow is:

> Report → Case → Review → Action → Appeal → Resolution

Safety rules are server-enforced across direct API, feed, search, share, CDN, notification, Club, chat and Admin paths. Reporters are not identified to reported users in Consumer WYN. Moderators receive only evidence required for their permission and case. Removal uses safe soft-delete; audit history is not ordinary editable product content.

This design does not add automated/AI moderation, law-enforcement workflows, live moderation or other out-of-scope products.

## 2. Module boundaries

| Module | Owns / responsibility | May call or consume | Public interface (conceptual, not frozen endpoints) |
|---|---|---|---|
| Safety | report submission validation, reporter confidentiality, abuse controls, and centralized evaluation of block/mute privacy policy through the Social Graph port | Identity/Auth policy; Social Graph policy port; target resolver interfaces; outbox | `submitReport`, `canReport`, `canView`, `canInteract`; `ReportCreated` |
| Social Graph | sole owner of `blocks` and `mutes`, their mutation commands, and atomic removal of conflicting follows/pending requests | Identity; Safety consumes its narrow policy query port | `block`, `unblock`, `mute`, `unmute`, `getInteractionEdges`; `BlockChanged`, `MuteChanged` |
| Moderation | cases, assignments, review state, decisions, actions, appeals/resolution | Safety report projection; target modules through narrow enforcement ports; Admin permission; Audit; outbox | `open/triage/assignCase`, `recordDecision`, `applyAction`, `submit/reviewAppeal`; action/status events |
| Target modules (Profiles, Drops, Comments, Clubs, Chat) | authoritative target existence/owner/visibility/status; enforcement of action | consumes moderation status/action through defined policy/projection | `resolveModerationTarget`, `applyModerationEffect`, `canViewerAccess` |
| Admin | separate UI/session; queue/search/detail/action orchestration | Moderation interfaces only; no direct mutation of target tables | permission-scoped views/commands |
| Audit | append-only important action record and protected retrieval | accepts structured audit append in the same transaction where feasible | `appendAuditEvent`, permission-scoped query |
| Notifications | policy-approved notices to reporter/target | consumes committed events; rechecks visibility/block/preferences | `ModerationNoticeRequested` consumption |

Dependencies are directional: Admin → Moderation → target-module ports/Audit; Safety → Moderation via report/outbox; Safety → Social Graph's read-only policy port. All block/mute writes enter through Social Graph, which owns the transaction that creates/removes the edge and removes conflicting follows or pending requests; Safety never duplicates those commands or writes graph tables. Architecture and contract tests must reject any Safety repository or command handler that mutates `blocks`, `mutes`, follows, or follow requests directly. Target modules must not depend on Admin. Audit records facts but never drives authorization or moderation state.

## 3. Logical records and privacy ownership

This section refines, but does not create, migrations.

- **Report:** immutable reporter ID (restricted), target type/ID, reason code, minimum submit-time context, source surface, timestamps, status and idempotency key. Safety owns it. Reporter and target cannot modify it after submission; a supplementary append may be allowed by approved policy.
- **Moderation Case:** case ID, severity/priority, queue, state, linked reports/targets, assignee, version and timestamps. Moderation owns it. Multiple duplicate reports may link to one case without exposing reporters to one another.
- **Evidence item/manifest:** case linkage, evidence type, source reference or sealed snapshot pointer, captured-at, content hash, capture actor/source, access classification and retention/legal-hold state. It stores only necessary context; restricted message evidence is never copied into general logs or analytics.
- **Moderation Action:** immutable action fact containing case, actor Admin identity, granular permission used, target, action type/scope, reason code plus necessary notes, effective/expiry timestamps, prior/result state, request/correlation ID and outcome. Corrections are compensating actions, never edits.
- **Appeal:** appellant/eligibility, action/case link, reason/context, state, reviewer, decision, timestamps and version. Access is limited and conflict-of-interest rules apply once approved.
- **Audit event:** append-only record of report/case/action/appeal security-relevant transitions. Normal Admin users cannot update/delete it; access itself should be audited for sensitive evidence.

Reporter identity, private messages, identity/age data, internal abuse signals and moderator notes are separate protected fields/projections. Consumer responses use opaque references and never reveal internal notes, reporter identity, detection logic or unrelated enforcement history.

## 4. State machines and invariants

### 4.1 Report and case

Suggested report states are `RECEIVED → TRIAGED → LINKED_TO_CASE → CLOSED`, with an explicit rejected-as-invalid/abuse terminal reason when authorized. Case states are `OPEN → IN_REVIEW → DECIDED → ACTIONED → RESOLVED`; a case may enter `AWAITING_APPEAL_REVIEW` only under approved appeal policy.

Mandatory invariants:

- Report submission authenticates the reporter, validates target type/ID and a reason from the approved taxonomy, enforces idempotency/rate controls, and writes `ReportCreated` to the outbox in the same transaction.
- A target deleted after a legitimate view can still be reported when minimum authorized context exists; the report never restores public visibility.
- Duplicate reports are deduplicated/grouped operationally, not silently discarded; each legitimate submission remains attributable and confidential.
- Assignment/claim uses optimistic versioning or an atomic conditional update. A stale moderator cannot overwrite a newer decision.
- Closing with **No Action** requires a reason and audit record. It performs no target restriction.
- Case state, effective target enforcement and corresponding action/audit/outbox facts change atomically where one database transaction can cover them. Cross-module projections are deny-safe and retryable.

### 4.2 Action semantics

| Action | Authoritative effect | Reversal / expiry |
|---|---|---|
| No Action | resolve case with documented rationale; no target change | reopen only through permissioned, audited command |
| Warning | immutable warning record plus policy-approved notice | never erase history; later correction is appended |
| Remove Content | safe soft-delete target from product surfaces while retaining minimum protected evidence | restore only with granular permission, reason and audit; purge/caches/index/CDN updated asynchronously but access denies immediately |
| Restrict | deny specified actions/surfaces for scope and optional duration | expiry/reversal is explicit, idempotent and audited |
| Suspend | account cannot use affected Consumer operations; sessions revoked/checked against status | reinstatement explicit and audited; retained data follows approved policy |
| Ban | deny account access and prevent affected content/identity from eligible surfaces under policy | highest-impact reversal requires designated permission/step-up and audit |

Moderation status is checked on every applicable Consumer and Admin entry point. UI hiding, delayed search removal or worker delivery is not the enforcement boundary. Caches/search/CDN receive invalidation events, but API/object authorization immediately consults authoritative or deny-safe current state.

### 4.3 Appeal

If enabled after Founder decision, only an eligible actor may appeal an appealable action within the approved window and count. Submission creates an immutable appeal linked to the original case/action. The reviewer must have `appeal.review` (not merely `moderation.act`), pass conflict/separation rules, view only necessary evidence and choose **uphold**, **modify**, or **overturn** with reason. Resulting changes are new compensating actions, and both decision and user notice are audited. The original record is never rewritten.

## 5. Authorization and sensitive Admin controls

Authorization combines the correct **Admin session**, granular permission, permitted target/scope, current case state and conflict policy. Role names (OWNER, SUPER_ADMIN, MODERATOR, SUPPORT, ANALYST, CONTENT_ADMIN) are permission bundles only; checks never use `role === "admin"`.

Conceptual permissions include:

- `report.read_metadata`, `report.read_reporter_identity`, `evidence.read_content`;
- `case.triage`, `case.assign`, `case.review`;
- `moderation.warn`, `moderation.remove_content`, `moderation.restrict`, `moderation.suspend`, `moderation.ban`, `moderation.reverse`;
- `appeal.read`, `appeal.review`;
- `audit.read`, `audit.export_limited`.

Exact role mapping is a Founder gate. Sensitive actions (at minimum Restrict, Suspend, Ban, restoration/reversal and protected evidence export) require a fresh server permission check, step-up authentication, reason, explicit confirmation, idempotency key and audit record. Bulk action is not implicit in V1. The implementation must be able to enforce dual control or disallow self-review if Founder adopts that policy.

Consumer users may create reports they are eligible to make and may view only the limited status/notice policy permits. They cannot list case evidence, reporter identity, moderator identity/internal notes or audit logs.

## 6. Evidence, deletion and retention

- Capture evidence only when necessary and only from content the reporter legitimately encountered or a trusted server record. Record provenance, capture time and integrity hash.
- Separate live content from a restricted evidence snapshot. Deleting a message/content hides it from normal surfaces but does not destroy evidence already attached to a valid report while retention permits.
- Never put raw message bodies, upload originals, reporter identity or moderator notes in general logs, event payloads, analytics or notification previews.
- Encrypt evidence in transit and at rest, scope service/person access, audit sensitive reads/exports and use non-production synthetic data.
- Retention categories distinguish reports/cases, action/audit facts, evidence/UGC snapshots and operational logs. Expiry jobs must be idempotent, respect legal/incident holds if approved, delete derived copies, and append a non-sensitive deletion fact.
- Until Founder approves retention, do not promise a duration, destructively purge evidence, or keep it indefinitely by assumption. Apply data minimization and deny ordinary access.

## 7. Events and failure handling

Durable transactions emit versioned, minimal events such as `ReportCreated`, `CaseAssigned`, `ModerationActionApplied`, `ContentRemoved`, `AccountRestricted`, `AccountSuspended`, `AccountBanned`, `AppealSubmitted`, and `AppealResolved`. Each includes event ID, aggregate ID/version, timestamp, action/scope identifiers and correlation ID—never unnecessary evidence or private message content.

Workers are idempotent and use unique effect keys. Notifications, search/feed removal, session revocation, CDN purge and analytics projection retry independently. Before notification/delivery, workers re-check target visibility, block/privacy and approved notice policy. A failed projection cannot make removed content accessible: authoritative reads deny immediately. Poison events move to an observable failure queue/state with alert and replay tooling; retries never duplicate user notices or actions.

## 8. Auditability and observability

For every important transition capture: Admin/service actor, permission/action, target type/ID, case/action ID, structured reason, timestamp, request/correlation ID, prior/result status and success/failure. Use an append-only table/store with database privileges that deny update/delete to normal application/Admin identities. Corrections reference prior events. Periodic integrity verification and restricted export are required; absolute cryptographic immutability is a future infrastructure choice, not asserted without implementation.

Privacy-safe metrics include queue age/volume, case/action counts by coarse reason, appeal outcome, processing error/retry, denied Admin action, step-up failure, anomalous evidence access and audit append failure. Never use metrics labels containing user IDs, message text or report narrative. Alert on audit write failure, unexplained action spikes, repeated privilege denials, overdue queues relative to an approved SLA and failed enforcement projection.

## 9. QA and security review

| Scenario | Expected result |
|---|---|
| report every supported target, including a target removed after legitimate viewing | confidential idempotent report or safe rejection; no reporter disclosure |
| blocked reporter submits a report with legitimate prior context | block cannot suppress safety reporting; no new unauthorized target access |
| duplicate/replayed/concurrent report | bounded abuse handling; no duplicate side effects; reports/case linkage consistent |
| Admin with each role calls every report/evidence/action/appeal API directly | only explicit permission succeeds; hidden UI is irrelevant |
| Consumer session calls Admin moderation API | rejected before resource disclosure |
| stale assignment/decision and concurrent conflicting actions | one version-consistent effective transition; conflict returned and audited |
| missing reason, confirmation, step-up or idempotency on sensitive action | fail closed; no target change; safe attempt telemetry |
| remove/restrict/suspend/ban then access through feed/search/direct URL/CDN/share/notification/chat | authoritative access denied everywhere; projections converge observably |
| deleted message is reported and sender requests deletion | normal view tombstoned; minimum evidence remains restricted per policy |
| moderator edits/deletes action/audit or reviews own action contrary to policy | denied/detected; correction is compensating event |
| appeal upheld/modified/overturned with retry | one durable result and compensating action; original history intact; notice deduped |
| log/error/export inspection | no secrets, tokens, unnecessary PII, raw private messages or reporter disclosure |

QA reports CRITICAL/HIGH/MEDIUM/LOW under `SECURITY_RULES.md`. A systemic authorization bypass, broad private evidence exposure, audit destruction, Admin takeover or production secret exposure is CRITICAL and blocks release. HIGH ordinarily blocks the affected release unless Founder explicitly accepts a documented residual risk after security review; CRITICAL cannot be waived.

## 10. Founder decisions and release gates

The following decisions must be resolved and recorded before the affected capability is implemented or released:

1. **FD-13:** report reason taxonomy and required context; moderation priority/SLA; notices to reporter/target; appeal eligibility, window, count, reviewers and outcome semantics.
2. **FD-14:** exact Admin role-permission matrix; stronger/step-up authentication method and freshness; self-review/dual-control policy; audit, report, evidence, message snapshot and UGC retention; export access.
3. **FD-10:** delete-own-message semantics and preservation/disclosure of reported-message evidence.
4. **FD-11:** block semantics when users share a Club, including moderator safety visibility.
5. **Governance clarification:** which actions/scopes are reversible, who may restore content/reinstate accounts, and whether Ban or audit/evidence export requires two-person approval.

Safe interim posture is deny by default, collect minimum evidence, preserve existing protected evidence without promising indefinite retention, require step-up/reason/audit for every high-impact action, prohibit bulk/high-risk operations without explicit permission, and expose no internal case detail to Consumer users.

Release requires CTO architecture review, Database integrity/concurrency review, QA & Security negative authorization and privacy review, operational alert/runbook review, no unresolved CRITICAL finding, staging validation, and explicit Founder approval. This proposal itself grants no permission to implement, migrate, deploy or change production policy.
