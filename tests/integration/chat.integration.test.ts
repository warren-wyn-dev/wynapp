import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import {
  assertTestDatabase,
  migrate,
} from '../../packages/database/src/migrate.js';
import { ChatError, ChatService } from '../../packages/chat/src/service.js';
const url = process.env.TEST_DATABASE_URL,
  run = url ? describe : describe.skip;
let pool: pg.Pool, chat: ChatService;
async function user(name: string, who: string | null = null) {
  const q = await pool.query(
    'INSERT INTO users(email_normalized) VALUES($1) RETURNING id',
    [`${name}@test.local`],
  );
  await pool.query(
    'INSERT INTO profiles(user_id,username_normalized,display_name) VALUES($1,$2,$2)',
    [q.rows[0].id, name],
  );
  await pool.query(
    'INSERT INTO privacy_settings(user_id,who_can_message) VALUES($1,$2)',
    [q.rows[0].id, who],
  );
  return q.rows[0].id as string;
}
run('Step 14 chat on real PostgreSQL', () => {
  beforeAll(async () => {
    if (!url) throw Error('TEST_DATABASE_URL required');
    assertTestDatabase(url);
    pool = new pg.Pool({ connectionString: url });
    await pool.query('DROP SCHEMA public CASCADE;CREATE SCHEMA public');
    await migrate(url);
    chat = new ChatService(pool);
  });
  afterAll(async () => pool?.end());
  it('creates one canonical conversation under a race and accepts a request', async () => {
    const a = await user('chata'),
      b = await user('chatb');
    const [x, y] = await Promise.all([
      chat.create(a, b, 'r1'),
      chat.create(a, b, 'r2'),
    ]);
    expect(x.conversation_id).toBe(y.conversation_id);
    expect(
      (await pool.query('SELECT count(*) FROM conversations')).rows[0].count,
    ).toBe('1');
    const request = (await chat.requests(b))[0];
    await chat.decide(request.id, b, 'ACCEPTED', 'r3');
    expect((await chat.list(a))[0].id).toBe(x.conversation_id);
  });
  it('commits idempotent text/reply, paginates, reads, and restricts deletion', async () => {
    const a = await user('sendra', 'EVERYONE'),
      b = await user('sendrb', 'EVERYONE'),
      outsider = await user('outside');
    const c = await chat.create(a, b, 'c');
    const key = randomUUID(),
      m = await chat.send(
        c.conversation_id,
        a,
        {
          kind: 'TEXT',
          body: '<script>plain text</script>',
          clientMessageId: key,
        },
        's',
      );
    const retry = await chat.send(
      c.conversation_id,
      a,
      { kind: 'TEXT', body: 'retry', clientMessageId: key },
      's2',
    );
    expect(retry.id).toBe(m.id);
    const reply = await chat.send(
      c.conversation_id,
      b,
      {
        kind: 'TEXT',
        body: 'reply',
        replyToMessageId: m.id,
        clientMessageId: randomUUID(),
      },
      's3',
    );
    expect(
      (
        await chat.messages(c.conversation_id, a, {
          before: reply.sequence,
          limit: 1,
        })
      )[0].id,
    ).toBe(m.id);
    await expect(
      chat.messages(c.conversation_id, outsider, {}),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(chat.remove(m.id, b, 'bad')).rejects.toBeInstanceOf(ChatError);
    await chat.read(c.conversation_id, b, reply.sequence);
    expect(
      (
        await pool.query(
          'SELECT last_read_sequence FROM conversation_members WHERE conversation_id=$1 AND user_id=$2',
          [c.conversation_id, b],
        )
      ).rows[0].last_read_sequence,
    ).toBe(String(reply.sequence));
    await chat.remove(m.id, a, 'del');
    expect(
      (await chat.messages(c.conversation_id, b, {})).find((x) => x.id === m.id)
        .deleted,
    ).toBe(true);
  });
  it('enforces image ownership, same-conversation replies, blocks, and report evidence', async () => {
    const a = await user('securea', 'EVERYONE'),
      b = await user('secureb', 'EVERYONE'),
      c = await user('securec', 'EVERYONE');
    const ab = await chat.create(a, b, 'ab'),
      ac = await chat.create(a, c, 'ac');
    const foreign = await chat.send(
      ac.conversation_id,
      a,
      { kind: 'TEXT', body: 'foreign', clientMessageId: randomUUID() },
      'f',
    );
    await expect(
      chat.send(
        ab.conversation_id,
        a,
        {
          kind: 'TEXT',
          body: 'bad reply',
          replyToMessageId: foreign.id,
          clientMessageId: randomUUID(),
        },
        'x',
      ),
    ).rejects.toMatchObject({ code: 'INVALID_REPLY' });
    const media = await pool.query(
      "INSERT INTO media_assets(owner_user_id,purpose,status,source_mime,processed_mime,width,height,byte_size,storage_key,thumbnail_key,feed_variant_key,full_variant_key,intent_expires_at,processed_at) VALUES($1,'CHAT_IMAGE','READY','image/png','image/webp',1,1,10,$2,$3,$4,$5,now()+interval '1 hour',now()) RETURNING id",
      [b, `quarantine/${randomUUID()}/source`, 't', 'f', 'full'],
    );
    await expect(
      chat.send(
        ab.conversation_id,
        a,
        {
          kind: 'IMAGE',
          mediaAssetId: media.rows[0].id,
          clientMessageId: randomUUID(),
        },
        'i',
      ),
    ).rejects.toMatchObject({ code: 'INVALID_MEDIA' });
    const evidence = await chat.send(
      ab.conversation_id,
      b,
      { kind: 'TEXT', body: 'report me', clientMessageId: randomUUID() },
      'e',
    );
    await chat.report(evidence.id, a, 'harassment');
    await pool.query(
      'INSERT INTO blocks(blocker_id,blocked_id) VALUES($1,$2)',
      [b, a],
    );
    await expect(
      chat.send(
        ab.conversation_id,
        a,
        { kind: 'TEXT', body: 'blocked', clientMessageId: randomUUID() },
        'z',
      ),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      chat.messages(ab.conversation_id, a, {}),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
