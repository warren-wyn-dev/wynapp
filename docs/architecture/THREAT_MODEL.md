# WYN V1.0.0 Threat Model and Mandatory Security Requirements

**Owner:** QA & Security Engineer
**Reviewers:** WYN CTO, Software Architect, Database Engineer, DevOps / SRE
**Status:** PROPOSED — architecture only; Founder approval is required for security-policy decisions

## 1. Scope and security objectives

This threat model covers the Consumer App, separately deployed WYN Admin, API, background workers, PostgreSQL, object storage/quarantine, CDN, realtime delivery, email provider, caches and operational telemetry. It covers V1 identity, profiles, Drops/media, social graph, engagement, feeds/search/ranking, Clubs, 1:1 chat, notifications, reporting and moderation. Shop, marketplace, payments, WYN Pop, WYN AI/ZEN, live streaming, video calls, group chat and creator monetization remain out of scope.

Security objectives, in order, are:

1. preserve confidentiality of credentials, sessions, private profiles/Clubs/messages, reports and moderation evidence;
2. preserve authorization and integrity of identity, content, social graph, engagement, ranking, cases, admin actions and audit history;
3. keep publishing, safety controls, moderation and recovery available under abuse;
4. make privileged and security-relevant actions attributable without logging unnecessary personal or message content; and
5. fail closed when identity, policy, visibility or moderation state cannot be established.

## 2. Trust boundaries and protected assets

| Boundary | Untrusted input / risk | Required control |
|---|---|---|
| Browser/mobile client → Consumer API | forged identity, IDs, counts, role, visibility, replay and malformed input | authenticated server session where required; schema/business validation; object/action authorization; CSRF protection where cookie semantics require it; idempotency and risk-based limits |
| Admin browser → Admin API | stolen or Consumer session, privilege escalation, high-impact misuse | separate origin/session/cookie namespace and audience; deny Consumer credentials; granular permission check; step-up for sensitive actions; reason, confirmation and audit |
| API → database/cache | injection, over-broad query, stale privacy cache | parameterized access; least-privilege service identity; ownership/visibility predicates; bounded TTL and invalidation; transaction constraints |
| Upload client → quarantine → processor → permanent storage/CDN | malicious or mislabeled files, bombs, metadata leaks, unauthorized attach | narrow upload intent; isolated quarantine; byte/type/dimension/decode limits; safe decode; metadata strip; malware policy; derived safe assets only; ownership/state checks |
| API transaction → outbox → worker/providers | forged/duplicate/stale event, disclosure to wrong recipient | transactionally written event; schema/version validation; idempotent consumer; re-check preferences/block/privacy/visibility at delivery; minimal provider payload |
| API/worker → realtime channel | spoofed subscription or delivery | authorize at connect, subscribe and delivery; durable DB remains authoritative; opaque minimal event |
| Runtime → logs/metrics/error tracking | token, PII, private message or evidence leakage | allowlisted structured fields, redaction, access/retention control, no raw credentials/tokens/message bodies |
| Internet/CDN → public/private object | guessed URL, stale cache after removal | non-public originals; signed/authorized access where private; unguessable keys are not authorization; purge/invalidate on privacy/removal |

High-value assets include password verifiers and recovery/verification tokens; Consumer and Admin sessions; email and birth/age-assurance data; relationship/block/mute state; private Club and chat content; upload originals; report identities/evidence; admin permissions; feature flags; audit logs; encryption/signing keys; backups; and trusted engagement/ranking events.

## 3. Threats and architecture mitigations

