import { createLogger } from '@wyn/observability';
/* PostgreSQL driver rows are narrowed by the worker's fixed claim query. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import type { Pool } from 'pg';
import { NotificationService } from '@wyn/notifications';
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

const notificationEvents = [
  'DropLiked',
  'CommentCreated',
  'CommentReplied',
  'DropReDropped',
  'QuoteReDropCreated',
  'UserFollowed',
  'FollowRequested',
  'FollowRequestApproved',
  'UserMentioned',
  'TrendingAchieved',
  'Top100Achieved',
  'SystemAnnouncementPublished',
];
/** PostgreSQL is the queue. Claim leases are short and failures become visible dead letters after five attempts. */
export class NotificationWorker {
  private readonly service: NotificationService;
  constructor(private readonly pool: Pool) {
    this.service = new NotificationService(pool);
  }
  async dispatch(): Promise<number> {
    const q = await this.pool.query(
      `WITH pending AS (SELECT id FROM outbox_events WHERE dispatched_at IS NULL AND event_type=ANY($1::text[]) ORDER BY occurred_at LIMIT 100 FOR UPDATE SKIP LOCKED), deliveries AS (INSERT INTO outbox_deliveries(event_id,consumer) SELECT id,'notifications' FROM pending ON CONFLICT DO NOTHING) UPDATE outbox_events SET dispatched_at=now() WHERE id IN(SELECT id FROM pending) RETURNING id`,
      [notificationEvents],
    );
    return q.rowCount ?? 0;
  }
  async runOnce(): Promise<'IDLE' | 'DELIVERED' | 'RETRY' | 'DEAD_LETTER'> {
    const claimed = await this.pool.query(
      `UPDATE outbox_deliveries SET locked_until=now()+interval '30 seconds' WHERE (event_id,consumer)=(SELECT event_id,consumer FROM outbox_deliveries WHERE consumer='notifications' AND delivered_at IS NULL AND dead_lettered_at IS NULL AND available_at<=now() AND (locked_until IS NULL OR locked_until<now()) ORDER BY available_at,event_id LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING event_id,attempt_count`,
    );
    if (!claimed.rowCount) return 'IDLE';
    const row = claimed.rows[0];
    try {
      await this.service.processEvent(row.event_id);
      await this.pool.query(
        "UPDATE outbox_deliveries SET delivered_at=now(),locked_until=NULL WHERE event_id=$1 AND consumer='notifications'",
        [row.event_id],
      );
      return 'DELIVERED';
    } catch (error) {
      const attempts = Number(row.attempt_count) + 1,
        dead = attempts >= 5;
      await this.pool.query(
        `UPDATE outbox_deliveries SET attempt_count=$2::integer,locked_until=NULL,last_error_code=$3,available_at=now()+make_interval(secs=>LEAST(300,power(2,$2::integer)::int)),dead_lettered_at=CASE WHEN $4 THEN now() END WHERE event_id=$1 AND consumer='notifications'`,
        [
          row.event_id,
          attempts,
          error instanceof Error ? error.name : 'UNKNOWN',
          dead,
        ],
      );
      workerLogger.error(
        { event_id: row.event_id, attempts, dead },
        'notification delivery failed',
      );
      return dead ? 'DEAD_LETTER' : 'RETRY';
    }
  }
}
