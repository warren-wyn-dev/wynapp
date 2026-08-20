# Authentication Stack

**Status:** PROPOSED — adopting or configuring authentication/security policy requires Founder approval; no implementation is authorized.

## Decision

Use maintained, self-hosted **Better Auth** behind WYN-owned interfaces for email/password, verification, reset and database-backed sessions. Store opaque session identifiers only in `Secure`, `HttpOnly`, appropriately `SameSite` cookies; store only token hashes server-side. Use the library's supported password KDF/default after security review, calibrate its cost, and do not replace it casually. Future Google/Apple identities map to separate identity records.

Auth.js is strong for OAuth but intentionally does not provide a complete credentials lifecycle. Lucia is no longer the preferred maintained library path. Clerk/Auth0 reduce implementation but add per-user cost, data residency/lock-in and difficult dual-realm customization. A custom protocol maximizes control but creates unacceptable security maintenance in V1.

## Realm and abuse controls

Consumer and Admin use distinct cookie names, secrets/keys, audiences, callback URLs, origin allowlists, session stores/scopes and middleware. A Consumer credential is never accepted by `/admin/v1`. Admin stronger factors, recovery and permission matrix await FD-14; production Admin must not launch until approved.

Verification/reset tokens are random, purpose-bound, short-lived, single-use and hash-stored. Rotate sessions after authentication/privilege events; support revoke-one and logout-all. Apply CSRF plus Origin checks to cookie writes; generic responses/timing, progressive account+IP/network limits and alerts reduce enumeration/brute force without easy victim lockout. Recovery, email change and high-risk Admin actions create redacted security events. Authorization remains WYN domain policy on every action/resource, never a feature of the UI or merely possession of a session.

Before adoption: verify maintenance/security history, pin compatible versions, review adapters and migrations, fuzz session/token flows, and test fixation, replay, cross-realm, cross-user, logout-all and recovery races.
