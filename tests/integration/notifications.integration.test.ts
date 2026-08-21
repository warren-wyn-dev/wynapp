import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import pg from 'pg';
import {
  assertTestDatabase,
  migrate,
} from '../../packages/database/src/migrate.js';
import {
  NotificationError,
  NotificationService,
} from '../../packages/notifications/src/service.js';
import { NotificationWorker } from '../../apps/worker/src/worker.js';
const url = process.env.TEST_DATABASE_URL,
  run = url ? describe : describe.skip;
let pool: pg.Pool, service: NotificationService;
async function user(name: string) {
  const q = await pool.query(
    'INSERT INTO users(email_normalized) VALUES($1) RETURNING id',
    [`${name}@test.local`],
  );
  await pool.query(
    'INSERT INTO profiles(user_id,username_normalized,display_name) VALUES($1,$2,$2)',
    [q.rows[0].id, name],
  );
  await pool.query('INSERT INTO privacy_settings(user_id) VALUES($1)', [
    q.rows[0].id,
  ]);
  return q.rows[0].id as string;
}
async function drop(owner: string) {
  return (
    await pool.query(
      "INSERT INTO drops(author_user_id,status,visibility,body,published_at) VALUES($1,'PUBLISHED','PUBLIC','x',now()) RETURNING id",
      [owner],
    )
  ).rows[0].id as string;
}
async function event(
  type: string,
  id: string,
  payload: object,
  aggregate = 'Drop',
) {
  return (
    await pool.query(
      'INSERT INTO outbox_events(event_type,aggregate_type,aggregate_id,payload,request_id) VALUES($1,$2,$3,$4,$5) RETURNING id',
      [type, aggregate, id, payload, 'test'],
    )
  ).rows[0].id as string;
}
run('Step 12 notifications on PostgreSQL', () => {
  beforeAll(async () => {
    if (!url) throw new Error('TEST_DATABASE_URL required');
    assertTestDatabase(url);
    pool = new pg.Pool({ connectionString: url });
    await pool.query('DROP SCHEMA public CASCADE;CREATE SCHEMA public');
    await migrate(url!);
    service = new NotificationService(pool);
  });
  afterAll(() => pool.end());
  beforeEach(async () => {
    await pool.query('TRUNCATE outbox_events CASCADE');
    await pool.query('TRUNCATE users CASCADE');
  });
  it('creates, dedupes, paginates, counts and marks only recipient rows', async () => {
    const a = await user('alice'),
      b = await user('bob'),
      d = await drop(b),
      e = await event('DropLiked', d, { actor_user_id: a });
    expect(await service.processEvent(e)).toBe('CREATED');
    expect(await service.processEvent(e)).toBe('DUPLICATE');
    expect(await service.unread(b)).toBe(1);
    const inbox = await service.list(b);
    expect(inbox.items).toHaveLength(1);
    expect((await service.list(a)).items).toHaveLength(0);
    await expect(service.read(a, inbox.items[0].id)).rejects.toBeInstanceOf(
      NotificationError,
    );
    await service.read(b, inbox.items[0].id);
    expect(await service.unread(b)).toBe(0);
    const second = await event('CommentCreated', d, { actor_user_id: a });
    expect(await service.processEvent(second)).toBe('CREATED');
    expect(await service.readAll(b)).toBe(1);
    expect(await service.unread(b)).toBe(0);
  });
  it('rechecks preferences, blocks, deletion and visibility', async () => {
    const a = await user('alice'),
      b = await user('bob'),
      d = await drop(b);
    await service.setPreferences(b, {
      preferences: [{ category: 'LIKES', in_app_enabled: false }],
    });
    expect(
      await service.processEvent(
        await event('DropLiked', d, { actor_user_id: a }),
      ),
    ).toBe('SUPPRESSED');
    await pool.query('DELETE FROM notification_preferences');
    await pool.query(
      'INSERT INTO blocks(blocker_id,blocked_id) VALUES($1,$2)',
      [b, a],
    );
    expect(
      await service.processEvent(
        await event('DropLiked', d, { actor_user_id: a }),
      ),
    ).toBe('SUPPRESSED');
    await pool.query('DELETE FROM blocks');
    await pool.query(
      "UPDATE drops SET deleted_at=now(),status='DELETED' WHERE id=$1",
      [d],
    );
    expect(
      await service.processEvent(
        await event('DropLiked', d, { actor_user_id: a }),
      ),
    ).toBe('SUPPRESSED');
  });
  it('rejects forged system facts and stores owned push subscriptions', async () => {
    const a = await user('alice'),
      b = await user('bob');
    await expect(
      service.processEvent(
        await event(
          'SystemAnnouncementPublished',
          a,
          { recipient_user_id: a, title: 'x' },
          'User',
        ),
      ),
    ).rejects.toMatchObject({ code: 'UNTRUSTED_SYSTEM_EVENT' });
    expect(
      await service.processEvent(
        await event(
          'SystemAnnouncementPublished',
          a,
          { recipient_user_id: b, title: 'Trusted update' },
          'System',
        ),
      ),
    ).toBe('CREATED');
    const s = await service.subscribe(a, {
      endpoint: 'https://push.test/subscription',
      keys: { p256dh: '12345678', auth: 'abcdefgh' },
      permission_state: 'GRANTED',
    });
    expect(
      (
        await pool.query(
          'SELECT endpoint FROM push_subscriptions WHERE user_id=$1',
          [a],
        )
      ).rows[0].endpoint,
    ).toContain('push.test');
    await expect(service.unsubscribe(b, s.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await service.unsubscribe(a, s.id);
    expect(
      (await pool.query('SELECT 1 FROM push_subscriptions')).rowCount,
    ).toBe(0);
  });
  it('dispatches outbox delivery and retries malformed events without silent loss', async () => {
    const a = await user('alice'),
      b = await user('bob'),
      d = await drop(b),
      worker = new NotificationWorker(pool);
    await event('DropLiked', d, { actor_user_id: a });
    expect(await worker.dispatch()).toBeGreaterThan(0);
    await pool.query(
      "UPDATE outbox_deliveries SET locked_until=now()+interval '1 minute'",
    );
    expect(await worker.runOnce()).toBe('IDLE');
    await pool.query('UPDATE outbox_deliveries SET locked_until=NULL');
    expect(await worker.runOnce()).toBe('DELIVERED');
    expect(await service.unread(b)).toBe(1);
    await event('DropLiked', d, { actor_user_id: 'not-a-uuid' });
    await worker.dispatch();
    expect(await worker.runOnce()).toBe('RETRY');
    expect(
      (
        await pool.query(
          'SELECT attempt_count,last_error_code FROM outbox_deliveries WHERE delivered_at IS NULL',
        )
      ).rows[0],
    ).toMatchObject({ attempt_count: 1, last_error_code: 'ZodError' });
    for (let attempt = 1; attempt < 5; attempt++) {
      await pool.query(
        'UPDATE outbox_deliveries SET available_at=now(),locked_until=NULL WHERE delivered_at IS NULL',
      );
      expect(await worker.runOnce()).toBe(
        attempt === 4 ? 'DEAD_LETTER' : 'RETRY',
      );
    }
    expect(
      (
        await pool.query(
          'SELECT attempt_count,dead_lettered_at FROM outbox_deliveries WHERE delivered_at IS NULL',
        )
      ).rows[0],
    ).toMatchObject({ attempt_count: 5 });
  });
});
