import { z } from 'zod';
import { createDatabase } from '../../../packages/database/src/index.js';
import { createS3MediaStorageFromEnv } from '../../../packages/media/src/storage.js';
import {
  createSentryErrorCapture,
  noopErrorCapture,
} from '../../../packages/observability/src/index.js';
import { buildApp } from './app.js';
import type { EmailAdapter } from './email.js';
import { DevelopmentEmailAdapter, ResendEmailAdapter } from './email.js';

const config = z
  .object({
    WYN_ENV: z.string().default('development'),
    DATABASE_URL: z.string().min(1),
    API_HOST: z.string().default('127.0.0.1'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    APP_ORIGIN: z.string().default('http://localhost:3000'),
    ADMIN_ORIGIN: z.string().default('http://localhost:3001'),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().optional(),
    RESEND_API_KEY: z.string().min(1).optional(),
    EMAIL_FROM: z.string().min(1).optional(),
    DEV_EMAIL_LOG_PATH: z.string().min(1).optional(),
    OBSERVABILITY_DSN: z.string().min(1).optional(),
  })
  .parse(process.env);
const database = createDatabase({
  databaseUrl: config.DATABASE_URL,
  environment: config.WYN_ENV,
});
const email: EmailAdapter = (() => {
  if (config.WYN_ENV !== 'production')
    return new DevelopmentEmailAdapter(config.DEV_EMAIL_LOG_PATH);
  // Fail at startup, not on the first user's registration request, if
  // production is misconfigured.
  if (!config.RESEND_API_KEY || !config.EMAIL_FROM)
    throw new Error(
      'RESEND_API_KEY and EMAIL_FROM are required when WYN_ENV=production',
    );
  return new ResendEmailAdapter(
    config.RESEND_API_KEY,
    config.EMAIL_FROM,
    config.APP_ORIGIN,
  );
})();
const storage = createS3MediaStorageFromEnv(process.env);
// Absence degrades observability, not user-facing behavior (unlike email),
// so this stays a soft fallback rather than a startup failure.
const errorCapture = config.OBSERVABILITY_DSN
  ? createSentryErrorCapture(config.OBSERVABILITY_DSN, config.WYN_ENV)
  : noopErrorCapture;
const app = await buildApp({
  pool: database.pool,
  email,
  errorCapture,
  allowedOrigins: [config.APP_ORIGIN, config.ADMIN_ORIGIN],
  ...(storage ? { storage } : {}),
  // Only honored outside production, so a stray env var can never weaken
  // the real auth rate limit; non-production runners (CI/E2E) that do many
  // scripted logins in a short window can raise it explicitly.
  ...(config.WYN_ENV !== 'production' && config.AUTH_RATE_LIMIT_MAX
    ? { authRateLimitMax: config.AUTH_RATE_LIMIT_MAX }
    : {}),
});
let stopping = false;
async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  app.log.info({ signal }, 'graceful shutdown');
  await app.close();
  await database.close();
}
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
try {
  await app.listen({ host: config.API_HOST, port: config.API_PORT });
} catch (error) {
  app.log.fatal({ err: error }, 'startup failed');
  await database.close();
  process.exitCode = 1;
}
