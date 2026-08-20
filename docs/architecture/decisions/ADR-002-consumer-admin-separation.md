# ADR-002: Consumer and Admin Separation

## Status

**PROPOSED** — requires Founder approval, including FD-14.

## Context

Admin actions have materially greater privacy and integrity impact. Reusing Consumer builds, origins or sessions would expand attack surface and permit confused-deputy/session leakage failures.

## Decision

Consumer and WYN Admin use separate builds, deployments, origins, route namespaces, cookies/session realms and authorization middleware. `/admin/v1/` rejects Consumer sessions. Admin uses granular permissions and sensitive actions require recent step-up, reason and immutable audit.

## Alternatives

- One UI with hidden admin routes: client hiding is not authorization and couples release/security boundaries.
- Shared session with an admin claim: increases session theft and privilege-confusion blast radius.
- Entirely separate admin backend/service: useful isolation but premature operational/data duplication for V1.

## Consequences

Compromise and deployment blast radius are reduced and privileged controls are explicit. Two frontend pipelines and authentication realms require more testing and operational care. The API may remain one modular deployment while preserving route and policy separation; later physical isolation does not require changing sessions/contracts.
