# ADR-011: Self-hosted Better Auth with Server Sessions

## Status

PROPOSED

## Context

V1 requires a complete email/password lifecycle, secure revocable sessions/logout-all and future OAuth, with strictly separate Consumer and Admin realms. Authentication is security-critical and relevant policy remains Founder-controlled.

## Decision

Subject to security review and Founder approval, use maintained Better Auth behind WYN-owned adapters and PostgreSQL-backed, opaque cookie sessions. Consumer and Admin use distinct cookie names, secrets, audiences, origins, callbacks and session scope. WYN domain code performs authorization on every protected action.

## Alternatives

- Auth.js: strong OAuth/session ecosystem but not a complete preferred credentials lifecycle.
- Clerk/Auth0: lower initial implementation burden but recurring MAU cost, data/vendor lock-in and realm customization concerns.
- Custom auth or Lucia: custom lifecycle risk; Lucia is not the preferred maintained library direction.

## Consequences

WYN retains session data/control and can add OAuth through identities. It accepts patching, email security, abuse controls and adapter review responsibilities. FD-01 and FD-14 block final configuration/launch; replacing the library is possible through internal interfaces but migrations would be sensitive.
