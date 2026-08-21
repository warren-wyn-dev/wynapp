/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';

export class ChatError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
const messageSchema = z
  .object({
    kind: z.enum([
      'TEXT',
      'IMAGE',
      'DROP_SHARE',
      'PROFILE_SHARE',
      'CLUB_SHARE',
    ]),
    body: z.string().trim().min(1).max(4000).optional(),
    mediaAssetId: z.uuid().optional(),
    dropId: z.uuid().optional(),
    profileUserId: z.uuid().optional(),
    clubId: z.uuid().optional(),
    replyToMessageId: z.uuid().optional(),
    clientMessageId: z.uuid(),
  })
  .superRefine((v, ctx) => {
    const valid =
      (v.kind === 'TEXT' && !!v.body) ||
      (v.kind === 'IMAGE' && !!v.mediaAssetId) ||
      (v.kind === 'DROP_SHARE' && !!v.dropId) ||
      (v.kind === 'PROFILE_SHARE' && !!v.profileUserId) ||
      (v.kind === 'CLUB_SHARE' && !!v.clubId);
    if (!valid)
      ctx.addIssue({
        code: 'custom',
        message: 'Payload does not match message kind',
      });
  });
const cursorSchema = z.object({
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

async function tx<T>(pool: Pool, fn: (c: PoolClient) => Promise<T>) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const r = await fn(c);
    await c.query('COMMIT');
    return r;
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}
async function active(c: PoolClient, id: string) {
  const q = await c.query(
    "SELECT 1 FROM users WHERE id=$1 AND account_state='ACTIVE' AND deleted_at IS NULL",
    [id],
  );
  return !!q.rowCount;
}
async function blocked(c: PoolClient, a: string, b: string) {
  const q = await c.query(
    'SELECT 1 FROM blocks WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1)',
    [a, b],
  );
  return !!q.rowCount;
}
async function authorize(c: PoolClient, conversation: string, actor: string) {
  const q = await c.query(
    'SELECT c.*, CASE WHEN c.pair_low_user_id=$2 THEN c.pair_high_user_id ELSE c.pair_low_user_id END peer_id FROM conversations c JOIN conversation_members cm ON cm.conversation_id=c.id AND cm.user_id=$2 WHERE c.id=$1',
    [conversation, actor],
  );
  if (!q.rowCount) throw new ChatError('NOT_FOUND');
  const row = q.rows[0];
  if (await blocked(c, actor, row.peer_id)) throw new ChatError('NOT_FOUND');
  return row;
}
export class ChatService {
  constructor(private pool: Pool) {}
  async create(actor: string, target: string, requestId: string) {
    if (actor === target) throw new ChatError('INVALID_TARGET');
    return tx(this.pool, async (c) => {
      if (!(await active(c, target)) || (await blocked(c, actor, target)))
        throw new ChatError('NOT_FOUND');
      const [low, high] = actor < target ? [actor, target] : [target, actor];
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        `${low}:${high}`,
      ]);
      let q = await c.query(
        'SELECT id FROM conversations WHERE pair_low_user_id=$1 AND pair_high_user_id=$2',
        [low, high],
      );
      if (q.rowCount) return { conversation_id: q.rows[0].id, created: false };
      q = await c.query(
        'INSERT INTO conversations(pair_low_user_id,pair_high_user_id) VALUES($1,$2) RETURNING id',
        [low, high],
      );
      const id = q.rows[0].id;
      await c.query(
        'INSERT INTO conversation_members(conversation_id,user_id) VALUES($1,$2),($1,$3)',
        [id, actor, target],
      );
      const p = await c.query(
        'SELECT ps.who_can_message, EXISTS(SELECT 1 FROM follows WHERE follower_id=$1 AND followed_id=$2) follows FROM privacy_settings ps WHERE ps.user_id=$2',
        [actor, target],
      );
      if (p.rows[0]?.who_can_message === 'NONE')
        throw new ChatError('MESSAGE_NOT_ALLOWED');
      const direct =
        p.rows[0]?.who_can_message === 'EVERYONE' || p.rows[0]?.follows;
      await c.query(
        "INSERT INTO message_requests(conversation_id,sender_user_id,recipient_user_id,status,decided_at) VALUES($1,$2,$3,$4::message_request_status,CASE WHEN $4::message_request_status='ACCEPTED' THEN now() END)",
        [id, actor, target, direct ? 'ACCEPTED' : 'PENDING'],
      );
      await c.query(
        "INSERT INTO outbox_events(event_type,aggregate_type,aggregate_id,payload,request_id) VALUES('MessageRequestCreated','Conversation',$1,$2,$3)",
        [id, { recipient_user_id: target }, requestId],
      );
      return {
        conversation_id: id,
        created: true,
        status: direct ? 'ACCEPTED' : 'PENDING',
      };
    });
  }
  async decide(
    id: string,
    actor: string,
    decision: 'ACCEPTED' | 'DECLINED',
    requestId: string,
  ) {
    return tx(this.pool, async (c) => {
      const q = await c.query(
        "UPDATE message_requests SET status=$1,decided_at=now(),updated_at=now() WHERE id=$2 AND recipient_user_id=$3 AND status='PENDING' RETURNING conversation_id,sender_user_id",
        [decision, id, actor],
      );
      if (!q.rowCount) throw new ChatError('NOT_FOUND');
      if (await blocked(c, actor, q.rows[0].sender_user_id))
        throw new ChatError('NOT_FOUND');
      await c.query(
        "INSERT INTO outbox_events(event_type,aggregate_type,aggregate_id,payload,request_id) VALUES('MessageRequestDecided','Conversation',$1,$2,$3)",
        [q.rows[0].conversation_id, { decision }, requestId],
      );
      return { status: decision };
    });
  }
  async list(actor: string) {
    const q = await this.pool.query(
      `SELECT c.id,p.username_normalized peer_username,cm.last_read_sequence,c.next_sequence-1 latest_sequence,GREATEST(c.next_sequence-1-cm.last_read_sequence,0)::int unread_count,m.kind,m.created_at,m.deleted_at IS NOT NULL deleted FROM conversation_members cm JOIN conversations c ON c.id=cm.conversation_id JOIN profiles p ON p.user_id=CASE WHEN c.pair_low_user_id=$1 THEN c.pair_high_user_id ELSE c.pair_low_user_id END JOIN message_requests mr ON mr.conversation_id=c.id LEFT JOIN LATERAL(SELECT kind,created_at,deleted_at FROM messages WHERE conversation_id=c.id ORDER BY sequence DESC LIMIT 1)m ON true WHERE cm.user_id=$1 AND mr.status='ACCEPTED' AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=p.user_id) OR (b.blocker_id=p.user_id AND b.blocked_id=$1)) ORDER BY m.created_at DESC NULLS LAST,c.id`,
      [actor],
    );
    return q.rows;
  }
  async requests(actor: string) {
    const q = await this.pool.query(
      "SELECT mr.id,mr.conversation_id,p.username_normalized,mr.created_at FROM message_requests mr JOIN profiles p ON p.user_id=mr.sender_user_id WHERE mr.recipient_user_id=$1 AND mr.status='PENDING' AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=mr.sender_user_id) OR (b.blocker_id=mr.sender_user_id AND b.blocked_id=$1)) ORDER BY mr.created_at DESC,mr.id DESC",
      [actor],
    );
    return q.rows;
  }
  async messages(conversation: string, actor: string, input: unknown) {
    const d = cursorSchema.parse(input);
    return tx(this.pool, async (c) => {
      await authorize(c, conversation, actor);
      const q = await c.query(
        `SELECT id,sequence,sender_user_id,kind,CASE WHEN deleted_at IS NULL THEN body END body,CASE WHEN deleted_at IS NULL THEN media_asset_id END media_asset_id,CASE WHEN deleted_at IS NULL THEN drop_id END drop_id,CASE WHEN deleted_at IS NULL THEN profile_user_id END profile_user_id,CASE WHEN deleted_at IS NULL THEN club_id END club_id,reply_to_message_id,created_at,deleted_at IS NOT NULL deleted FROM messages WHERE conversation_id=$1 AND ($2::bigint IS NULL OR sequence<$2) ORDER BY sequence DESC LIMIT $3`,
        [conversation, d.before ?? null, d.limit],
      );
      return q.rows;
    });
  }
  async send(
    conversation: string,
    actor: string,
    input: unknown,
    requestId: string,
  ) {
    const d = messageSchema.parse(input);
    return tx(this.pool, async (c) => {
      const conv = await authorize(c, conversation, actor);
      const rq = await c.query(
        'SELECT status FROM message_requests WHERE conversation_id=$1',
        [conversation],
      );
      if (rq.rows[0]?.status !== 'ACCEPTED')
        throw new ChatError('REQUEST_PENDING');
      if (d.replyToMessageId) {
        const r = await c.query(
          'SELECT 1 FROM messages WHERE id=$1 AND conversation_id=$2 AND deleted_at IS NULL',
          [d.replyToMessageId, conversation],
        );
        if (!r.rowCount) throw new ChatError('INVALID_REPLY');
      }
      if (d.kind === 'IMAGE') {
        const m = await c.query(
          "SELECT 1 FROM media_assets WHERE id=$1 AND owner_user_id=$2 AND purpose='CHAT_IMAGE' AND status='READY' AND deleted_at IS NULL",
          [d.mediaAssetId, actor],
        );
        if (!m.rowCount) throw new ChatError('INVALID_MEDIA');
      }
      const refs: { id: string | undefined; table: string }[] = [
        { id: d.dropId, table: 'drops' },
        { id: d.profileUserId, table: 'users' },
        { id: d.clubId, table: 'clubs' },
      ];
      for (const ref of refs)
        if (ref.id) {
          const x = await c.query(
            `SELECT 1 FROM ${ref.table} WHERE id=$1 AND deleted_at IS NULL`,
            [ref.id],
          );
          if (!x.rowCount) throw new ChatError('INVALID_REFERENCE');
        }
      const existing = await c.query(
        'SELECT * FROM messages WHERE sender_user_id=$1 AND client_message_id=$2',
        [actor, d.clientMessageId],
      );
      if (existing.rowCount) return existing.rows[0];
      const s = await c.query(
        'UPDATE conversations SET next_sequence=next_sequence+1,updated_at=now() WHERE id=$1 RETURNING next_sequence-1 sequence',
        [conversation],
      );
      const q = await c.query(
        'INSERT INTO messages(conversation_id,sequence,sender_user_id,kind,body,media_asset_id,drop_id,profile_user_id,club_id,reply_to_message_id,client_message_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *',
        [
          conversation,
          s.rows[0].sequence,
          actor,
          d.kind,
          d.body ?? null,
          d.mediaAssetId ?? null,
          d.dropId ?? null,
          d.profileUserId ?? null,
          d.clubId ?? null,
          d.replyToMessageId ?? null,
          d.clientMessageId,
        ],
      );
      await c.query(
        "INSERT INTO outbox_events(event_type,aggregate_type,aggregate_id,payload,request_id) VALUES('MessageCreated','Conversation',$1,$2,$3)",
        [
          conversation,
          {
            message_id: q.rows[0].id,
            sequence: q.rows[0].sequence,
            recipient_user_id: conv.peer_id,
            actor_user_id: actor,
          },
          requestId,
        ],
      );
      return q.rows[0];
    });
  }
  async read(conversation: string, actor: string, sequence: number) {
    return tx(this.pool, async (c) => {
      await authorize(c, conversation, actor);
      const q = await c.query(
        'UPDATE conversation_members cm SET last_read_sequence=GREATEST(last_read_sequence,LEAST($3,(SELECT next_sequence-1 FROM conversations WHERE id=$1))) WHERE conversation_id=$1 AND user_id=$2 RETURNING last_read_sequence',
        [conversation, actor, sequence],
      );
      return q.rows[0];
    });
  }
  async remove(id: string, actor: string, requestId: string) {
    return tx(this.pool, async (c) => {
      const q = await c.query(
        'UPDATE messages SET deleted_at=now(),body=NULL WHERE id=$1 AND sender_user_id=$2 AND deleted_at IS NULL RETURNING conversation_id',
        [id, actor],
      );
      if (!q.rowCount) throw new ChatError('NOT_FOUND');
      await authorize(c, q.rows[0].conversation_id, actor);
      await c.query(
        "INSERT INTO outbox_events(event_type,aggregate_type,aggregate_id,payload,request_id) VALUES('MessageDeleted','Conversation',$1,$2,$3)",
        [q.rows[0].conversation_id, { message_id: id }, requestId],
      );
    });
  }
  async report(id: string, actor: string, reason: string) {
    return tx(this.pool, async (c) => {
      const m = await c.query(
        'SELECT conversation_id,kind,sender_user_id,created_at FROM messages WHERE id=$1',
        [id],
      );
      if (!m.rowCount) throw new ChatError('NOT_FOUND');
      await authorize(c, m.rows[0].conversation_id, actor);
      if (m.rows[0].sender_user_id === actor)
        throw new ChatError('INVALID_TARGET');
      await c.query(
        'INSERT INTO message_reports(message_id,reporter_user_id,reason,evidence) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',
        [
          id,
          actor,
          z.string().trim().min(3).max(500).parse(reason),
          {
            kind: m.rows[0].kind,
            sender_user_id: m.rows[0].sender_user_id,
            created_at: m.rows[0].created_at,
          },
        ],
      );
    });
  }
}
