# ADR-011: Application-Owned Authentication with Server Sessions

## Status

**ACCEPTED** — Founder-approved for WYN V1.0.0.

## Context

V1 requires email/password registration, verification, recovery, revocable sessions, logout-all, and strict separation between Consumer and Admin realms. Authentication is security-critical, while future Google/Apple identities must remain possible without handing product authorization to a vendor.

## Decision

Own the authentication layer in the dedicated API. Use secure, opaque, server-side sessions and **Argon2id through a maintained implementation** for password hashing. Implement email verification, password reset, per-session revocation, and logout-all. Model external identities separately so Google and Apple may be added later.

Consumer and Admin use distinct cookies, secrets, audiences, origins, callbacks, middleware, and session scopes. Every protected operation performs current server-side resource/action authorization. Cryptographic and protocol primitives may use maintained libraries after security review, but no package or hosted provider owns WYN policy.

## Alternatives

- Hosted identity provider: lowers initial effort but increases user-data/vendor dependency, ongoing cost, and dual-realm constraints.
- Turnkey framework authentication: useful primitives, but delegating the full lifecycle would weaken the approved application-owned boundary.
- Stateless JWT bearer sessions: difficult immediate revocation/logout-all and greater replay exposure for browser sessions.

## Consequences

WYN controls account data, revocation, realm isolation, and future identity mapping, but owns security patching, abuse protection, email lifecycle, audit behavior, and extensive regression testing. Detailed account/session/Admin-factor policy and production launch remain subject to their existing security approvals.
