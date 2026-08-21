# Monorepo setup

WYN uses one pnpm workspace and Turborepo task graph. Deployable boundaries are `apps/web`, `apps/admin`, `apps/api`, and `apps/worker`. Shared infrastructure packages are under `packages`; package exports prevent importing unexposed internals. Consumer and Admin are separate Next.js builds and must not share session configuration.

Root tasks run through Turbo. TypeScript extends `tsconfig.base.json` with strict and additional safety checks. ESLint and Prettier are configured once at the repository root.
