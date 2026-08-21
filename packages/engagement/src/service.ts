/* Driver rows are checked by parameterized queries and domain invariants. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
import type { Pool, PoolClient } from 'pg';
import { commentSchema, quoteSchema, shareSchema } from './schemas.js';
export class EngagementError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
async function tx<T>(pool: Pool, fn: (c: PoolClient) => Promise<T>) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const out = await fn(c);
    await c.query('COMMIT');
    return out;
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}
export class EngagementService {
  constructor(private pool: Pool) {}
  private async authorize(
    c: PoolClient,
    dropId: string,
    actor: string,
    lock = false,
  ) {
    const q = await c.query(
      `SELECT d.author_user_id FROM drops d JOIN users a ON a.id=d.author_user_id JOIN users v ON v.id=$2
   WHERE d.id=$1 AND d.status='PUBLISHED' AND d.deleted_at IS NULL AND a.account_state IN ('ACTIVE','RESTRICTED') AND v.account_state='ACTIVE'
   AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.blocker_id=$2 AND b.blocked_id=d.author_user_id) OR (b.blocker_id=d.author_user_id AND b.blocked_id=$2))
   AND (d.author_user_id=$2 OR ((d.visibility='PUBLIC' AND (SELECT account_visibility FROM privacy_settings WHERE user_id=d.author_user_id)='PUBLIC') OR EXISTS(SELECT 1 FROM follows f WHERE f.follower_id=$2 AND f.followed_id=d.author_user_id)))${lock ? ' FOR SHARE OF d' : ''}`,
      [dropId, actor],
    );
    if (!q.rowCount) throw new EngagementError('NOT_FOUND');
    return q.rows[0];
  }
  private event(
    c: PoolClient,
    type: string,
    dropId: string,
    actor: string,
    requestId: string,
    payload: object = {},
  ) {
    return c.query(
      "INSERT INTO outbox_events(event_type,aggregate_type,aggregate_id,payload,request_id) VALUES($1,'Drop',$2,$3,$4)",
      [type, dropId, { actor_user_id: actor, ...payload }, requestId],
    );
  }
  async like(dropId: string, actor: string, requestId: string) {
    return tx(this.pool, async (c) => {
      await this.authorize(c, dropId, actor, true);
      const q = await c.query(
        "INSERT INTO drop_likes(drop_id,user_id,scope) VALUES($1,$2,'GLOBAL_PUBLIC') ON CONFLICT DO NOTHING RETURNING 1",
        [dropId, actor],
      );
      if (q.rowCount)
        await this.event(c, 'DropLiked', dropId, actor, requestId);
      return this.state(c, dropId, actor);
    });
  }
  async unlike(dropId: string, actor: string, requestId: string) {
    return tx(this.pool, async (c) => {
      await this.authorize(c, dropId, actor, true);
      const q = await c.query(
        'DELETE FROM drop_likes WHERE drop_id=$1 AND user_id=$2 RETURNING 1',
        [dropId, actor],
      );
      if (q.rowCount)
        await this.event(c, 'DropUnliked', dropId, actor, requestId);
      return this.state(c, dropId, actor);
    });
  }
  async comment(
    dropId: string,
    actor: string,
    input: unknown,
    requestId: string,
    parent?: string,
  ) {
    const { text } = commentSchema.parse(input);
    return tx(this.pool, async (c) => {
      await this.authorize(c, dropId, actor, true);
      if (parent) {
        const p = await c.query(
          'SELECT deleted_at FROM comments WHERE id=$1 AND drop_id=$2 FOR SHARE',
          [parent, dropId],
        );
        if (!p.rowCount || p.rows[0].deleted_at)
          throw new EngagementError('INVALID_PARENT');
      }
      const q = await c.query(
        "INSERT INTO comments(drop_id,author_user_id,parent_comment_id,body,scope) VALUES($1,$2,$3,$4,'GLOBAL_PUBLIC') RETURNING *",
        [dropId, actor, parent ?? null, text],
      );
      await this.event(
        c,
        parent ? 'CommentReplied' : 'CommentCreated',
        dropId,
        actor,
        requestId,
        { comment_id: q.rows[0].id },
      );
      return q.rows[0];
    });
  }
  async comments(dropId: string, actor: string, cursor?: string) {
    await tx(this.pool, (c) => this.authorize(c, dropId, actor));
    let date: string | undefined, id: string | undefined;
    try {
      if (cursor) {
        const x = JSON.parse(Buffer.from(cursor, 'base64url').toString());
        date = x.date;
        id = x.id;
      }
    } catch {
      throw new EngagementError('INVALID_CURSOR');
    }
    const q = await this.pool.query(
      `SELECT c.id,c.parent_comment_id,c.author_user_id,CASE WHEN c.deleted_at IS NULL THEN c.body ELSE NULL END body,c.created_at,c.edited_at,c.deleted_at,p.username_normalized username,p.display_name FROM comments c JOIN profiles p ON p.user_id=c.author_user_id WHERE c.drop_id=$1 AND ($2::timestamptz IS NULL OR (c.created_at,c.id)>($2,$3::uuid)) ORDER BY c.created_at,c.id LIMIT 51`,
      [dropId, date ?? null, id ?? null],
    );
    const items = q.rows.slice(0, 50),
      last = items.at(-1);
    return {
      items,
      next_cursor:
        q.rows.length > 50
          ? Buffer.from(
              JSON.stringify({ date: last.created_at, id: last.id }),
            ).toString('base64url')
          : null,
    };
  }
  async removeComment(id: string, actor: string, requestId: string) {
    return tx(this.pool, async (c) => {
      const q = await c.query(
        'SELECT drop_id,author_user_id,deleted_at FROM comments WHERE id=$1 FOR UPDATE',
        [id],
      );
      if (!q.rowCount) throw new EngagementError('NOT_FOUND');
      if (q.rows[0].author_user_id !== actor)
        throw new EngagementError('FORBIDDEN');
      if (!q.rows[0].deleted_at) {
        await c.query(
          "UPDATE comments SET body='[deleted]',deleted_at=now(),updated_at=now() WHERE id=$1",
          [id],
        );
        await this.event(
          c,
          'CommentDeleted',
          q.rows[0].drop_id,
          actor,
          requestId,
          { comment_id: id },
        );
      }
    });
  }
  async redrop(dropId: string, actor: string, requestId: string) {
    return tx(this.pool, async (c) => {
      await this.authorize(c, dropId, actor, true);
      const q = await c.query(
        "INSERT INTO redrops(original_drop_id,author_user_id,kind,scope) VALUES($1,$2,'STANDARD','GLOBAL_PUBLIC') ON CONFLICT DO NOTHING RETURNING *",
        [dropId, actor],
      );
      if (q.rowCount)
        await this.event(c, 'DropReDropped', dropId, actor, requestId, {
          redrop_id: q.rows[0].id,
        });
      return q.rows[0] ?? null;
    });
  }
  async unredrop(dropId: string, actor: string, requestId: string) {
    return tx(this.pool, async (c) => {
      await this.authorize(c, dropId, actor, true);
      const q = await c.query(
        "UPDATE redrops SET deleted_at=now() WHERE original_drop_id=$1 AND author_user_id=$2 AND kind='STANDARD' AND deleted_at IS NULL RETURNING id",
        [dropId, actor],
      );
      if (q.rowCount)
        await this.event(c, 'DropUnReDropped', dropId, actor, requestId);
    });
  }
  async quote(
    dropId: string,
    actor: string,
    input: unknown,
    requestId: string,
  ) {
    const { text } = quoteSchema.parse(input);
    return tx(this.pool, async (c) => {
      await this.authorize(c, dropId, actor, true);
      const q = await c.query(
        "INSERT INTO redrops(original_drop_id,author_user_id,kind,quote_text,scope) VALUES($1,$2,'QUOTE',$3,'GLOBAL_PUBLIC') RETURNING *",
        [dropId, actor, text],
      );
      await this.event(c, 'QuoteReDropCreated', dropId, actor, requestId, {
        redrop_id: q.rows[0].id,
      });
      return q.rows[0];
    });
  }
  async save(dropId: string, actor: string, requestId: string, remove = false) {
    return tx(this.pool, async (c) => {
      await this.authorize(c, dropId, actor, true);
      const q = remove
        ? await c.query(
            'DELETE FROM saved_drops WHERE user_id=$1 AND drop_id=$2 RETURNING 1',
            [actor, dropId],
          )
        : await c.query(
            'INSERT INTO saved_drops(user_id,drop_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING 1',
            [actor, dropId],
          );
      if (q.rowCount)
        await this.event(
          c,
          remove ? 'DropUnsaved' : 'DropSaved',
          dropId,
          actor,
          requestId,
        );
    });
  }
  async saved(actor: string, cursor?: string) {
    let date: string | undefined, id: string | undefined;
    try {
      if (cursor) {
        const value = JSON.parse(Buffer.from(cursor, 'base64url').toString());
        date = value.date;
        id = value.id;
      }
    } catch {
      throw new EngagementError('INVALID_CURSOR');
    }
    const q = await this.pool.query(
      `SELECT d.*,s.created_at saved_at,p.username_normalized username,p.display_name FROM saved_drops s JOIN drops d ON d.id=s.drop_id JOIN profiles p ON p.user_id=d.author_user_id JOIN users u ON u.id=d.author_user_id WHERE s.user_id=$1 AND ($2::timestamptz IS NULL OR (s.created_at,d.id)<($2,$3::uuid)) AND d.status='PUBLISHED' AND u.account_state IN ('ACTIVE','RESTRICTED') AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=d.author_user_id) OR (b.blocker_id=d.author_user_id AND b.blocked_id=$1)) AND (d.author_user_id=$1 OR ((d.visibility='PUBLIC' AND (SELECT account_visibility FROM privacy_settings WHERE user_id=d.author_user_id)='PUBLIC') OR EXISTS(SELECT 1 FROM follows f WHERE f.follower_id=$1 AND f.followed_id=d.author_user_id))) ORDER BY s.created_at DESC,d.id DESC LIMIT 51`,
      [actor, date ?? null, id ?? null],
    );
    const items = q.rows.slice(0, 50),
      last = items.at(-1);
    return {
      items,
      next_cursor:
        q.rows.length > 50
          ? Buffer.from(
              JSON.stringify({ date: last.saved_at, id: last.id }),
            ).toString('base64url')
          : null,
    };
  }
  async view(dropId: string, actor: string, requestId: string) {
    return tx(this.pool, async (c) => {
      await this.authorize(c, dropId, actor, true);
      const q = await c.query(
        "INSERT INTO drop_views(drop_id,viewer_user_id,window_started_at,scope) VALUES($1,$2,date_trunc('hour',now()),'GLOBAL_PUBLIC') ON CONFLICT DO NOTHING RETURNING 1",
        [dropId, actor],
      );
      await c.query(
        'INSERT INTO drop_view_events(drop_id,viewer_user_id,counted) VALUES($1,$2,$3)',
        [dropId, actor, Boolean(q.rowCount)],
      );
      if (q.rowCount)
        await this.event(c, 'DropViewed', dropId, actor, requestId);
      return { counted: Boolean(q.rowCount) };
    });
  }
  async share(dropId: string, actor: string, input: unknown) {
    const { channel } = shareSchema.parse(input);
    return tx(this.pool, async (c) => {
      await this.authorize(c, dropId, actor, true);
      await c.query(
        "INSERT INTO drop_share_events(drop_id,actor_user_id,channel,window_started_at) VALUES($1,$2,$3,date_trunc('hour',now())) ON CONFLICT DO NOTHING",
        [dropId, actor, channel],
      );
    });
  }
  async state(c: PoolClient, dropId: string, actor: string) {
    const q = await c.query(
      `SELECT (SELECT count(*)::int FROM drop_likes WHERE drop_id=$1) likes_count,(SELECT count(*)::int FROM comments WHERE drop_id=$1 AND deleted_at IS NULL) comments_count,(SELECT count(*)::int FROM redrops WHERE original_drop_id=$1 AND deleted_at IS NULL) redrops_count,(SELECT count(*)::int FROM drop_views WHERE drop_id=$1) views_count,EXISTS(SELECT 1 FROM drop_likes WHERE drop_id=$1 AND user_id=$2) liked,EXISTS(SELECT 1 FROM saved_drops WHERE drop_id=$1 AND user_id=$2) saved`,
      [dropId, actor],
    );
    return q.rows[0];
  }
}
