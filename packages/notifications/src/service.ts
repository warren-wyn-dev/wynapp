/* PostgreSQL driver rows are constrained by parameterized queries and domain schemas. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';

export const categories = [
  'LIKES',
  'COMMENTS',
  'REPLIES',
  'REDROPS',
  'FOLLOWS',
  'FOLLOW_REQUESTS',
  'MENTIONS',
  'TRENDING',
  'SYSTEM',
] as const;
export type Category = (typeof categories)[number];
const categoryFor = {
  DropLiked: 'LIKES',
  CommentCreated: 'COMMENTS',
  CommentReplied: 'REPLIES',
  DropReDropped: 'REDROPS',
  QuoteReDropCreated: 'REDROPS',
  UserFollowed: 'FOLLOWS',
  FollowRequested: 'FOLLOW_REQUESTS',
  FollowRequestApproved: 'FOLLOW_REQUESTS',
  UserMentioned: 'MENTIONS',
  TrendingAchieved: 'TRENDING',
  Top100Achieved: 'TRENDING',
  SystemAnnouncementPublished: 'SYSTEM',
} as const;
const typeFor = {
  DropLiked: 'DROP_LIKED',
  CommentCreated: 'COMMENT_CREATED',
  CommentReplied: 'COMMENT_REPLIED',
  DropReDropped: 'DROP_REDROPPED',
  QuoteReDropCreated: 'QUOTE_REDROP_CREATED',
  UserFollowed: 'USER_FOLLOWED',
  FollowRequested: 'FOLLOW_REQUEST_RECEIVED',
  FollowRequestApproved: 'FOLLOW_REQUEST_APPROVED',
  UserMentioned: 'USER_MENTIONED',
  TrendingAchieved: 'TRENDING_ACHIEVED',
  Top100Achieved: 'TOP100_ACHIEVED',
  SystemAnnouncementPublished: 'SYSTEM_ANNOUNCEMENT',
} as const;
type EventType = keyof typeof typeFor;
const payloadSchema = z
  .object({
    actor_user_id: z.uuid().optional(),
    actor_id: z.uuid().optional(),
    target_id: z.uuid().optional(),
    recipient_user_id: z.uuid().optional(),
    comment_id: z.uuid().optional(),
    mention_target_user_id: z.uuid().optional(),
    title: z.string().max(100).optional(),
    ranking_window: z.string().max(40).optional(),
  })
  .strip();
export class NotificationError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}
const encode = (v: object) =>
  Buffer.from(JSON.stringify(v)).toString('base64url');
function decode(cursor?: string) {
  if (!cursor) return undefined;
  try {
    const v = z
      .object({ date: z.string().datetime(), id: z.uuid() })
      .parse(JSON.parse(Buffer.from(cursor, 'base64url').toString()));
    return v;
  } catch {
    throw new NotificationError('INVALID_CURSOR');
  }
}
function key(parts: (string | null | undefined)[]) {
  return createHash('sha256').update(parts.join(':')).digest('hex');
}

export class NotificationService {
  constructor(private readonly pool: Pool) {}
  async processEvent(
    eventId: string,
  ): Promise<'CREATED' | 'SUPPRESSED' | 'DUPLICATE'> {
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      const q = await c.query(
        'SELECT * FROM outbox_events WHERE id=$1 FOR UPDATE',
        [eventId],
      );
      if (!q.rowCount) throw new NotificationError('EVENT_NOT_FOUND');
      const event = q.rows[0] as {
        event_type: string;
        aggregate_type: string;
        aggregate_id: string;
        payload: unknown;
        occurred_at: Date;
      };
      if (!(event.event_type in typeFor)) {
        await c.query('COMMIT');
        return 'SUPPRESSED';
      }
      const eventType = event.event_type as EventType,
        p = payloadSchema.parse(event.payload),
        actor = p.actor_user_id ?? p.actor_id;
      const recipient =
        p.recipient_user_id ??
        p.mention_target_user_id ??
        p.target_id ??
        (await this.owner(c, eventType, event.aggregate_id, p.comment_id));
      if (!recipient || (actor && actor === recipient)) {
        await c.query('COMMIT');
        return 'SUPPRESSED';
      }
      if (
        eventType === 'SystemAnnouncementPublished' &&
        event.aggregate_type !== 'System'
      )
        throw new NotificationError('UNTRUSTED_SYSTEM_EVENT');
      if (
        !(await this.eligible(
          c,
          recipient,
          actor,
          eventType,
          event.aggregate_id,
          p.comment_id,
          categoryFor[eventType],
        ))
      ) {
        await c.query('COMMIT');
        return 'SUPPRESSED';
      }
      const cooldown =
        eventType === 'TrendingAchieved'
          ? '7d'
          : eventType === 'Top100Achieved'
            ? '30d'
            : '';
      const dedupe = key([
        recipient,
        typeFor[eventType],
        actor,
        event.aggregate_id,
        p.comment_id,
        cooldown &&
          (p.ranking_window ?? event.occurred_at.toISOString().slice(0, 10)),
      ]);
      const safePayload =
        eventType === 'SystemAnnouncementPublished' && p.title
          ? { title: p.title }
          : {};
      const inserted = await c.query(
        `INSERT INTO notifications(recipient_user_id,actor_user_id,type,entity_type,entity_id,payload,dedupe_key)
    VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(recipient_user_id,dedupe_key) DO NOTHING RETURNING id`,
        [
          recipient,
          actor ?? null,
          typeFor[eventType],
          this.entity(eventType, event.aggregate_type),
          event.aggregate_id,
          safePayload,
          dedupe,
        ],
      );
      await c.query('COMMIT');
      return inserted.rowCount ? 'CREATED' : 'DUPLICATE';
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    } finally {
      c.release();
    }
  }
  private entity(type: EventType, aggregate: string) {
    if (type === 'SystemAnnouncementPublished') return 'SYSTEM';
    if (
      type === 'UserFollowed' ||
      type === 'FollowRequested' ||
      type === 'FollowRequestApproved' ||
      type === 'Top100Achieved'
    )
      return 'USER';
    if (type === 'CommentCreated' || type === 'CommentReplied')
      return 'COMMENT';
    return aggregate.toUpperCase() === 'DROP' ? 'DROP' : 'TOPIC';
  }
  private async owner(
    c: PoolClient,
    type: EventType,
    id: string,
    comment?: string,
  ) {
    if (type === 'CommentReplied' && comment) {
      const q = await c.query(
        'SELECT p.author_user_id FROM comments c JOIN comments p ON p.id=c.parent_comment_id WHERE c.id=$1',
        [comment],
      );
      if (q.rowCount) return q.rows[0].author_user_id as string;
    }
    if (
      [
        'DropLiked',
        'CommentCreated',
        'DropReDropped',
        'QuoteReDropCreated',
        'TrendingAchieved',
      ].includes(type)
    ) {
      const q = await c.query('SELECT author_user_id FROM drops WHERE id=$1', [
        id,
      ]);
      return q.rows[0]?.author_user_id as string | undefined;
    }
    if (type === 'Top100Achieved') return id;
    return undefined;
  }
  private async eligible(
    c: PoolClient,
    recipient: string,
    actor: string | undefined,
    type: EventType,
    entity: string,
    comment: string | undefined,
    category: Category,
  ) {
    const users = await c.query(
      "SELECT count(*)::int n FROM users WHERE id=ANY($1::uuid[]) AND account_state IN ('ACTIVE','RESTRICTED')",
      [[recipient, ...(actor ? [actor] : [])]],
    );
    if (users.rows[0].n !== (actor ? 2 : 1)) return false;
    if (
      actor &&
      (
        await c.query(
          'SELECT 1 FROM blocks WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1)',
          [recipient, actor],
        )
      ).rowCount
    )
      return false;
    if (
      category !== 'SYSTEM' &&
      (
        await c.query(
          'SELECT 1 FROM notification_preferences WHERE user_id=$1 AND category=$2 AND in_app_enabled=false',
          [recipient, category],
        )
      ).rowCount
    )
      return false;
    if (
      [
        'DropLiked',
        'CommentCreated',
        'CommentReplied',
        'DropReDropped',
        'QuoteReDropCreated',
        'TrendingAchieved',
        'UserMentioned',
      ].includes(type)
    ) {
      const q = await c.query(
        `SELECT 1 FROM drops d JOIN users u ON u.id=d.author_user_id WHERE d.id=$1 AND d.status='PUBLISHED' AND d.deleted_at IS NULL AND u.account_state IN ('ACTIVE','RESTRICTED') AND (d.author_user_id=$2 OR ((d.visibility='PUBLIC' AND (SELECT account_visibility FROM privacy_settings WHERE user_id=d.author_user_id)='PUBLIC') OR EXISTS(SELECT 1 FROM follows WHERE follower_id=$2 AND followed_id=d.author_user_id)))`,
        [entity, recipient],
      );
      if (!q.rowCount) return false;
      if (
        comment &&
        !(
          await c.query(
            'SELECT 1 FROM comments WHERE id=$1 AND deleted_at IS NULL',
            [comment],
          )
        ).rowCount
      )
        return false;
    }
    return true;
  }
  async list(userId: string, cursor?: string, limit = 30) {
    const after = decode(cursor);
    const q = await this.pool.query(
      `SELECT n.id,n.type,n.entity_type,n.entity_id,n.payload,n.read_at,n.created_at,n.actor_user_id,p.username_normalized actor_username,p.display_name actor_display_name FROM notifications n LEFT JOIN profiles p ON p.user_id=n.actor_user_id WHERE n.recipient_user_id=$1 AND (n.expires_at IS NULL OR n.expires_at>now()) AND ($2::timestamptz IS NULL OR (n.created_at,n.id)<($2,$3::uuid)) ORDER BY n.created_at DESC,n.id DESC LIMIT $4`,
      [userId, after?.date ?? null, after?.id ?? null, Math.min(limit, 50) + 1],
    );
    const items = q.rows.slice(0, Math.min(limit, 50)),
      last = items.at(-1);
    return {
      items,
      next_cursor:
        q.rows.length > items.length && last
          ? encode({
              date: (last.created_at as Date).toISOString(),
              id: last.id,
            })
          : null,
    };
  }
  async unread(userId: string) {
    const q = await this.pool.query(
      'SELECT count(*)::int count FROM notifications WHERE recipient_user_id=$1 AND read_at IS NULL AND (expires_at IS NULL OR expires_at>now())',
      [userId],
    );
    return q.rows[0].count as number;
  }
  async read(userId: string, id: string) {
    const q = await this.pool.query(
      'UPDATE notifications SET read_at=coalesce(read_at,now()) WHERE id=$1 AND recipient_user_id=$2 RETURNING id',
      [id, userId],
    );
    if (!q.rowCount) throw new NotificationError('NOT_FOUND');
  }
  async readAll(userId: string) {
    const q = await this.pool.query(
      'UPDATE notifications SET read_at=now() WHERE recipient_user_id=$1 AND read_at IS NULL',
      [userId],
    );
    return q.rowCount ?? 0;
  }
  async preferences(userId: string) {
    const q = await this.pool.query(
      `SELECT c.category,coalesce(p.in_app_enabled,true) in_app_enabled,coalesce(p.web_push_enabled,false) web_push_enabled FROM unnest($2::notification_category[]) c(category) LEFT JOIN notification_preferences p ON p.user_id=$1 AND p.category=c.category`,
      [userId, categories],
    );
    return q.rows;
  }
  async setPreferences(userId: string, input: unknown) {
    const updates = z
      .object({
        preferences: z
          .array(
            z.object({
              category: z.enum(categories),
              in_app_enabled: z.boolean().optional(),
              web_push_enabled: z.boolean().optional(),
            }),
          )
          .max(categories.length),
      })
      .parse(input);
    for (const p of updates.preferences) {
      if (p.category === 'SYSTEM' && p.in_app_enabled === false)
        throw new NotificationError('SYSTEM_REQUIRED');
      await this.pool.query(
        `INSERT INTO notification_preferences(user_id,category,in_app_enabled,web_push_enabled) VALUES($1,$2,coalesce($3,true),coalesce($4,false)) ON CONFLICT(user_id,category) DO UPDATE SET in_app_enabled=coalesce($3,notification_preferences.in_app_enabled),web_push_enabled=coalesce($4,notification_preferences.web_push_enabled),updated_at=now()`,
        [
          userId,
          p.category,
          p.in_app_enabled ?? null,
          p.web_push_enabled ?? null,
        ],
      );
    }
    return this.preferences(userId);
  }
  async subscribe(userId: string, input: unknown) {
    const p = z
      .object({
        endpoint: z.url().max(2048),
        keys: z.object({
          p256dh: z.string().min(8).max(512),
          auth: z.string().min(8).max(512),
        }),
        permission_state: z
          .enum(['GRANTED', 'DENIED', 'PROMPT'])
          .default('GRANTED'),
      })
      .parse(input);
    if (p.permission_state !== 'GRANTED')
      throw new NotificationError('PUSH_PERMISSION_REQUIRED');
    const q = await this.pool.query(
      `INSERT INTO push_subscriptions(user_id,endpoint,p256dh,auth_secret,permission_state) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id,endpoint) DO UPDATE SET p256dh=$3,auth_secret=$4,permission_state=$5,invalidated_at=NULL,updated_at=now() RETURNING id,permission_state,created_at`,
      [userId, p.endpoint, p.keys.p256dh, p.keys.auth, p.permission_state],
    );
    return q.rows[0];
  }
  async unsubscribe(userId: string, id: string) {
    const q = await this.pool.query(
      'DELETE FROM push_subscriptions WHERE id=$1 AND user_id=$2',
      [id, userId],
    );
    if (!q.rowCount) throw new NotificationError('NOT_FOUND');
  }
}
