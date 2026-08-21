import { createLogger } from '@wyn/observability';
export interface OutboxMessage {
  id: string;
  type: string;
  payload: unknown;
}
export interface OutboxConsumer {
  next(signal: AbortSignal): Promise<OutboxMessage | null>;
  acknowledge(id: string): Promise<void>;
}
export interface IdempotencyStore {
  has(key: string): Promise<boolean>;
  record(key: string): Promise<void>;
}
export interface RetryPolicy {
  delays: readonly number[];
}
export class FoundationWorker {
  readonly status = {
    state: 'idle' as 'idle' | 'running' | 'stopped',
    processed: 0,
  };
  private readonly controller = new AbortController();
  constructor(
    readonly identity: string,
    private readonly consumer?: OutboxConsumer,
    private readonly idempotency?: IdempotencyStore,
  ) {}
  async start(): Promise<void> {
    this.status.state = 'running';
    if (!this.consumer) return;
    while (!this.controller.signal.aborted) {
      const message = await this.consumer.next(this.controller.signal);
      if (!message) break;
      if (!(await this.idempotency?.has(message.id))) {
        await this.idempotency?.record(message.id);
        this.status.processed++;
      }
      await this.consumer.acknowledge(message.id);
    }
  }
  stop(): void {
    this.controller.abort();
    this.status.state = 'stopped';
  }
}
export const workerLogger: ReturnType<typeof createLogger> =
  createLogger('worker');
export const defaultRetryPolicy: RetryPolicy = { delays: [1000, 5000, 30000] };
