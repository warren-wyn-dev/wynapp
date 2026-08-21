import { describe, expect, it } from 'vitest';
import { FoundationWorker } from './worker.js';
describe('worker bootstrap', () => {
  it('starts without product jobs', async () => {
    const worker = new FoundationWorker('test-worker');
    await worker.start();
    expect(worker.status).toMatchObject({ state: 'running', processed: 0 });
    worker.stop();
    expect(worker.status.state).toBe('stopped');
  });
});
