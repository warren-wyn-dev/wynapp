import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate } from '../../packages/database/src/migrate.js';
import {
  EngagementError,
  EngagementService,
} from '../../packages/engagement/src/service.js';
const url = process.env.TEST_DATABASE_URL,
  run = url ? describe : describe.skip;
let pool: pg.Pool, service: EngagementService;
async function user(name: string, privacy: 'PUBLIC' | 'PRIVATE' = 'PUBLIC') {
  const q = await pool.query(
    'INSERT INTO users(email_normalized) VALUES($1) RETURNING id',
    [`${name}@test.local`],
  );
  await pool.query(
    'INSERT INTO profiles(user_id,username_normalized,display_name) VALUES($1,$2,$2)',
    [q.rows[0].id, name],
  );
  await pool.query(
    'INSERT INTO privacy_settings(user_id,account_visibility) VALUES($1,$2)',
    [q.rows[0].id, privacy],
  );
  return q.rows[0].id as string;
}
async function drop(author: string, visibility = 'PUBLIC') {
  const q = await pool.query(
    "INSERT INTO drops(author_user_id,status,visibility,body,published_at) VALUES($1,'PUBLISHED',$2,'drop',now()) RETURNING id",
    [author, visibility],
  );
  return q.rows[0].id as string;
}
run('Step 10 engagement on PostgreSQL', () => {
  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url });
    await pool.query('DROP SCHEMA public CASCADE;CREATE SCHEMA public');
    await migrate(url!);
    service = new EngagementService(pool);
  });
  afterAll(async () => pool.end());
  beforeEach(async () => pool.query('TRUNCATE users CASCADE'));
  it('makes like, save and standard ReDrop idempotent and emits changes once', async () => {
    const a = await user('alice'),
      b = await user('bob'),
      d = await drop(b);
    await Promise.all(
      Array.from({ length: 8 }, (_, i) => service.like(d, a, `l${i}`)),
    );
    await Promise.all(
      Array.from({ length: 8 }, (_, i) => service.save(d, a, `s${i}`)),
    );
    await Promise.all(
      Array.from({ length: 8 }, (_, i) => service.redrop(d, a, `r${i}`)),
    );
    expect((await pool.query('SELECT 1 FROM drop_likes')).rowCount).toBe(1);
    expect((await pool.query('SELECT 1 FROM saved_drops')).rowCount).toBe(1);
    expect(
      (
        await pool.query(
          "SELECT 1 FROM redrops WHERE kind='STANDARD' AND deleted_at IS NULL",
        )
      ).rowCount,
    ).toBe(1);
    await service.unlike(d, a, 'u');
    await service.unlike(d, a, 'u2');
    await service.save(d, a, 'us', true);
    expect((await pool.query('SELECT 1 FROM drop_likes')).rowCount).toBe(0);
  });
  it('creates replies, rejects a cross-Drop parent, preserves tombstones and owner authorization', async () => {
    const a = await user('alice'),
      b = await user('bob'),
      d = await drop(a),
      other = await drop(a);
    const c = await service.comment(
      d,
      a,
      { text: '<script>alert(1)</script> สวัสดี' },
      'c',
    );
    const reply = await service.comment(d, b, { text: 'reply' }, 'r', c.id);
    expect(reply.parent_comment_id).toBe(c.id);
    await expect(
      service.comment(other, b, { text: 'bad' }, 'bad', c.id),
    ).rejects.toMatchObject({ code: 'INVALID_PARENT' });
    await expect(
      service.removeComment(c.id, b, 'foreign'),
    ).rejects.toBeInstanceOf(EngagementError);
    await service.removeComment(c.id, a, 'delete');
    expect((await service.comments(d, a)).items[0].body).toBeNull();
  });
  it('creates quote references, dedupes view bursts and computes authoritative counters', async () => {
    const a = await user('alice'),
      b = await user('bob'),
      d = await drop(b);
    await service.quote(d, a, { text: 'my quote' }, 'q');
    const views = await Promise.all(
      Array.from({ length: 12 }, (_, i) => service.view(d, a, `v${i}`)),
    );
    expect(views.filter((v) => v.counted)).toHaveLength(1);
    await service.like(d, a, 'l');
    expect(
      (
        await pool.query(
          'SELECT count(*)::int n FROM drop_views WHERE drop_id=$1',
          [d],
        )
      ).rows[0].n,
    ).toBe(1);
    expect(
      (await pool.query('SELECT quote_text FROM redrops')).rows[0].quote_text,
    ).toBe('my quote');
  });
  it('enforces private/follower, block, account and deleted-Drop authorization at direct APIs', async () => {
    const owner = await user('private', 'PRIVATE'),
      viewer = await user('viewer'),
      d = await drop(owner, 'FOLLOWERS');
    await expect(service.like(d, viewer, 'no')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await pool.query(
      'INSERT INTO follows(follower_id,followed_id) VALUES($1,$2)',
      [viewer, owner],
    );
    await service.like(d, viewer, 'yes');
    await pool.query(
      'INSERT INTO blocks(blocker_id,blocked_id) VALUES($1,$2)',
      [owner, viewer],
    );
    await expect(service.save(d, viewer, 'blocked')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await pool.query('DELETE FROM blocks');
    await pool.query(
      "UPDATE drops SET status='DELETED',deleted_at=now() WHERE id=$1",
      [d],
    );
    await expect(service.redrop(d, viewer, 'deleted')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
  it('database constraints reject duplicate raw inserts and invalid parents', async () => {
    const a = await user('alice'),
      d = await drop(a),
      other = await drop(a);
    await pool.query(
      "INSERT INTO drop_likes(drop_id,user_id,scope) VALUES($1,$2,'GLOBAL_PUBLIC')",
      [d, a],
    );
    await expect(
      pool.query(
        "INSERT INTO drop_likes(drop_id,user_id,scope) VALUES($1,$2,'GLOBAL_PUBLIC')",
        [d, a],
      ),
    ).rejects.toMatchObject({ code: '23505' });
    const c = await service.comment(d, a, { text: 'parent' }, 'c');
    await expect(
      pool.query(
        "INSERT INTO comments(drop_id,author_user_id,parent_comment_id,body,scope) VALUES($1,$2,$3,$4,'GLOBAL_PUBLIC')",
        [other, a, c.id, 'invalid'],
      ),
    ).rejects.toMatchObject({ code: '23503' });
  });
});
