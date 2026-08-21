# Step 15 Admin, Safety, and Moderation API

Step 15 adds a separate Admin-session boundary under `/admin/v1`. A Consumer cookie is never accepted as Admin authentication. Admin authorization uses server-loaded roles and granular permission bundles; client-supplied roles are ignored.

Consumer users submit confidential reports with `POST /v1/reports` for User, Drop, Comment, Club, or Message targets. Admin report queues omit reporter identity. Authorized staff use `GET /admin/v1/reports`, `POST /admin/v1/reports/:id/case`, and `POST /admin/v1/cases/:id/actions`.

Sensitive actions require an Admin CSRF token and a password step-up no more than ten minutes old. Actions require bounded reasons, optimistic case versions, and idempotency keys. Each committed case creation and moderation action writes an append-only audit event in the same PostgreSQL transaction. Consumer sessions are revoked for suspension and ban.

The role bundles are deny-by-default. Club membership roles never confer platform Admin permissions. OWNER-only role administration is distinct from SUPPORT access; MODERATOR cannot ban or perform role/feature-flag/audit administration.
