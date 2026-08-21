/* PostgreSQL rows are narrowed by the fixed private-delivery query. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import type { Pool } from 'pg';

export type RealtimeHint = {
  conversationId: string;
  messageId: string;
  sequence: number;
};
export interface RealtimePublisher {
  publish(userId: string, hint: RealtimeHint): Promise<void>;
}

/** Delivery is deliberately lossy: the client always reconciles durable messages by sequence. */
export class ChatRealtimeDelivery {
  constructor(
    private pool: Pool,
    private publisher: RealtimePublisher,
  ) {}
  async deliver(eventId: string): Promise<'DELIVERED' | 'SUPPRESSED'> {
    const q = await this.pool.query(
      `SELECT e.aggregate_id conversation_id,e.payload->>'message_id' message_id,(e.payload->>'sequence')::bigint sequence,e.payload->>'recipient_user_id' recipient_id,c.pair_low_user_id,c.pair_high_user_id FROM outbox_events e JOIN conversations c ON c.id=e.aggregate_id WHERE e.id=$1 AND e.event_type='MessageCreated'`,
      [eventId],
    );
    if (!q.rowCount) return 'SUPPRESSED';
    const r = q.rows[0];
    const allowed = await this.pool.query(
      `SELECT 1 FROM conversation_members cm JOIN users u ON u.id=cm.user_id JOIN conversations c ON c.id=cm.conversation_id WHERE cm.conversation_id=$1 AND cm.user_id=$2 AND u.account_state='ACTIVE' AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.blocker_id=$2 AND b.blocked_id=CASE WHEN $2=c.pair_low_user_id THEN c.pair_high_user_id ELSE c.pair_low_user_id END) OR (b.blocked_id=$2 AND b.blocker_id=CASE WHEN $2=c.pair_low_user_id THEN c.pair_high_user_id ELSE c.pair_low_user_id END))`,
      [r.conversation_id, r.recipient_id],
    );
    if (!allowed.rowCount) return 'SUPPRESSED';
    await this.publisher.publish(r.recipient_id, {
      conversationId: r.conversation_id,
      messageId: r.message_id,
      sequence: Number(r.sequence),
    });
    return 'DELIVERED';
  }
}
