import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import {
  assertTestDatabase,
  migrate,
} from '../../packages/database/src/migrate.js';
import {
  DiscoveryService,
  RankingService,
} from '../../packages/discovery/src/service.js';

const url = process.env.TEST_DATABASE_URL,
  run = url ? describe : describe.skip;
let pool: pg.Pool, discovery: DiscoveryService, ranking: RankingService;
async function user(name: string, privacy: 'PUBLIC' | 'PRIVATE' = 'PUBLIC') {
  const q = await pool.query(
    'INSERT INTO users(email_normalized) VALUES($1) RETURNING id',
    [`${name}@test.local`],
  );
  await pool.query(
    'INSERT INTO profiles(user_id,username_normalized,display_name) VALUES($1,$2,$3)',
    [q.rows[0].id, name, `Name ${name}`],
  );
  await pool.query(
    'INSERT INTO privacy_settings(user_id,account_visibility) VALUES($1,$2)',
    [q.rows[0].id, privacy],
  );
  return q.rows[0].id as string;
}
async function drop(
  author: string,
  body: string,
  status = 'PUBLISHED',
  visibility = 'PUBLIC',
) {
  const q = await pool.query(
    `INSERT INTO drops(author_user_id,status,visibility,body,published_at) VALUES($1,$2,$3,$4,CASE WHEN $2='PUBLISHED' THEN now() END) RETURNING id`,
    [author, status, visibility, body],
  );
  return q.rows[0].id as string;
}
run('Step 11 discovery on real PostgreSQL', () => {
  beforeAll(async () => {
    if (!url) throw new Error('TEST_DATABASE_URL required');
    assertTestDatabase(url);
    pool = new pg.Pool({ connectionString: url });
    await pool.query('DROP SCHEMA public CASCADE;CREATE SCHEMA public');
    await migrate(url);
    discovery = new DiscoveryService(pool);
    ranking = new RankingService(pool);
  });
  afterAll(async () => pool?.end());
  it('enforces feed eligibility and stable cursor pagination', async () => {
    const viewer = await user('viewer'),
      good = await user('good'),
      muted = await user('muted'),
      blocked = await user('blocked'),
      privateUser = await user('privateuser', 'PRIVATE');
    await pool.query(
      'INSERT INTO follows(follower_id,followed_id) SELECT $1,x FROM unnest($2::uuid[]) x',
      [viewer, [good, muted, blocked, privateUser]],
    );
    await pool.query('INSERT INTO mutes(muter_id,muted_id) VALUES($1,$2)', [
      viewer,
      muted,
    ]);
    await pool.query(
      'INSERT INTO blocks(blocker_id,blocked_id) VALUES($1,$2)',
      [blocked, viewer],
    );
    const first = await drop(good, 'first');
    await new Promise((r) => setTimeout(r, 5));
    const second = await drop(good, 'second');
    await drop(muted, 'muted');
    await drop(blocked, 'blocked');
    await drop(privateUser, 'private', 'PUBLISHED', 'FOLLOWERS');
    const deleted = await drop(good, 'deleted');
    await pool.query(
      "UPDATE drops SET status='DELETED',deleted_at=now() WHERE id=$1",
      [deleted],
    );
    const p1 = await discovery.following(viewer, undefined, 1);
    expect(p1.items.map((x) => x.id)).toEqual([second]);
    expect(p1.next_cursor).toBeTruthy();
    const p2 = await discovery.following(viewer, p1.next_cursor!, 1);
    expect(p2.items.map((x) => x.id)).toEqual([first]);
    expect([...p1.items, ...p2.items].map((x) => x.body)).not.toEqual(
      expect.arrayContaining(['muted', 'blocked', 'private', 'deleted']),
    );
  });
  it('searches users, Drops and hashtags without leaking blocked/private/draft/deleted content or interpreting SQL injection', async () => {
    const viewer = await user('searcher'),
      author = await user('findable'),
      hidden = await user('hidden', 'PRIVATE'),
      blocked = await user('blockedsearch');
    const visible = await drop(author, 'orchid searchable');
    const privateDrop = await drop(hidden, 'orchid private');
    const draft = await drop(author, 'orchid draft', 'DRAFT');
    const deleted = await drop(author, 'orchid deleted');
    await pool.query(
      "UPDATE drops SET status='DELETED',deleted_at=now() WHERE id=$1",
      [deleted],
    );
    const blockedDrop = await drop(blocked, 'orchid blocked');
    await pool.query(
      'INSERT INTO blocks(blocker_id,blocked_id) VALUES($1,$2)',
      [viewer, blocked],
    );
    const h = await pool.query(
      "INSERT INTO hashtags(normalized) VALUES('orchid') RETURNING id",
    );
    await pool.query(
      'INSERT INTO drop_hashtags(drop_id,hashtag_id) VALUES($1,$2)',
      [visible, h.rows[0].id],
    );
    expect(
      (await discovery.searchUsers(viewer, 'findabl')).items.map(
        (x) => x.username,
      ),
    ).toContain('findable');
    expect(
      (await discovery.searchUsers(viewer, 'blockedsearch')).items,
    ).toHaveLength(0);
    const found = (await discovery.searchDrops(viewer, 'orchid')).items.map(
      (x) => x.id,
    );
    expect(found).toContain(visible);
    expect(found).not.toEqual(
      expect.arrayContaining([privateDrop, draft, deleted, blockedDrop]),
    );
    expect(
      (await discovery.searchHashtags('#orhid')).items.map((x) => x.normalized),
    ).toContain('orchid');
    expect(
      (await discovery.searchDrops(viewer, "' OR 1=1 --")).items,
    ).toHaveLength(0);
  });
  it('ignores 10,000 CLUB_INTERNAL engagements but counts GLOBAL_PUBLIC distribution', async () => {
    const creator = await user('rankcreator'),
      publicFan = await user('publicfan'),
      d = await drop(creator, 'ranking target');
    await pool.query(
      `WITH made AS (INSERT INTO users(email_normalized) SELECT 'club'||g||'@test.local' FROM generate_series(1,10000) g RETURNING id) INSERT INTO profiles(user_id,username_normalized,display_name) SELECT id,'club'||row_number() OVER(),'Club' FROM made`,
    );
    await pool.query(
      "INSERT INTO privacy_settings(user_id) SELECT id FROM users WHERE email_normalized LIKE 'club%@test.local'",
    );
    await pool.query(
      "INSERT INTO drop_likes(drop_id,user_id,scope) SELECT $1,id,'CLUB_INTERNAL' FROM users WHERE email_normalized LIKE 'club%@test.local'",
      [d],
    );
    await pool.query(
      "INSERT INTO comments(drop_id,author_user_id,body,scope) SELECT $1,id,'club','CLUB_INTERNAL' FROM users WHERE email_normalized LIKE 'club%@test.local' LIMIT 100",
      [d],
    );
    await pool.query(
      "INSERT INTO drop_views(drop_id,viewer_user_id,window_started_at,scope) SELECT $1,id,date_trunc('hour',now()),'CLUB_INTERNAL' FROM users WHERE email_normalized LIKE 'club%@test.local'",
      [d],
    );
    await ranking.recompute();
    const club = await pool.query(
      'SELECT score FROM trending_drop_snapshots WHERE drop_id=$1 ORDER BY computed_at DESC LIMIT 1',
      [d],
    );
    expect(Number(club.rows[0].score)).toBe(0);
    await pool.query(
      "INSERT INTO drop_likes(drop_id,user_id,scope) VALUES($1,$2,'GLOBAL_PUBLIC')",
      [d, publicFan],
    );
    await ranking.recompute();
    const global = await pool.query(
      'SELECT score FROM trending_drop_snapshots WHERE drop_id=$1 ORDER BY computed_at DESC LIMIT 1',
      [d],
    );
    expect(Number(global.rows[0].score)).toBeGreaterThan(0);
    const top = await pool.query(
      'SELECT rank FROM top_creator_snapshots WHERE creator_user_id=$1',
      [creator],
    );
    expect(top.rows[0].rank).toBe(1);
  });
});
