/* PostgreSQL rows cross a dynamic driver boundary and are validated by the queries and domain checks below. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import {
  dropInputSchema,
  dropPatchSchema,
  extractMentions,
  extractTags,
  type DropInput,
} from './schemas.js';

export class DropError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
async function transaction<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const value = await fn(c);
    await c.query('COMMIT');
    return value;
  } catch (error) {
    await c.query('ROLLBACK');
    throw error;
  } finally {
    c.release();
  }
}
const digest = (input: unknown) =>
  createHash('sha256').update(JSON.stringify(input)).digest('hex');

export class DropService {
  constructor(private pool: Pool) {}
  async create(
    userId: string,
    input: unknown,
    status: 'DRAFT' | 'PUBLISHED',
    requestId: string,
    idempotencyKey?: string,
  ) {
    const data = dropInputSchema.parse(input);
    const hash = digest(data);
    return transaction(this.pool, async (c) => {
      if (idempotencyKey) {
        const prior = await c.query(
          'SELECT request_hash,drop_id FROM drop_idempotency WHERE user_id=$1 AND action=$2 AND idempotency_key=$3 FOR UPDATE',
          [userId, status, idempotencyKey],
        );
        if (prior.rows[0]) {
          if (prior.rows[0].request_hash !== hash)
            throw new DropError('IDEMPOTENCY_CONFLICT');
          return this.load(c, prior.rows[0].drop_id, userId, true);
        }
      }
      const q = await c.query(
        `INSERT INTO drops(author_user_id,status,visibility,body,caption,external_url,location_label,poll_question,poll_expires_at,published_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,CASE WHEN $2='PUBLISHED' THEN now() END) RETURNING id`,
        [
          userId,
          status,
          data.visibility,
          data.body,
          data.caption,
          data.externalUrl ?? null,
          data.locationLabel ?? null,
          data.poll?.question ?? null,
          data.poll?.expiresAt ?? null,
        ],
      );
      const id = q.rows[0].id as string;
      await this.relations(c, id, userId, data);
      await this.event(
        c,
        status === 'DRAFT' ? 'DropDraftCreated' : 'DropPublished',
        id,
        1,
        requestId,
      );
      if (idempotencyKey)
        await c.query(
          'INSERT INTO drop_idempotency(user_id,action,idempotency_key,request_hash,drop_id) VALUES($1,$2,$3,$4,$5)',
          [userId, status, idempotencyKey, hash, id],
        );
      return this.load(c, id, userId, true);
    });
  }
  async listDrafts(userId: string) {
    const q = await this.pool.query(
      "SELECT id,body,caption,visibility,updated_at,version FROM drops WHERE author_user_id=$1 AND status='DRAFT' ORDER BY updated_at DESC,id DESC LIMIT 100",
      [userId],
    );
    return q.rows;
  }
  async get(id: string, viewerId?: string) {
    return transaction(this.pool, (c) => this.load(c, id, viewerId, false));
  }
  async update(id: string, userId: string, input: unknown, requestId: string) {
    const patch = dropPatchSchema.parse(input);
    return transaction(this.pool, async (c) => {
      const current = await c.query(
        'SELECT * FROM drops WHERE id=$1 FOR UPDATE',
        [id],
      );
      const row = current.rows[0];
      if (!row || row.status === 'DELETED') throw new DropError('NOT_FOUND');
      if (row.author_user_id !== userId) throw new DropError('FORBIDDEN');
      if (
        row.status === 'PUBLISHED' &&
        Date.now() - new Date(row.published_at).getTime() > 30 * 60 * 1000
      )
        throw new DropError('EDIT_WINDOW_EXPIRED');
      if (row.status === 'PUBLISHED')
        await c.query(
          'INSERT INTO drop_revisions(drop_id,revision,snapshot,edited_by_user_id,request_id) VALUES($1,$2,$3,$4,$5)',
          [id, row.version, row, userId, requestId],
        );
      const next = {
        body: patch.body ?? row.body,
        caption: patch.caption ?? row.caption,
        visibility: patch.visibility ?? row.visibility,
        externalUrl:
          patch.externalUrl === undefined
            ? row.external_url
            : patch.externalUrl,
        locationLabel:
          patch.locationLabel === undefined
            ? row.location_label
            : patch.locationLabel,
      };
      await c.query(
        `UPDATE drops SET body=$2,caption=$3,visibility=$4,external_url=$5,location_label=$6,updated_at=now(),edited_at=CASE WHEN status='PUBLISHED' THEN now() ELSE edited_at END,version=version+1 WHERE id=$1`,
        [
          id,
          next.body,
          next.caption,
          next.visibility,
          next.externalUrl,
          next.locationLabel,
        ],
      );
      await this.textRelations(c, id, `${next.body}\n${next.caption}`);
      if (row.status === 'PUBLISHED')
        await this.event(c, 'DropEdited', id, row.version + 1, requestId);
      return this.load(c, id, userId, true);
    });
  }
  async publish(
    id: string,
    userId: string,
    requestId: string,
    idempotencyKey?: string,
  ) {
    void idempotencyKey;
    return transaction(this.pool, async (c) => {
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        id,
      ]);
      const q = await c.query('SELECT * FROM drops WHERE id=$1 FOR UPDATE', [
        id,
      ]);
      const row = q.rows[0];
      if (!row || row.author_user_id !== userId)
        throw new DropError('NOT_FOUND');
      if (row.status === 'PUBLISHED') return this.load(c, id, userId, true);
      if (row.status !== 'DRAFT') throw new DropError('NOT_FOUND');
      const count = await c.query(
        'SELECT count(*)::int n FROM drop_media_attachments WHERE drop_id=$1',
        [id],
      );
      if (count.rows[0].n > 9) throw new DropError('MEDIA_LIMIT');
      await c.query(
        "UPDATE drops SET status='PUBLISHED',published_at=now(),updated_at=now(),version=version+1 WHERE id=$1",
        [id],
      );
      await this.event(c, 'DropPublished', id, row.version + 1, requestId);
      return this.load(c, id, userId, true);
    });
  }
  async remove(id: string, userId: string, requestId: string) {
    return transaction(this.pool, async (c) => {
      const q = await c.query(
        'SELECT author_user_id,status,version FROM drops WHERE id=$1 FOR UPDATE',
        [id],
      );
      const row = q.rows[0];
      if (!row || row.status === 'DELETED') return;
      if (row.author_user_id !== userId) throw new DropError('FORBIDDEN');
      await c.query(
        "UPDATE drops SET status='DELETED',deleted_at=now(),updated_at=now(),version=version+1 WHERE id=$1",
        [id],
      );
      await this.event(c, 'DropDeleted', id, row.version + 1, requestId);
    });
  }
  private async relations(
    c: PoolClient,
    id: string,
    userId: string,
    data: DropInput,
  ) {
    for (const [position, mediaId] of data.mediaIds.entries())
      await c.query(
        'INSERT INTO drop_media_attachments(drop_id,media_asset_id,position) VALUES($1,$2,$3)',
        [id, mediaId, position],
      );
    if (data.poll)
      for (const [position, label] of data.poll.options.entries())
        await c.query(
          'INSERT INTO drop_poll_options(drop_id,position,label) VALUES($1,$2,$3)',
          [id, position, label],
        );
    await this.textRelations(c, id, `${data.body}\n${data.caption}`);
  }
  private async textRelations(c: PoolClient, id: string, text: string) {
    await c.query('DELETE FROM drop_hashtags WHERE drop_id=$1', [id]);
    await c.query('DELETE FROM drop_mentions WHERE drop_id=$1', [id]);
    for (const tag of extractTags(text)) {
      const q = await c.query(
        'INSERT INTO hashtags(normalized) VALUES($1) ON CONFLICT(normalized) DO UPDATE SET normalized=EXCLUDED.normalized RETURNING id',
        [tag],
      );
      await c.query(
        'INSERT INTO drop_hashtags(drop_id,hashtag_id) VALUES($1,$2)',
        [id, q.rows[0].id],
      );
    }
    for (const username of extractMentions(text)) {
      const q = await c.query(
        "SELECT p.user_id FROM profiles p JOIN users u ON u.id=p.user_id WHERE p.username_normalized=$1 AND u.account_state IN ('ACTIVE','RESTRICTED') AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.blocker_id=u.id AND b.blocked_id=(SELECT author_user_id FROM drops WHERE id=$2)) OR (b.blocked_id=u.id AND b.blocker_id=(SELECT author_user_id FROM drops WHERE id=$2)))",
        [username, id],
      );
      if (q.rows[0])
        await c.query(
          'INSERT INTO drop_mentions(drop_id,mentioned_user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
          [id, q.rows[0].user_id],
        );
    }
  }
  private async load(
    c: PoolClient,
    id: string,
    viewerId?: string,
    owner = false,
  ) {
    const q = await c.query(
      `SELECT d.*,p.username_normalized username,p.display_name,
   COALESCE((SELECT jsonb_agg(jsonb_build_object('id',m.id,'position',a.position,'status',m.status) ORDER BY a.position) FROM drop_media_attachments a JOIN media_assets m ON m.id=a.media_asset_id WHERE a.drop_id=d.id),'[]'::jsonb) media,
   COALESCE((SELECT jsonb_agg(h.normalized ORDER BY h.normalized) FROM drop_hashtags dh JOIN hashtags h ON h.id=dh.hashtag_id WHERE dh.drop_id=d.id),'[]'::jsonb) hashtags,
   COALESCE((SELECT jsonb_agg(jsonb_build_object('userId',p2.user_id,'username',p2.username_normalized)) FROM drop_mentions dm JOIN profiles p2 ON p2.user_id=dm.mentioned_user_id WHERE dm.drop_id=d.id),'[]'::jsonb) mentions,
   COALESCE((SELECT jsonb_agg(jsonb_build_object('id',o.id,'label',o.label,'position',o.position) ORDER BY o.position) FROM drop_poll_options o WHERE o.drop_id=d.id),'[]'::jsonb) poll_options
   ,(SELECT count(*)::int FROM drop_likes l WHERE l.drop_id=d.id) likes_count
   ,(SELECT count(*)::int FROM comments c2 WHERE c2.drop_id=d.id AND c2.deleted_at IS NULL) comments_count
   ,(SELECT count(*)::int FROM redrops r WHERE r.original_drop_id=d.id AND r.deleted_at IS NULL) redrops_count
   ,(SELECT count(*)::int FROM drop_views v WHERE v.drop_id=d.id) views_count
   ,EXISTS(SELECT 1 FROM drop_likes l WHERE l.drop_id=d.id AND l.user_id=$2) liked
   ,EXISTS(SELECT 1 FROM saved_drops s WHERE s.drop_id=d.id AND s.user_id=$2) saved
   FROM drops d JOIN profiles p ON p.user_id=d.author_user_id WHERE d.id=$1`,
      [id, viewerId ?? null],
    );
    const row = q.rows[0];
    if (!row) throw new DropError('NOT_FOUND');
    if (row.status === 'DRAFT' && row.author_user_id !== viewerId)
      throw new DropError('NOT_FOUND');
    if (row.status === 'DELETED') throw new DropError('NOT_FOUND');
    if (
      !owner &&
      row.status === 'PUBLISHED' &&
      row.author_user_id !== viewerId
    ) {
      const allowed = await c.query(
        `SELECT NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=$2) OR (b.blocker_id=$2 AND b.blocked_id=$1)) AND
    ($3='PUBLIC' OR EXISTS(SELECT 1 FROM follows f WHERE f.follower_id=$1 AND f.followed_id=$2)) AND
    ((SELECT account_visibility FROM privacy_settings WHERE user_id=$2)='PUBLIC' OR EXISTS(SELECT 1 FROM follows f WHERE f.follower_id=$1 AND f.followed_id=$2)) ok`,
        [viewerId ?? null, row.author_user_id, row.visibility],
      );
      if (!allowed.rows[0]?.ok) throw new DropError('NOT_FOUND');
    }
    return row;
  }
  private event(
    c: PoolClient,
    event: string,
    id: string,
    version: number,
    requestId: string,
  ) {
    return c.query(
      "INSERT INTO outbox_events(event_type,aggregate_type,aggregate_id,payload,request_id) VALUES($1,'Drop',$2,$3,$4)",
      [event, id, { version }, requestId],
    );
  }
}
