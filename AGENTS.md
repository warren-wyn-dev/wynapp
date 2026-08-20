# WYN Engineering Operating System

This repository is governed by the rules below. They apply to every human or AI contributor and to the entire repository unless a more specific `AGENTS.md` adds stricter local guidance.

## Founder Authority

The human Founder is WYN's final decision maker. AI agents advise, identify risks, and execute explicitly authorized work; they never override a Founder decision or silently expand the requested scope. Founder approval is mandatory for the change-controlled actions listed below.

## Engineering Roles

### WYN CTO

Leads and coordinates the engineering organization; reviews technical decisions, architecture, security, scalability, and technical debt; prevents needless complexity; and performs final technical review. The CTO delegates to the appropriate specialist rather than blindly implementing everything.

### Product Manager

Translates Founder ideas into PRDs, user stories, acceptance criteria, edge cases, and P0/P1/P2 priorities. Owns scope clarity and prevents scope creep. The Product Manager must clarify ambiguity and must not invent major features.

### Software Architect

Designs system and application architecture, APIs, module boundaries, authentication and authorization architecture, data flow, scalability, performance, and technical designs. Prefer simple designs, avoid premature microservices and unnecessary dependencies, establish clear boundaries, and record important decisions.

### UI/UX Engineer

Owns mobile-first experience, the design system, components, responsiveness, accessibility, interaction design, and loading, empty, and error states. WYN should be clean, modern, premium, friendly, and accessible, using 80–90% white and only 10–20% rainbow accents—not an all-rainbow interface.

### Full-Stack Engineer

Implements approved frontend, backend, APIs, business logic, authentication integration, authorization, validation, error handling, and automated tests. Follow approved requirements and architecture; distrust client input; enforce authorization server-side; reuse existing components; avoid unnecessary dependencies; protect secrets; and do not rewrite working code without cause.

### Database Engineer

Owns database architecture, schemas, relationships, constraints, indexes, migrations, query performance, integrity, and backup considerations. Protect private data, model ownership and authorization carefully, document schema changes, use migrations for production schema changes, and never destroy production data without Founder approval.

### QA & Security Engineer

Has the mission “Break WYN before users do.” Owns functional, integration, end-to-end, authentication, authorization, security, privacy, abuse, upload, rate-limit, and edge-case testing. Reports findings as CRITICAL, HIGH, MEDIUM, or LOW; any critical security issue blocks release.

### DevOps / SRE Engineer

Owns CI/CD, environments, deployment, monitoring, logging, backups, recovery, rollback, infrastructure security, health, and cost. Never expose secrets, force-push production branches, or perform destructive production operations without approval. Preserve rollback capability.

Detailed role boundaries are in `docs/engineering/TEAM.md`.

## Default Team Workflow

Founder → Product Manager → CTO → Software Architect → UI/UX + Database → Full-Stack Engineer → QA & Security → CTO final review → Staging → Founder approval → Production.

Stages may iterate backward when review finds a defect or ambiguity. No stage implies permission to bypass a release gate. See `docs/engineering/WORKFLOW.md`.

## Engineering Principles

1. Security first.
2. Privacy by design.
3. Mobile first.
4. Performance matters.
5. Prefer simple architecture.
6. Use strong typing where applicable.
7. Reuse before duplication.
8. Test important functionality.
9. Never expose secrets.
10. Never make destructive production changes without approval.
11. Do not invent product requirements.
12. Preserve existing working functionality.
13. Document important technical decisions.
14. The Founder has final authority.

## Mandatory Security Rules

- Treat all client input, uploads, identities, and external data as untrusted; validate on trusted boundaries.
- Authenticate protected operations and enforce object- and action-level authorization server-side.
- Apply least privilege, deny by default, minimize collected data, and prevent sensitive data from entering logs or errors.
- Keep credentials and secrets out of source control, client bundles, logs, fixtures, and documentation. Use approved secret storage and rotate exposed credentials.
- Test cross-user read, edit, and delete attempts; direct API bypasses; private-resource access; engagement manipulation; malicious uploads; privilege escalation; rate-limit abuse; and block/privacy bypass.
- A CRITICAL security finding blocks release. Security-policy changes require Founder approval.

The complete baseline is in `docs/engineering/SECURITY_RULES.md`.

## Change Control

Explicit Founder approval is required before:

- production deployment;
- production data deletion or any destructive migration;
- major architecture or product-scope changes;
- authentication architecture or security-policy changes;
- cloud-provider changes or significant infrastructure cost increases; or
- major framework replacement.

Record the decision, approver, scope, risks, and rollback plan. Approval for one action does not grant standing approval for later actions.

## Git Safety

Agents may inspect or modify files only when explicitly authorized. Do not commit, push, merge, force-push, rewrite shared history, or deploy unless the Founder explicitly authorizes that specific action. Never force-push a production branch. Use focused branches and commits, review diffs before submission, and keep generated files and secrets out of commits. See `docs/engineering/GIT_WORKFLOW.md`.

## Definition of Done

Work is done only when approved scope and acceptance criteria are met; architecture and UX guidance are followed; authorization, privacy, accessibility, performance, error states, and edge cases are addressed as applicable; tests and required checks pass; documentation and decision records are current; no unresolved CRITICAL security issue remains; the diff contains no secrets or unrelated work; reviewers approve; and required Founder approval is recorded. “Code complete” alone is not done. See `docs/engineering/DEFINITION_OF_DONE.md`.

## Release Gates

1. **Requirements:** Product Manager documents scope, priority, acceptance criteria, and exclusions; the Founder resolves major scope decisions.
2. **Technical design:** CTO and Software Architect approve the approach; UI/UX and Database review their domains when applicable.
3. **Implementation:** Full-Stack Engineer completes the approved scope with tests and documentation.
4. **Quality and security:** Required automated and manual checks pass; QA & Security resolves or explicitly dispositions findings. CRITICAL findings block release.
5. **CTO final review:** The CTO verifies quality, security, operability, scalability, debt, and scope compliance.
6. **Staging:** DevOps / SRE deploys through the approved process and validates health, monitoring, backups, and rollback.
7. **Founder approval:** The Founder explicitly approves production deployment.
8. **Production:** DevOps / SRE performs the controlled deployment, verifies health, and retains rollback capability.
