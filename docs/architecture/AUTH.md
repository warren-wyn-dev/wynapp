# Authentication and Authorization Architecture

**Status:** PROPOSED. Security-policy choices in FD-01, FD-08, FD-10, FD-11 and FD-14 require Founder approval.

## Consumer authentication

V1 supports email registration, login, logout, email verification, forgot/reset password and session management. Normalize email for lookup while retaining only required display/audit information; enforce uniqueness and verified-state rules transactionally. Passwords use a current memory-hard password hashing algorithm through a maintained library, per-password salts, tunable work factors, and optional server-side pepper held in secret storage. Responses and timing avoid account enumeration.

Verification and reset tokens are random, single-use, purpose-bound, short-lived and stored as hashes. Consuming a reset token rotates/revokes it atomically and, by approved policy, revokes other sessions. Rate limits combine account, IP/network and device risk signals without permanently locking out victims. Age eligibility is captured only after FD-01 defines the approved evidence/minimization policy.

Browser sessions use opaque random identifiers in `Secure`, `HttpOnly`, appropriately `SameSite` cookies; server records contain only token hashes, subject, creation/expiry, rotation lineage, device label, last-used metadata and revocation. Rotate on authentication/privilege change, provide session listing/revocation, enforce idle and absolute expiry, and never put tokens in URLs or logs. State-changing cookie requests require CSRF protection and Origin checks.

`identities(provider, provider_subject)` permits future Google/Apple identities without changing the user primary key. Adding providers is not V1 scope and needs account-linking, collision and recovery threat review.

## Admin authentication separation

Admin has a distinct origin, route stack, identity eligibility, session table/realm, cookie name, signing/audience keys, shorter lifetime and stricter rate limits. Consumer sessions are rejected at `/admin/v1/`, even for the same human. Sensitive operations require recent step-up authentication; the exact MFA and recovery policy remains FD-14. Administrative service credentials cannot authenticate interactive users.

## Authorization model

Every protected command/query constructs a trusted context from the server session, loads current resource state, and evaluates a named policy deny-by-default. Client roles, owner IDs, visibility, counts and scope are ignored. List/search/cache queries apply the same policy predicates as direct reads.

| Policy | Required checks |
|---|---|
| Drop ownership | active owner, current version, not moderation-locked; only owner edits/deletes unless explicit moderation permission |
| Private account | accepted follower or owner; block and account status override follow |
| Follow request | distinct users, no block, unique pending request; target owner accepts/declines, requester cancels |
| Block | checked bidirectionally for visibility/interaction; implementation of shared-Club semantics waits for FD-11 |
| Club membership | active membership and club status; private content requires current membership |
| Club role | explicit action permission and scope, not ordinal role comparison; ownership transfer rules await FD-08 |
| Chat participation | active conversation member plus send/read eligibility and block check at request, send, fetch and delivery |
| Message request | sender eligible; recipient alone accepts/declines; request status gates normal delivery |
| Moderation | granular target/action/scope permission, conflict checks, reason and audit |
| Admin | separate admin session, named permission, current assignment, optional case scope, step-up for sensitive action |

## Granular admin permissions

Roles `OWNER`, `SUPER_ADMIN`, `MODERATOR`, `SUPPORT`, `ANALYST`, and `CONTENT_ADMIN` are bundles of named permissions such as `users.read`, `users.restrict`, `content.read`, `content.remove`, `clubs.moderate`, `reports.assign`, `cases.decide`, `appeals.decide`, `analytics.read`, `announcements.publish`, `flags.manage`, and `audit.read`. No check is equivalent to `role === "admin"`. The final role-permission matrix and forbidden combinations require FD-14; OWNER is not an implicit bypass in code.

## Security events

Login success/failure (privacy minimized), password/session changes, admin authentication, step-up, permission changes and sensitive actions emit sanitized immutable audit records with request/correlation ID. Credentials, raw tokens and private message bodies are prohibited.
