import { z } from 'zod';
import { FoundationWorker, workerLogger } from './worker.js';
const { WORKER_ID } = z
  .object({ WORKER_ID: z.string().min(1).default('local-worker') })
  .parse(process.env);
const worker = new FoundationWorker(WORKER_ID);
const stop = (signal: string) => {
  workerLogger.info({ signal, workerId: WORKER_ID }, 'worker stopping');
  worker.stop();
};
process.once('SIGINT', () => stop('SIGINT'));
process.once('SIGTERM', () => stop('SIGTERM'));
workerLogger.info({ workerId: WORKER_ID }, 'worker starting');
await worker.start();
