# Step 12 quality-gate compatibility fixes

These changes are deliberately limited to defects exposed while running the existing Step 10 and repository-wide gates against PostgreSQL 16:

- Comment deletion now writes the non-empty internal tombstone `[deleted]` before setting `deleted_at`; the existing read query still returns `body = null`, so the public behavior is unchanged while satisfying the original database constraint.
- The engagement PostgreSQL adapter retains its existing narrowly scoped driver-row lint annotations, and the control-character validator documents its intentional control-code regular expression.
- Integration fixtures now provide the required explicit `GLOBAL_PUBLIC` scope and isolate records between tests; no engagement product behavior changed.
- Existing Web engagement helpers now parse typed response envelopes and handle rejected promises without empty catch blocks. `DropComposer` retains its draft identifier as a DOM data attribute, and the Saved page narrows its response envelope. These are compile/lint compatibility changes only.
- The existing Sharp 0.35 declaration shim is isolated from type-aware ESLint because Sharp's ESM export map does not expose its bundled declaration path. Runtime media tests and TypeScript compilation remain required and unchanged.
- Existing Step 11 discovery fixtures are isolated and use explicit PostgreSQL enum/timestamp casts. Ranking notification event queries likewise cast ranking-window parameters explicitly. These changes remove PostgreSQL ambiguity without changing ranking formulas.
