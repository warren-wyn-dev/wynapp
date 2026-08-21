import { createServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';
import { z } from 'zod';
import { NotificationWorker, workerLogger } from './worker.js';

const config = z
  .object({
    WORKER_ID: z.string().min(1).default('local-worker'),
    DATABASE_URL: z.string().min(1),
    WORKER_HEALTH_PORT: z.coerce.number().int().min(1).max(65535).default(4100),
    WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(1000),
  })
  .parse(process.env);

const pool = new pg.Pool({ connectionString: config.DATABASE_URL });
const notificationWorker = new NotificationWorker(pool);

const health = createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok' }));
});
health.listen(config.WORKER_HEALTH_PORT);

let stopping = false;
function stop(signal: string) {
  workerLogger.info({ signal, workerId: config.WORKER_ID }, 'worker stopping');
  stopping = true;
}
process.once('SIGINT', () => stop('SIGINT'));
process.once('SIGTERM', () => stop('SIGTERM'));

workerLogger.info({ workerId: config.WORKER_ID }, 'worker starting');
// Moves newly-written outbox_events into the notifications delivery queue,
// then repeatedly claims and processes one at a time (short leases, up to
// five attempts before dead-lettering — see NotificationWorker.runOnce).
// This loop is the thing that actually turns "someone liked your Drop"
// into a row in `notifications`; previously nothing in the deployable
// apps/worker process called it at all.
while (!stopping) {
  try {
    await notificationWorker.dispatch();
    const result = await notificationWorker.runOnce();
    if (result === 'IDLE') await delay(config.WORKER_POLL_INTERVAL_MS);
  } catch (error) {
    // A single bad claim/dispatch attempt (e.g. a transient connection
    // error, or the schema not being ready yet during a deploy/migration)
    // must not take the whole process down — back off and keep polling.
    workerLogger.error({ err: error }, 'dispatch loop iteration failed');
    await delay(config.WORKER_POLL_INTERVAL_MS);
  }
}
health.close();
await pool.end();
