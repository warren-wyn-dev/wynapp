# CI/CD foundation

The pull-request workflow performs a frozen pnpm install, lint, strict typecheck, unit tests, available integration tests, builds, and a high-severity dependency audit. GitHub Actions receive read-only repository permissions. The workflow does not deploy, merge, or mutate branches. Staging and production release workflows are intentionally absent and require later approval.
