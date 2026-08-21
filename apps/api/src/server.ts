import { z } from 'zod';
import { createDatabase } from '../../../packages/database/src/index.js';
import { buildApp } from './app.js';
import { DevelopmentEmailAdapter, ProductionEmailAdapter } from './email.js';

const config = z
  .object({
    WYN_ENV: z.string().default('development'),
    DATABASE_URL: z.string().min(1),
    API_HOST: z.string().default('127.0.0.1'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    APP_ORIGIN: z.string().default('http://localhost:3000'),
    ADMIN_ORIGIN: z.string().default('http://localhost:3001'),
  })
  .parse(process.env);
const database = createDatabase({
  databaseUrl: config.DATABASE_URL,
  environment: config.WYN_ENV,
});
const email =
  config.WYN_ENV === 'production'
    ? new ProductionEmailAdapter()
    : new DevelopmentEmailAdapter();
const app = await buildApp({
  pool: database.pool,
  email,
  allowedOrigins: [config.APP_ORIGIN, config.ADMIN_ORIGIN],
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
