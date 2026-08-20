# ADR-014: Vitest, PostgreSQL Integration Tests and Playwright

## Status

**ACCEPTED** — Founder-approved for WYN V1.0.0.

## Context

WYN needs fast TypeScript feedback plus realistic database, authorization, realm, upload and browser security coverage.

## Decision

Use Vitest for unit/component/application tests, disposable real PostgreSQL for integration tests, and Playwright projects for separate Consumer and Admin E2E. Add static, dependency, secret and security regression gates in GitHub Actions.

## Alternatives

- Jest: mature, but Vitest aligns with modern ESM/TypeScript tooling and has faster configuration for this stack.
- Cypress: capable browser testing, but Playwright provides strong multi-browser/context and parallel support.
- SQLite/mocked repositories only: cannot validate PostgreSQL transactions, constraints, FTS or outbox locking.

## Consequences

The suite covers realistic failure and authorization behavior. CI needs a PostgreSQL service and browser capacity; fixtures must be isolated/deterministic and security gates cannot be bypassed by retries.
