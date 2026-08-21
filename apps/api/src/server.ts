import { buildApp } from './app.js';
import { z } from 'zod';
const config = z
  .object({
    API_HOST: z.string().default('127.0.0.1'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
    ADMIN_ORIGIN: z.string().url().default('http://localhost:3001'),
  })
  .parse(process.env);
const app = await buildApp({
  allowedOrigins: [config.WEB_ORIGIN, config.ADMIN_ORIGIN],
});
let stopping = false;
async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  app.log.info({ signal }, 'graceful shutdown');
  await app.close();
}
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
try {
  await app.listen({ host: config.API_HOST, port: config.API_PORT });
} catch (error) {
  app.log.fatal({ err: error }, 'startup failed');
  process.exitCode = 1;
}
