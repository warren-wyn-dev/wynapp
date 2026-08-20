# Authentication Stack

**Status:** ACCEPTED — the technology direction is Founder-approved. Detailed account, Admin-factor, retention, and security-policy choices identified by the architecture remain separate approval gates.

## Decision

Build an **application-owned authentication layer** in the dedicated API. V1 supports email and password, email verification, password reset, individual-session revocation, logout of all sessions, and secure server-side sessions. Keep provider-neutral identity records so Google and Apple sign-in can be added later without changing the user identity model; social login is deferred.

Hash passwords with **Argon2id using a maintained implementation**. Store parameters with each hash, calibrate memory/time/parallelism against the production runtime, enforce resource limits, and support rehash-on-login when parameters change. Never log or reversibly encrypt passwords. Verification, reset, and session bearer tokens must be cryptographically random, purpose-bound, short-lived where appropriate, single-use where appropriate, and stored only as hashes server-side.

## Sessions and realm isolation

Use opaque session identifiers in `Secure`, `HttpOnly`, appropriately `SameSite` cookies. Rotate session identifiers at authentication and privilege transitions; define idle and absolute expiry; revoke sessions after sensitive credential changes; and make logout-all invalidate every existing session transactionally. Cookie-authenticated mutations require CSRF protection and strict Origin checks.

Consumer and Admin use distinct cookie names, signing/encryption secrets, audiences, allowed origins, callbacks, middleware, and session scopes. The Admin app is separately deployed. Consumer sessions are rejected on Admin routes and Admin sessions are not a shortcut around resource/action authorization. Every protected action authenticates and then authorizes against current server-side policy.

## Security and operations

Use generic responses and consistent workflows to reduce email enumeration. Apply measured account and network abuse limits without enabling trivial victim lockout. Security-sensitive events—verification, recovery, credential changes, session creation/revocation, and privileged Admin actions—produce redacted audit/security records. Secrets use approved secret storage and rotation.

Required tests cover hashing/rehashing, fixation, replay, expiry, revocation, logout-all, token reuse and races, CSRF, brute force, enumeration, cross-realm acceptance, cross-user access, direct API bypass, and privilege changes. A maintained library may supply low-level primitives only after security review; no third-party package owns WYN policy or the authentication boundary.
