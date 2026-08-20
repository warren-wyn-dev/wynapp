# ADR-008: Next.js for Separate Consumer and Admin Apps

## Status

PROPOSED

## Context

WYN needs Thai-first mobile/PWA feed UX, SSR/SEO for allowed public surfaces, optimized media delivery and a separately secured Admin application.

## Decision

Use Next.js, React and strict TypeScript for both Consumer and Admin, as distinct apps, artifacts, origins, deployments and session realms. Share only safe UI primitives, types, validation and configuration. Retain standard Node/OCI deployment compatibility and explicitly control private caching.

## Alternatives

- React SPA: good feed UX but weaker initial public rendering/SEO and more client bootstrap work.
- Remix: credible web-first alternative, but less aligned with the selected ecosystem/team preference.
- Native mobile: duplicates V1 scope and does not satisfy the primary Web/PWA decision.

## Consequences

WYN gains one frontend skill set and flexible server/client rendering. Next upgrades and cache semantics require careful review; API domain logic and authorization must not migrate into page handlers.
