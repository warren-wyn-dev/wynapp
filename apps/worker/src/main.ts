import { createServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import {
  MediaService,
  MediaWorker,
  createS3MediaStorageFromEnv,
} from '@wyn/media';
import { createSentryErrorCapture, noopErrorCapture } from '@wyn/observability';
import pg from 'pg';
import { z } from 'zod';
import { NotificationWorker, workerLogger } from './worker.js';

const config = z
  .object({
    WORKER_ID: z.string().min(1).default('local-worker'),
    WYN_ENV: z.string().default('development'),
    DATABASE_URL: z.string().min(1),
    WORKER_HEALTH_PORT: z.coerce.number().int().min(1).max(65535).default(4100),
    WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(1000),
    OBSERVABILITY_DSN: z.string().min(1).optional(),
  })
  .parse(process.env);
const errorCapture = config.OBSERVABILITY_DSN
  ? createSentryErrorCapture(config.OBSERVABILITY_DSN, config.WYN_ENV)
  : noopErrorCapture;

const pool = new pg.Pool({ connectionString: config.DATABASE_URL });
const notificationWorker = new NotificationWorker(pool);
const storage = createS3MediaStorageFromEnv(process.env);
const mediaWorker = storage
  ? new MediaWorker(pool, new MediaService(pool, storage))
  : undefined;
if (!mediaWorker)
  workerLogger.warn(
    {},
    'OBJECT_STORAGE_* is not configured; media processing is disabled',
  );

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

// Moves newly-written outbox_events into each consumer's delivery queue,
// then repeatedly claims and processes one at a time (short leases, up to
// five attempts before dead-lettering — see [Notification|Media]Worker's
// runOnce). These loops are what actually turn "someone liked your Drop"
// into a `notifications` row, and an uploaded image into ready variants;
// previously nothing in the deployable apps/worker process called either.
async function loop(name: string, step: () => Promise<string>): Promise<void> {
  while (!stopping) {
    try {
      const result = await step();
      if (result === 'IDLE') await delay(config.WORKER_POLL_INTERVAL_MS);
    } catch (error) {
      // A single bad claim/dispatch attempt (e.g. a transient connection
      // error, or the schema not being ready yet during a deploy/migration)
      // must not take the whole process down — back off and keep polling.
      workerLogger.error(
        { err: error, consumer: name },
        'dispatch loop iteration failed',
      );
      errorCapture.capture(error, { consumer: name });
      await delay(config.WORKER_POLL_INTERVAL_MS);
    }
  }
}

workerLogger.info({ workerId: config.WORKER_ID }, 'worker starting');
await Promise.all([
  loop('notifications', async () => {
    await notificationWorker.dispatch();
    return notificationWorker.runOnce();
  }),
  mediaWorker
    ? loop('media', async () => {
        await mediaWorker.dispatch();
        return mediaWorker.runOnce();
      })
    : Promise.resolve(),
]);
health.close();
await pool.end();
