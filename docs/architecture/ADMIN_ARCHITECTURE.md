# WYN Admin Architecture

**Status:** PROPOSED; the final permission matrix, stronger authentication and retention require FD-14.

## Separation and capabilities

WYN Admin is a separate build, deployment, origin, session realm and authorization boundary. It uses `/admin/v1/` only; the API rejects Consumer sessions and applies a dedicated CORS/CSRF/rate-limit policy. It provides Dashboard, User Management, Content/Drop Management, Club Management, Report Center, Moderation, Appeals, Announcements, Audit Logs, Basic Analytics and Feature Flags. It orchestrates domain interfaces rather than directly editing consumer-owned tables.

Admin principals receive one or more roles (`OWNER`, `SUPER_ADMIN`, `MODERATOR`, `SUPPORT`, `ANALYST`, `CONTENT_ADMIN`) mapped to versioned granular permissions and optional scopes. The policy engine checks named action + target + scope + current assignment; OWNER is not a universal hard-coded bypass. UI menu visibility is convenience only.

## Sensitive-action protocol

Actions including restrict/suspend/ban, content removal, role/permission changes, appeal resolution, announcement publication, feature-flag mutation, evidence export and audit access require as appropriate:

1. separate active Admin session and recent step-up authentication;
2. current granular permission and conflict/assignment check;
3. validated target/version and mandatory bounded reason/category;
4. confirmation for high-impact/bulk actions and idempotency key;
5. atomic domain command plus append-only audit/outbox fact recording actor, target, permission, reason, before/after-safe state, request/correlation ID, timestamp and result;
6. notification/review workflow without exposing reporter identity or unnecessary personal data.

Four-eyes approval should be available for the highest-impact changes, but exact required actions await FD-14. Admin cannot delete or modify audit records through normal interfaces.

## Data minimization and operational safety

Dashboard/analytics uses aggregated read models. Support sees only fields needed for assigned work; message evidence is case-bound and audited, never generally searchable. Exports are permissioned, time-limited and audited. Lists use cursor pagination and field-level redaction. Impersonation is excluded unless separately Founder-approved and threat-modeled.

Feature flags have environment, type, safe default, enabled state, rollout constraints, owner and version. Changes require permission, confirmation, reason and audit. Flags fail closed for unreleased features and never replace authorization. Announcements likewise use draft/review/publish state and cannot inject arbitrary executable markup.

## Failure and recovery

Optimistic versions prevent stale moderator decisions. Repeated requests return the stored idempotent result. Partial downstream notification failure does not undo a durable moderation action. Emergency access, break-glass, admin recovery, retention and permission bundles must be approved, tightly time-bound, alerted and reviewed before implementation.
