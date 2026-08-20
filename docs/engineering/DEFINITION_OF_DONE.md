# Definition of Done

Work is not complete merely because implementation has stopped. The accountable owner must verify every applicable item below and mark non-applicable items with a reason.

## Scope and Acceptance

- [ ] Work traces to Founder intent and approved requirements.
- [ ] Acceptance criteria and required P0/P1 scope are satisfied.
- [ ] Explicit non-goals remain out of scope; no major feature was invented.
- [ ] Edge cases, failure modes, and backward compatibility were considered.
- [ ] Any scope change received Product Manager review and required Founder approval.

## Design and Implementation

- [ ] CTO and Software Architect reviews required by risk are complete.
- [ ] The implementation follows approved architecture and clear module boundaries without needless complexity.
- [ ] UI behavior is mobile-first, accessible, responsive, and includes applicable loading, empty, error, success, and disabled states.
- [ ] Data ownership, constraints, integrity, performance, migration, backup, and rollback concerns are addressed.
- [ ] Strong typing, validation, clear error handling, reuse, and relevant documentation are present.
- [ ] Existing working functionality is preserved except where an approved requirement changes it.

## Security and Privacy

- [ ] Protected actions authenticate and authorize server-side at resource and action level.
- [ ] Client and external input is validated at trusted boundaries.
- [ ] Sensitive data is minimized and protected in storage, transit, output, logs, analytics, caches, and errors.
- [ ] No secrets, credentials, private production data, or unsafe debug artifacts are in the diff.
- [ ] Applicable cross-user, direct API, privacy/block bypass, permission escalation, abuse/rate-limit, and malicious upload tests pass.
- [ ] QA & Security reviewed the risk; no unresolved CRITICAL finding exists.

## Verification and Quality

- [ ] Appropriate unit, integration, end-to-end, regression, negative, and manual tests pass.
- [ ] Applicable formatter, linter, type checker, build, dependency, and security checks pass.
- [ ] Test commands and outcomes are recorded truthfully; skipped or unavailable checks have reasons and owners.
- [ ] Performance expectations for important paths are met or an approved risk is recorded.
- [ ] The complete diff was self-reviewed and contains no unrelated changes.

## Documentation and Operations

- [ ] User, API, engineering, operational, and decision documentation is updated as applicable.
- [ ] Consequential decisions record context, alternatives, consequences, and reversal considerations.
- [ ] Monitoring, privacy-safe logging, alerting, backup, recovery, rollout, and rollback are ready when applicable.
- [ ] Migration and deployment steps are repeatable and the exact releasable artifact is identifiable.
- [ ] Known debt and residual risks have owners, priority, rationale, and follow-up dates.

## Review and Release Gates

- [ ] Required role reviews and automated checks are complete.
- [ ] CTO final technical review is complete.
- [ ] The reviewed artifact passes staging smoke and release checks.
- [ ] DevOps / SRE confirms system-health validation and rollback capability.
- [ ] Founder approval is explicitly recorded for production and every other change-controlled action.
- [ ] Post-deployment verification is defined; production release is not called complete until health is confirmed.

If any required box is unchecked, the work remains in progress or returns to the responsible workflow stage.