| ID | Threat / abuse path | Impact | Mandatory prevention, detection and response | Residual risk / validation |
|---|---|---|---|---|
| TM-01 | **Account takeover:** credential stuffing, brute force, enumeration, recovery abuse or verification-token replay | account/private-data compromise | approved password hashing; generic auth/recovery responses; per-account/IP/device risk limits; short-lived single-use hashed verification/recovery tokens; rotate/revoke relevant sessions on reset; notify on sensitive changes; audit without secrets | Founder must approve auth, recovery, admin stronger-auth policy; test enumeration, replay, expiry and concurrent reset |
| TM-02 | **Broken access control / IDOR:** swap user, Drop, Club, message, case or media IDs; call hidden endpoint | cross-user read/write/delete | deny by default; server derives actor from session; object + action + current visibility/membership/block/moderation checks on every read and mutation; non-sequential IDs only defense-in-depth; query-level scoping; no client role/count trust | authorization matrix and negative integration suite are release gates |
| TM-03 | **Private/block bypass:** direct URL, share preview, search, cache, feed, notification or realtime leaks entity | harassment/privacy leak | central policy interfaces; enforce at query and serialization/delivery; re-check on fetch and delivery; cache keys include authorization context or cache only safe public projections; purge stale representations; block takes priority pending Founder semantics for shared Clubs | race window must be measured and tested across every surface |
| TM-04 | **XSS/content injection:** bios, Drops, comments, Club rules, chat/share labels, filenames or URLs execute in Consumer/Admin | session theft/admin compromise | store text as data; contextual output encoding; sanitize only explicitly supported rich content; safe link protocols; restrictive CSP and no unsafe dynamic HTML; Admin evidence preview uses inert rendering; safe downloads | test stored/reflected/DOM payloads in both origins |
| TM-05 | **SQL/command/template/header injection and SSRF/open redirect** | data compromise or runtime takeover | typed validation; parameterized queries; no shell interpolation; allowlist URL schemes and outbound destinations; prevent server fetch of arbitrary user URLs; encode headers/templates; minimal DB privileges | static/dynamic tests plus malicious Unicode/encoding corpus |
| TM-06 | **CSRF** on cookie-authenticated Consumer or Admin state changes | unauthorized action under victim session | SameSite/Secure/HttpOnly cookies; anti-CSRF token or strict origin checks appropriate to chosen architecture; no state-changing GET; CORS allowlist; re-auth/step-up for sensitive Admin operations | exact mechanism depends on approved session architecture |
| TM-07 | **Session theft/fixation/replay/cross-surface use** | user/admin impersonation | high-entropy opaque session identifiers stored hashed server-side; rotate at login/privilege change/step-up; expiry and idle timeout; explicit revocation/logout; TLS; no URL/local-storage credential; separate Admin cookie name/domain/path/audience and session store; revoke on account status change | test fixation, expired/revoked token, concurrent sessions and Consumer credential at Admin API |
| TM-08 | **Spam, harassment and API abuse:** mass registration/follow/message/report/comment or resource exhaustion | safety/availability/moderation overload | endpoint-specific actor/IP/device quotas; progressive friction; message-request/privacy policy; bounded payload/page/query complexity; quotas on pending requests/uploads; abuse signals and alerting; block/report remain available | Founder decides user-facing limits and message policy; tune without revealing detection logic |
| TM-09 | **Fake engagement/ranking manipulation:** replay, self/bot rings, Club-to-global leakage | misleading Trending/Top 100/counts | trusted server events only; unique/idempotency constraints; scoped GLOBAL_PUBLIC versus CLUB engagement; exclude ineligible/removed/restricted actors/content; anomaly monitoring and recomputation; rate limits; no client-supplied totals | views, ranking formula and Top 100/Club eligibility await Founder decisions |
| TM-10 | **File upload attack:** executable/polyglot/mislabeled/oversized image, decompression/image bomb, parser exploit, metadata leak | RCE, cost exhaustion, privacy breach | authorized short-lived upload intent with size/count/type limits; quarantine separate from serving; validate magic bytes; safe sandboxed decode with pixel/frame/resource/time limits; strip metadata; re-encode derivatives; malware response; never execute originals; only READY owned media attachable; authoritative transaction enforces ≤9 images | processor/library patching and adversarial corpus required; quarantine/original retention policy pending |
| TM-11 | **Chat privacy/evidence abuse:** blocked sender, unauthorized fetch/delivery, shared private entity, deletion destroys evidence | harassment/privacy/fairness failure | authorize request/send/read/fetch/delivery; durable commit before event/realtime; 1:1 membership constraints; shared entities resolved under recipient's current rights; safe soft-delete/tombstone; preserve sealed report evidence under restricted access; do not log message body | delete semantics, block-in-Club behavior and evidence retention await Founder |
| TM-12 | **Admin abuse/privilege escalation:** forged role, stale permission, self-approval, mass export/action or audit tamper | systemic compromise | separate Admin boundary; granular permissions (never `role === admin`); deny by default; fresh server lookup/revocation; least privilege; step-up, reason and confirmation for sensitive actions; separation-of-duties/conflict checks per policy; bounded export; immutable append-only audit accessible separately; alert anomalous actions | role matrix, step-up method, dual control and retention are Founder gates |
| TM-13 | **Privacy leak through logs, analytics, errors, notifications, backups or non-production** | sensitive-data disclosure | data inventory/minimization; allowlisted telemetry; generic errors; no passwords/tokens/secrets/raw private messages; encrypt transit/at rest; access/retention controls; synthetic/de-identified non-prod data; restore access audited; notification previews minimal | retention/deletion and legal holds require approved policy |
| TM-14 | **Outbox/worker/realtime abuse:** duplicate, poison or reordered event; stale authorization | duplicate notification/count or leak | event ID/type/version/scope/subject; atomic outbox insert; idempotency ledger/unique effects; bounded retry and dead-letter handling; current-state check before side effect; least-privilege worker; correlation metrics/alerts; DB authoritative | ordering-sensitive consumers document aggregate version/preconditions |
| TM-15 | **Supply-chain/secrets/operational compromise:** dependency/build/provider compromise or exposed key | broad compromise | approved secret manager; scoped short-lived credentials and rotation; no secrets in source/build/logs; dependency provenance, pinning and vulnerability review; isolated environments; protected CI/deploy identities; backup/restore and incident runbooks | critical vulnerability or exposed production secret blocks release and triggers rotation |
| TM-16 | **Moderation/report abuse:** reporter deanonymization, report spam, evidence tampering or unauthorized case access | retaliation, wrongful action | confidential reporter identity; strict case/evidence permission; minimum immutable evidence manifest and action history; dedupe/rate controls that do not prevent legitimate safety reports; reason and case linkage; appeal independent per approved policy | taxonomy, SLA, notices and appeals are Founder decisions |

