import type { Pool } from 'pg';
/* pg rows are runtime database values constrained by the migration and parameterized queries. */
/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */

export class DiscoveryError extends Error {
  constructor(public code: 'INVALID_CURSOR' | 'NOT_FOUND') {
    super(code);
  }
}
const encode = (value: object) =>
  Buffer.from(JSON.stringify(value)).toString('base64url');
function decode(cursor?: string): {
  date?: string;
  id?: string;
  score?: number;
  rank?: number;
} {
  if (!cursor) return {};
  try {
    const value = JSON.parse(
      Buffer.from(cursor, 'base64url').toString(),
    ) as Record<string, unknown>;
    if (typeof value !== 'object' || value === null) throw new Error();
    return value as {
      date?: string;
      id?: string;
      score?: number;
      rank?: number;
    };
  } catch {
    throw new DiscoveryError('INVALID_CURSOR');
  }
}
function page(
  rows: Record<string, unknown>[],
  limit: number,
  keys: (row: Record<string, unknown>) => object,
) {
  const items = rows.slice(0, limit),
    last = items.at(-1);
  return {
    items,
    next_cursor: rows.length > limit && last ? encode(keys(last)) : null,
  };
}
const exclusion = `AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=d.author_user_id) OR (b.blocker_id=d.author_user_id AND b.blocked_id=$1))
 AND NOT EXISTS(SELECT 1 FROM mutes m WHERE m.muter_id=$1 AND m.muted_id=d.author_user_id)`;
const fields = `d.id,d.author_user_id,d.body,d.caption,d.published_at,p.username_normalized AS username,p.display_name`;

