# Git Workflow

## Authorization and Safety

- AI roles may inspect and modify repository files only when explicitly authorized.
- Do not commit, push, merge, force-push, rewrite shared history, tag a release, or deploy unless the Founder explicitly authorizes that specific action.
- Never force-push a production branch. Never bypass branch protection or required reviews.
- Approval is scoped: permission to edit is not permission to commit; permission to commit is not permission to push, merge, or deploy.

## Branches

- Start from the current approved base and use a short-lived branch dedicated to one coherent change.
- Use a descriptive branch name such as `feature/<topic>`, `fix/<topic>`, `docs/<topic>`, or `chore/<topic>` when branch creation is authorized.
- Keep the branch current through the team's approved update method. Do not rewrite a shared branch.
- Keep application changes, migrations, generated artifacts, and operating-system changes reviewable and intentional.

## Commits

- Commit only when explicitly authorized and only after reviewing `git status` and the staged diff.
- Each commit should be focused, buildable where feasible, and free of secrets, credentials, unrelated formatting, debug output, and accidental generated files.
- Use an imperative subject that explains the outcome; add a body for rationale, risks, migrations, compatibility, or follow-up.
- Do not misrepresent test results or authorship and do not disable hooks or checks without an approved, documented reason.

## Review

A change request should describe:

- the approved problem and scope, including explicit non-goals;
- the approach and important decisions;
- security, privacy, data, UX, accessibility, performance, and operational impact as applicable;
- tests run and their exact outcomes;
- rollout, migration, monitoring, and rollback plans when relevant; and
- linked approvals, known risks, and follow-up work.

Reviewers check requirements, architecture, authorization, validation, tests, compatibility, maintainability, observability, and absence of secrets or unrelated changes. Authors resolve feedback or record the reason for disagreement; required reviewers must approve before merge.

## Merge and Release

- Merge only with explicit authorization, passing required checks, required reviews, and resolved blocking findings.
- Use the repository's approved merge strategy; do not silently alter history.
- A merge does not authorize deployment. Production follows Development → Testing → Security Review → Staging → Founder Approval → Production.
- Production deployment requires explicit Founder approval for the exact staged release and a viable rollback plan.

## Emergency Changes

Emergency work follows the same security and Founder-authority boundaries. Minimize scope, preserve evidence, obtain the approvals possible under the approved incident process, validate and monitor the change, and complete retrospective review and documentation afterward. Destructive production actions still require explicit Founder approval unless a Founder-approved runbook explicitly pre-authorizes the precise action.
