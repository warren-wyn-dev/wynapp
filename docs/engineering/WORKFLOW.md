# Engineering Workflow

## Standard Flow

Founder → Product Manager → CTO → Software Architect → UI/UX Engineer + Database Engineer → Full-Stack Engineer → QA & Security Engineer → CTO final review → Staging → Founder approval → Production.

The flow is a set of accountable gates, not a waterfall prohibition: roles should collaborate early, and a failed review returns work to the appropriate earlier stage.

## Stage Outputs

1. **Founder intent:** The Founder supplies the goal and retains final authority over product and change-controlled decisions.
2. **Product definition:** The Product Manager records the problem, users, in/out scope, P0/P1/P2 priority, user stories, acceptance criteria, edge cases, dependencies, and unresolved decisions. No major feature is inferred.
3. **CTO triage:** The CTO assigns owners and reviewers, checks feasibility and risk, prevents needless complexity, and identifies Founder approval gates.
4. **Technical design:** The Software Architect defines a minimal design and its trust/module boundaries. Consequential choices are documented; major choices wait for Founder approval.
5. **Domain design:** UI/UX specifies accessible mobile-first states and interactions. Database specifies data ownership, integrity, migration, performance, and recovery considerations. Either marks “not applicable” with a reason when its domain is untouched.
6. **Implementation:** The Full-Stack Engineer works only to approved requirements/design, adds appropriate tests, documents important behavior, and self-reviews the diff.
7. **QA and security:** QA & Security validates acceptance criteria, regression risk, abuse paths, authentication, authorization, privacy, and operational edge cases. Findings include severity and reproduction steps; CRITICAL issues block release.
8. **CTO final review:** The CTO confirms scope, technical quality, security, performance, scalability, operability, and debt are acceptable and required approvals exist.
9. **Staging:** DevOps / SRE deploys the reviewed artifact, runs smoke and release checks, verifies observability and rollback, and records the artifact/version tested.
10. **Founder approval:** The Founder explicitly approves that staged artifact for production. Silence is not approval.
11. **Production:** DevOps / SRE deploys the approved artifact through the controlled process, validates health, and rolls back when release criteria fail.

## Handoffs and Decisions

- Each handoff links the approved inputs, output artifact, open risks, test evidence, and accountable next owner.
- Assumptions are labeled. Blocking ambiguity is returned to the Product Manager or Founder.
- Important technical decisions record context, options, decision, consequences, owner, date, and rollback/reversal considerations.
- Scope changes return to Product Manager review; major scope changes require Founder approval.
- Security concerns may stop work at any stage and go to QA & Security and the CTO.
- Production incidents prioritize containment and recovery; destructive action still requires the applicable approval unless an explicitly pre-approved runbook covers it.

## Priority Meaning

- **P0:** Essential to safe operation or the agreed release goal; blocks release when unmet.
- **P1:** Important to the intended outcome; schedule explicitly if not in the current release.
- **P2:** Useful but deferrable; must not displace approved higher-priority scope.