## 4. Mandatory security requirements

These are implementation and release requirements, not optional guidance:

- **SEC-01 Authentication:** Every protected request has a valid, non-expired, non-revoked session for the correct surface. Authentication, recovery and security-policy choices require Founder approval.
- **SEC-02 Authorization:** Every resource operation enforces server-side actor, action, ownership, visibility, block, membership/role and moderation state. Failure or indeterminate state denies access.
- **SEC-03 Administrative isolation:** Consumer and Admin builds, deployments, origins, sessions and authorization boundaries remain separate; a Consumer session can never authenticate an Admin API request.
- **SEC-04 Validation/encoding:** All external data and event payloads are typed, bounded and business-validated; data access is parameterized; output is encoded for its destination.
- **SEC-05 Session/secret safety:** Credentials, reset tokens and session identifiers never appear in URL, logs or client-readable storage where avoidable; sensitive tokens are single-purpose, revocable and stored as verifiers rather than plaintext.
- **SEC-06 Privacy:** APIs, queries, caches, search, CDN, notifications, realtime and workers apply current privacy/block/removal policy. Private data is minimized, encrypted and retention-limited.
- **SEC-07 Media:** Only processed `READY` derivatives owned by the actor and purpose may attach; quarantine cannot be publicly served; the Drop media maximum of nine is rechecked atomically by the authoritative backend/database transaction.
- **SEC-08 Abuse:** Registration, auth/recovery, engagement, follow, chat, report, upload, search and Admin operations have separately measurable risk-based rate/volume controls.
- **SEC-09 Integrity:** Counts, ranking and moderation state derive only from trusted durable writes/events; retries are idempotent and Club engagement cannot enter global ranking directly.
- **SEC-10 Audit:** Sensitive Admin/moderation/security actions append actor, permission/action, target, reason, timestamp, request/correlation ID and outcome. Logs are tamper-evident/append-only to normal admins and contain no secrets or unnecessary evidence.
- **SEC-11 Monitoring/response:** Detect auth abuse, permission denials, Admin anomalies, upload failures, engagement manipulation, worker poison events and data-access anomalies; alerts have owner/runbook. Preserve evidence safely.
- **SEC-12 Release:** No unresolved CRITICAL finding may ship. HIGH ordinarily blocks the affected release unless Founder explicitly accepts documented residual risk after QA & Security review; security controls may not be silently disabled.

## 5. Required QA/security review matrix

