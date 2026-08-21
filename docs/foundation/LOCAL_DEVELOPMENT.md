# Local development

## Requirements

- Node.js 20 LTS or newer supported LTS
- pnpm 10.28.1 (pinned in `package.json`)
- PostgreSQL for database work; UI and probe smoke tests do not require it

Copy only the needed `.env.example` file to an ignored `.env.local` or process environment and provide local values. Never commit credentials. Install with `corepack enable && pnpm install`.

Run everything with `pnpm dev`, or one boundary with:

- Consumer: `pnpm --filter @wyn/web dev` (port 3000)
- Admin: `pnpm --filter @wyn/admin dev` (port 3001)
- API: `pnpm --filter @wyn/api dev` (port 4000)
- Worker: `pnpm --filter @wyn/worker dev`

Use `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` before review. Database commands require an explicit `DATABASE_URL`; use `pnpm --filter @wyn/database db:generate` and `db:migrate`. There is no automatic schema synchronization.
