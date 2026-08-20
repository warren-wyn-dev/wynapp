# Coding Standards

These standards apply when future application work is explicitly authorized. They do not choose a language, framework, architecture, or dependency.

## Scope and Design

- Implement only approved requirements and acceptance criteria. State assumptions; do not convert them into features.
- Prefer the smallest clear solution. Reuse established modules and components before creating alternatives.
- Preserve working behavior and public contracts unless an approved change explicitly replaces them.
- Keep modules cohesive, dependencies directional, interfaces narrow, and names descriptive.
- Avoid speculative abstractions, premature microservices, unnecessary dependencies, and unrelated rewrites.
- Document important decisions and non-obvious trade-offs close to the relevant decision record or code.

## Correctness and Types

- Use strong typing where the chosen platform supports it; avoid unsafe escape hatches without a documented reason.
- Validate data at trust boundaries and model invalid states out where practical.
- Handle expected failures deliberately. Do not hide errors or leak sensitive internals to users.
- Make side effects, ownership, authorization checks, and transaction boundaries explicit.
- Consider concurrency, retries, idempotency, time zones, localization, pagination, and partial failure when relevant.

## Security and Privacy

- Never trust client-side validation or authorization. Repeat enforcement in trusted server-side code.
- Never hard-code or log secrets, tokens, private data, or sensitive authentication material.
- Collect, expose, and retain only data required by approved product behavior.
- Use safe platform APIs for output encoding, queries, cryptography, file handling, and network calls; do not invent security primitives.
- Follow `SECURITY_RULES.md` and request QA & Security review for changes affecting trust boundaries.

## User Experience and Accessibility

- Build mobile-first and progressively enhance larger layouts.
- Reuse the design system and implement specified loading, empty, error, success, disabled, and offline states as applicable.
- Support keyboard use, visible focus, semantic structure, accessible names, adequate contrast, touch targets, and reduced motion where relevant.
- Preserve the WYN visual direction: predominantly white with restrained rainbow accents.

## Performance and Operability

- Define relevant performance expectations before optimization; measure important paths rather than guessing.
- Avoid unbounded reads, unnecessary network round trips, wasteful rendering, and hidden expensive work.
- Produce actionable, privacy-safe errors, logs, metrics, and traces where the approved architecture provides them.
- Keep changes compatible with deployment, rollback, and data-migration plans.

## Tests and Reviews

- Add tests proportional to risk: unit tests for logic, integration tests for boundaries, and end-to-end tests for critical journeys.
- Include negative authorization and validation cases, not only successful paths.
- Keep tests deterministic, isolated, readable, and behavior-focused.
- Before review, run applicable formatting, linting, type, test, build, and security checks; document failures or unavailable checks.
- Self-review the complete diff for unrelated changes, generated noise, debug code, sensitive data, and missing documentation.

## Dependencies

- Prefer platform or existing capabilities. A new dependency needs a concrete use, maintenance and security assessment, compatible license, and approval appropriate to its impact.
- Major framework replacement requires Founder approval.
- Pin and update dependencies according to the future approved toolchain; do not suppress known vulnerabilities without a recorded risk decision.