| Area | Required adversarial checks | Pass condition |
|---|---|---|
| Identity/session | enumeration, brute force, fixation, replay, expiry, logout/revocation, reset reuse, privilege/status change | generic responses; limits work; invalid/revoked sessions fail closed; rotation/revocation is effective |
| Cross-user/API | User A read/edit/delete User B; ID substitution; hidden/direct route; overposting; invalid workflow transition | every attempt denied without disclosing resource details or changing state |
| Privacy/social graph | private account, pending request, block/mute, privacy changed mid-request, direct URL/search/cache/notification/share | no unauthorized bytes/metadata; stale access revoked within approved bound |
| Club | non-member/private Club, role escalation, join races, removed member, pin/moderate direct API, shared blocked users | membership/role/state enforced transactionally; important actions audited |
| Drops/engagement/ranking | inaccessible/removed content actions, retries, duplicate likes/views, bot/burst patterns, Club event labeled global | invalid actions denied; effects unique; scoped events cannot cross ranking boundary |
| Media | extension/MIME mismatch, polyglot/executable, huge bytes/pixels/frames, corrupt parser input, metadata, expired intent, foreign media, 10th image, retry | rejected/quarantined safely; no original execution/public serving; ≤9 invariant survives concurrency |
| Chat | non-member read/send, blocked at request/send/fetch/delivery, request bypass, deleted/evidence message, unauthorized share, realtime spoof | durable DB controls truth; forbidden content absent from fetch and delivery; evidence remains restricted |
| Moderation | duplicate/report spam, deleted target evidence, unauthorized queue/case, stale/concurrent decision, action rollback/appeal | confidentiality and state machine hold; one effective decision; complete audit linkage |
| Admin | Consumer session reuse, each role × permission, forged/stale role, missing reason/step-up, self-approval, mass action/export, audit edit/delete | separate auth rejects; least privilege; sensitive action gates; tampering blocked/detected |
| Injection/client | SQL/command/header/URL payloads, stored/reflected/DOM XSS, CSRF, CORS, error disclosure | no execution/query alteration/cross-origin mutation; safe rendering and minimal errors |
| Async/operations | duplicate/out-of-order/poison event, worker crash, provider retry, backup restore access, secret scan | idempotent effects; bounded recovery/alerts; restore protected/audited; no secrets |

Testing must include unit policy tables, integration tests against real persistence constraints, API-level negative tests, worker/retry tests and end-to-end critical journeys. Security findings record scope, prerequisites, reproducible evidence, impact, severity rationale, owner, remediation and retest. CRITICAL findings immediately escalate to CTO and Founder and cannot be waived.

## 6. Security review gates

1. **Before implementation:** Founder resolves policy gates below; CTO/Architect approve trust boundaries; QA converts this matrix into traceable cases.
2. **Before staging:** threat-model delta reviewed; authorization and upload suites pass; secret/dependency checks pass; no unresolved CRITICAL; HIGH disposition documented.
3. **At staging:** test with production-like isolation, headers, session boundaries, worker retries, CDN privacy and alerts; perform restore/rollback evidence checks without production data.
4. **Before production:** QA & Security sign-off, CTO final review and explicit Founder approval for the exact staged release. Production verification must not weaken controls.

## 7. Founder decisions / unresolved security gates

| Gate | Decision required | Safe default until approved |
|---|---|---|
| FD-01 | registration/login, verification/recovery, 18+ assurance | no implementation; do not collect extra identity data |
| FD-03 / FD-12 | guest surfaces and Likes/follower list visibility | deny non-owner/private disclosure |
| FD-04 / FD-06 / FD-07 | view dedupe; feed/trending/Top 100 inputs and eligibility | exclude ambiguous/untrusted signals from public ranking |
| FD-08 / FD-09 / FD-11 | Club permission/governance and block semantics in shared Clubs | deny protected actions; do not reveal private Club content |
| FD-10 | message requests, receipts and delete/evidence semantics | restrictive request policy, no unnecessary receipt exposure, preserve inaccessible evidence |
| FD-13 | report taxonomy, SLA, appeals, notices | collect minimum report context; no unapproved promise or disclosure |
| FD-14 | Admin permission matrix, stronger/step-up auth, dual control, audit/evidence/UGC retention | no sensitive role action without explicit permission, fresh auth, reason and immutable audit |
| FD-15 | quantitative security/performance availability targets | instrument first; release thresholds require approval |

Any resolution that changes authentication architecture or security policy must record Founder approval, scope, risk and rollback plan.