export class DiscoveryService {
  constructor(private pool: Pool) {}
  async following(actor: string, cursor?: string, requested = 20) {
    const limit = Math.min(Math.max(requested, 1), 50),
      c = decode(cursor);
    const q = await this.pool.query(
      `SELECT ${fields} FROM drops d JOIN users u ON u.id=d.author_user_id JOIN profiles p ON p.user_id=u.id
       JOIN follows f ON f.followed_id=d.author_user_id AND f.follower_id=$1
       WHERE d.status='PUBLISHED' AND d.deleted_at IS NULL AND u.account_state='ACTIVE'
       AND (d.visibility='PUBLIC' OR d.visibility='FOLLOWERS') ${exclusion}
       AND ($2::timestamptz IS NULL OR (d.published_at,d.id)<($2,$3::uuid))
       ORDER BY d.published_at DESC,d.id DESC LIMIT $4`,
      [actor, c.date ?? null, c.id ?? null, limit + 1],
    );
    return page(q.rows, limit, (r) => ({ date: r.published_at, id: r.id }));
  }
  async forYou(actor: string, cursor?: string, requested = 20) {
    const limit = Math.min(Math.max(requested, 1), 50),
      c = decode(cursor);
    const q = await this.pool.query(
      `WITH candidates AS (SELECT ${fields},
       (4*exp(-extract(epoch FROM(now()-d.published_at))/86400/2)
        +1.5*ln(1+least((SELECT count(*) FROM drop_likes l WHERE l.drop_id=d.id AND l.scope='GLOBAL_PUBLIC' AND l.user_id<>d.author_user_id),500))
        +2*ln(1+least((SELECT count(*) FROM comments x WHERE x.drop_id=d.id AND x.scope='GLOBAL_PUBLIC' AND x.deleted_at IS NULL AND x.author_user_id<>d.author_user_id),200))
        +2.5*ln(1+least((SELECT count(*) FROM redrops r WHERE r.original_drop_id=d.id AND r.scope='GLOBAL_PUBLIC' AND r.deleted_at IS NULL AND r.author_user_id<>d.author_user_id),100))
        +.5*ln(1+least((SELECT count(*) FROM drop_views v WHERE v.drop_id=d.id AND v.scope='GLOBAL_PUBLIC' AND v.viewer_user_id<>d.author_user_id),1000))
        +CASE WHEN EXISTS(SELECT 1 FROM follows f WHERE f.follower_id=$1 AND f.followed_id=d.author_user_id) THEN 2 ELSE 0 END
        -least(coalesce((SELECT fi.seen_count FROM feed_impressions fi WHERE fi.viewer_user_id=$1 AND fi.drop_id=d.id),0),5)) score
       FROM drops d JOIN users u ON u.id=d.author_user_id JOIN profiles p ON p.user_id=u.id JOIN privacy_settings ps ON ps.user_id=u.id
       WHERE d.status='PUBLISHED' AND d.deleted_at IS NULL AND d.visibility='PUBLIC' AND ps.account_visibility='PUBLIC' AND u.account_state='ACTIVE'
       AND d.published_at>now()-interval '14 days' ${exclusion})
       SELECT * FROM candidates WHERE ($2::float8 IS NULL OR (score,id)<($2,$3::uuid)) ORDER BY score DESC,id DESC LIMIT $4`,
      [actor, c.score ?? null, c.id ?? null, limit + 1],
    );
    return page(q.rows, limit, (r) => ({ score: r.score, id: r.id }));
  }
  async searchUsers(
    actor: string,
    query: string,
    cursor?: string,
    requested = 20,
  ) {
    const limit = Math.min(Math.max(requested, 1), 50),
      c = decode(cursor),
      term = query.trim().toLowerCase().slice(0, 100);
    const q = await this.pool.query(
      `SELECT p.user_id,p.username_normalized username,p.display_name,greatest(similarity(p.username_normalized,$2),similarity(lower(p.display_name),$2)) score
      FROM profiles p JOIN users u ON u.id=p.user_id WHERE u.account_state='ACTIVE' AND (p.username_normalized % $2 OR lower(p.display_name) % $2 OR p.username_normalized LIKE $2||'%')
      AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=p.user_id) OR (b.blocker_id=p.user_id AND b.blocked_id=$1))
      AND ($3::float8 IS NULL OR (greatest(similarity(p.username_normalized,$2),similarity(lower(p.display_name),$2)),p.user_id)<($3,$4::uuid)) ORDER BY score DESC,p.user_id DESC LIMIT $5`,
      [actor, term, c.score ?? null, c.id ?? null, limit + 1],
    );
    return page(q.rows, limit, (r) => ({ score: r.score, id: r.user_id }));
  }
  async searchDrops(
    actor: string,
    query: string,
    cursor?: string,
    requested = 20,
  ) {
    const limit = Math.min(Math.max(requested, 1), 50),
      c = decode(cursor),
      term = query.trim().slice(0, 200);
    const q = await this.pool.query(
      `SELECT ${fields},ts_rank_cd(d.search_document,websearch_to_tsquery('simple',$2)) score FROM drops d JOIN users u ON u.id=d.author_user_id JOIN profiles p ON p.user_id=u.id JOIN privacy_settings ps ON ps.user_id=u.id
      WHERE d.status='PUBLISHED' AND d.deleted_at IS NULL AND d.visibility='PUBLIC' AND ps.account_visibility='PUBLIC' AND u.account_state='ACTIVE' AND d.search_document @@ websearch_to_tsquery('simple',$2) ${exclusion}
      AND ($3::float8 IS NULL OR (ts_rank_cd(d.search_document,websearch_to_tsquery('simple',$2)),d.id)<($3,$4::uuid)) ORDER BY score DESC,d.id DESC LIMIT $5`,
      [actor, term, c.score ?? null, c.id ?? null, limit + 1],
    );
    return page(q.rows, limit, (r) => ({ score: r.score, id: r.id }));
  }
  async searchHashtags(query: string, cursor?: string, requested = 20) {
    const limit = Math.min(Math.max(requested, 1), 50),
      c = decode(cursor),
      term = query.trim().replace(/^#/, '').toLowerCase().slice(0, 50);
    const q = await this.pool.query(
      `SELECT id,normalized,similarity(normalized,$1) score FROM hashtags WHERE (normalized % $1 OR normalized LIKE $1||'%') AND ($2::float8 IS NULL OR (similarity(normalized,$1),id)<($2,$3::uuid)) ORDER BY score DESC,id DESC LIMIT $4`,
      [term, c.score ?? null, c.id ?? null, limit + 1],
    );
    return page(q.rows, limit, (r) => ({ score: r.score, id: r.id }));
  }
  async topic(slug: string, actor: string) {
    const topic = await this.pool.query(
      'SELECT id,slug,title,description FROM topics WHERE slug=$1',
      [slug],
    );
    if (!topic.rowCount) throw new DiscoveryError('NOT_FOUND');
    const drops = await this.pool.query(
      `SELECT DISTINCT ${fields} FROM drops d JOIN users u ON u.id=d.author_user_id JOIN profiles p ON p.user_id=u.id JOIN privacy_settings ps ON ps.user_id=u.id JOIN drop_hashtags dh ON dh.drop_id=d.id JOIN topic_hashtags th ON th.hashtag_id=dh.hashtag_id WHERE th.topic_id=$2 AND d.status='PUBLISHED' AND d.deleted_at IS NULL AND d.visibility='PUBLIC' AND ps.account_visibility='PUBLIC' AND u.account_state='ACTIVE' ${exclusion} ORDER BY d.published_at DESC LIMIT 20`,
      [actor, topic.rows[0].id],
    );
    return { ...topic.rows[0], drops: drops.rows };
  }
  async suggestedUsers(actor: string, requested = 10) {
    const q = await this.pool.query(
      `WITH graph AS (SELECT f2.followed_id,count(*)::int mutuals FROM follows f1 JOIN follows f2 ON f2.follower_id=f1.followed_id WHERE f1.follower_id=$1 GROUP BY f2.followed_id) SELECT p.user_id,p.username_normalized username,p.display_name,coalesce(g.mutuals,0) mutuals FROM profiles p JOIN users u ON u.id=p.user_id JOIN privacy_settings ps ON ps.user_id=u.id LEFT JOIN graph g ON g.followed_id=p.user_id WHERE p.user_id<>$1 AND u.account_state='ACTIVE' AND ps.account_visibility='PUBLIC' AND NOT EXISTS(SELECT 1 FROM follows f WHERE f.follower_id=$1 AND f.followed_id=p.user_id) AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=p.user_id) OR (b.blocker_id=p.user_id AND b.blocked_id=$1)) ORDER BY mutuals DESC,p.user_id LIMIT $2`,
      [actor, Math.min(requested, 20)],
    );
    return q.rows;
  }
  async snapshots(kind: 'drops' | 'creators' | 'topics', requested = 20) {
    const map = {
      drops: ['trending_drop_snapshots', 'drop_id'],
      creators: ['top_creator_snapshots', 'creator_user_id'],
      topics: ['trending_topic_snapshots', 'hashtag_id'],
    } as const;
    const [table, key] = map[kind];
    const q = await this.pool.query(
      `SELECT ${key},rank,score,computed_at,window_started_at FROM ${table} WHERE computed_at=(SELECT max(computed_at) FROM ${table}) ORDER BY rank LIMIT $1`,
      [Math.min(requested, kind === 'creators' ? 100 : 50)],
    );
    return q.rows;
  }
}

export class RankingService {
  constructor(private pool: Pool) {}
  async recompute() {
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      const now = new Date();
      const trendingWindow = new Date(now.getTime() - 86400000);
      const creatorWindow = new Date(now.getTime() - 7 * 86400000);
      await c.query(
        'DELETE FROM trending_drop_snapshots WHERE window_started_at=$1',
        [trendingWindow],
      );
      await c.query(
        `INSERT INTO trending_drop_snapshots(window_started_at,drop_id,rank,score,computed_at) SELECT $1,id,row_number() OVER(ORDER BY score DESC,id),score,$2 FROM (SELECT d.id,(1.5*ln(1+count(DISTINCT l.user_id))+2*ln(1+count(DISTINCT x.author_user_id))+2.5*ln(1+count(DISTINCT r.author_user_id))+.5*ln(1+count(DISTINCT v.viewer_user_id)))*exp(-extract(epoch FROM($2-d.published_at))/86400/3) score FROM drops d JOIN users u ON u.id=d.author_user_id JOIN privacy_settings ps ON ps.user_id=u.id LEFT JOIN drop_likes l ON l.drop_id=d.id AND l.scope='GLOBAL_PUBLIC' AND l.created_at>=$1 AND l.user_id<>d.author_user_id LEFT JOIN comments x ON x.drop_id=d.id AND x.scope='GLOBAL_PUBLIC' AND x.created_at>=$1 AND x.deleted_at IS NULL AND x.author_user_id<>d.author_user_id LEFT JOIN redrops r ON r.original_drop_id=d.id AND r.scope='GLOBAL_PUBLIC' AND r.created_at>=$1 AND r.deleted_at IS NULL AND r.author_user_id<>d.author_user_id LEFT JOIN drop_views v ON v.drop_id=d.id AND v.scope='GLOBAL_PUBLIC' AND v.created_at>=$1 AND v.viewer_user_id<>d.author_user_id WHERE d.status='PUBLISHED' AND d.deleted_at IS NULL AND d.visibility='PUBLIC' AND ps.account_visibility='PUBLIC' AND u.account_state='ACTIVE' GROUP BY d.id) s ORDER BY score DESC LIMIT 100`,
        [trendingWindow, now],
      );
      await c.query(
        'DELETE FROM top_creator_snapshots WHERE window_started_at=$1',
        [creatorWindow],
      );
      await c.query(
        `INSERT INTO top_creator_snapshots(window_started_at,creator_user_id,rank,score,computed_at)
         SELECT $1,creator_user_id,row_number() OVER(ORDER BY score DESC,creator_user_id),score,$2 FROM (
          SELECT u.id creator_user_id,
           2*ln(1+(SELECT count(DISTINCT l.user_id) FROM drop_likes l JOIN drops d ON d.id=l.drop_id WHERE d.author_user_id=u.id AND l.scope='GLOBAL_PUBLIC' AND l.created_at>=$1 AND l.user_id<>u.id))+
           3*ln(1+(SELECT count(DISTINCT x.author_user_id) FROM comments x JOIN drops d ON d.id=x.drop_id WHERE d.author_user_id=u.id AND x.scope='GLOBAL_PUBLIC' AND x.created_at>=$1 AND x.deleted_at IS NULL AND x.author_user_id<>u.id))+
           3*ln(1+(SELECT count(DISTINCT r.author_user_id) FROM redrops r JOIN drops d ON d.id=r.original_drop_id WHERE d.author_user_id=u.id AND r.scope='GLOBAL_PUBLIC' AND r.created_at>=$1 AND r.deleted_at IS NULL AND r.author_user_id<>u.id))+
           ln(1+(SELECT count(DISTINCT v.viewer_user_id) FROM drop_views v JOIN drops d ON d.id=v.drop_id WHERE d.author_user_id=u.id AND v.scope='GLOBAL_PUBLIC' AND v.created_at>=$1 AND v.viewer_user_id<>u.id))+
           .5*least((SELECT count(*) FROM drops d WHERE d.author_user_id=u.id AND d.status='PUBLISHED' AND d.visibility='PUBLIC' AND d.published_at>=$1),7) score
          FROM users u JOIN privacy_settings ps ON ps.user_id=u.id WHERE u.account_state='ACTIVE' AND ps.account_visibility='PUBLIC') ranked
         WHERE score>0 ORDER BY score DESC LIMIT 100`,
        [creatorWindow, now],
      );
      await c.query(
        'DELETE FROM trending_topic_snapshots WHERE window_started_at=$1',
        [trendingWindow],
      );
      await c.query(
        `INSERT INTO trending_topic_snapshots(window_started_at,hashtag_id,rank,score,computed_at)
         SELECT $1,hashtag_id,row_number() OVER(ORDER BY score DESC,hashtag_id),score,$2 FROM (
          SELECT dh.hashtag_id, count(DISTINCT d.author_user_id)*2 + ln(1+count(DISTINCT d.id)) +
           ln(1+count(DISTINCT l.user_id)) + 1.5*ln(1+count(DISTINCT x.author_user_id)) score
          FROM drop_hashtags dh JOIN drops d ON d.id=dh.drop_id JOIN users u ON u.id=d.author_user_id JOIN privacy_settings ps ON ps.user_id=u.id
          LEFT JOIN drop_likes l ON l.drop_id=d.id AND l.scope='GLOBAL_PUBLIC' AND l.created_at>=$1 AND l.user_id<>d.author_user_id
          LEFT JOIN comments x ON x.drop_id=d.id AND x.scope='GLOBAL_PUBLIC' AND x.created_at>=$1 AND x.deleted_at IS NULL AND x.author_user_id<>d.author_user_id
          WHERE d.status='PUBLISHED' AND d.deleted_at IS NULL AND d.visibility='PUBLIC' AND d.published_at>=$1 AND u.account_state='ACTIVE' AND ps.account_visibility='PUBLIC'
          GROUP BY dh.hashtag_id HAVING count(DISTINCT d.author_user_id)>=2) topics ORDER BY score DESC LIMIT 50`,
        [trendingWindow, now],
      );
      await c.query(
        `INSERT INTO outbox_events(event_type,aggregate_type,aggregate_id,payload,request_id)
        SELECT 'TrendingAchieved','Drop',drop_id,jsonb_build_object('ranking_window',$1::timestamptz::text),'ranking-recompute' FROM trending_drop_snapshots WHERE window_started_at=$1::timestamptz AND rank<=10`,
        [trendingWindow],
      );
      await c.query(
        `INSERT INTO outbox_events(event_type,aggregate_type,aggregate_id,payload,request_id)
        SELECT 'Top100Achieved','User',creator_user_id,jsonb_build_object('recipient_user_id',creator_user_id::text,'ranking_window',$1::timestamptz::text),'ranking-recompute' FROM top_creator_snapshots WHERE window_started_at=$1::timestamptz`,
        [creatorWindow],
      );
      await c.query('COMMIT');
      return {
        computed_at: now,
        trending_window_started_at: trendingWindow,
        creator_window_started_at: creatorWindow,
      };
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    } finally {
      c.release();
    }
  }
}
