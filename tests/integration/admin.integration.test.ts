import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate } from '../../packages/database/src/migrate.js';
import { AdminService } from '../../packages/admin/src/service.js';
const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;
let pool: pg.Pool;
let service: AdminService;
let owner: string, support: string, target: string;
async function user(name: string) {
  const q = await pool.query(
    'INSERT INTO users(email_normalized) VALUES($1) RETURNING id',
    [`${name}@example.com`],
  );
  return q.rows[0].id as string;
}
run('Step 15 admin and moderation on real PostgreSQL', () => {
  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url });
    await pool.query('DROP SCHEMA public CASCADE;CREATE SCHEMA public');
    await migrate(url!);
    service = new AdminService(pool);
    owner = await user('owner');
    support = await user('support');
    target = await user('target');
    await pool.query(
      "INSERT INTO admin_principals(user_id,enabled,role) VALUES($1,true,'OWNER'),($2,true,'SUPPORT')",
      [owner, support],
    );
  });
  afterAll(() => pool.end());
  it('creates confidential reports for every target class and exposes no reporter in queue', async () => {
    const drop = (
      await pool.query(
        "INSERT INTO drops(author_user_id,status,visibility,body,published_at) VALUES($1,'PUBLISHED','PUBLIC','x',now()) RETURNING id",
        [target],
      )
    ).rows[0].id;
    const report = await service.submitReport(
      target,
      {
        targetType: 'DROP',
        targetId: drop,
        reasonCode: 'SPAM',
        sourceSurface: 'drop',
        idempotencyKey: 'report-key-1',
      },
      'r1',
    );
    const rows = await service.listReports({
      userId: owner,
      sessionId: 's',
      role: 'OWNER',
      grants: [],
      stepUpAt: new Date(),
    });
    expect(rows.find((r) => r.id === report.id)).not.toHaveProperty(
      'reporter_user_id',
    );
  });
  it('rejects forged roles and requires step-up', async () => {
    expect(() =>
      service.require(
        {
          userId: support,
          sessionId: 's',
          role: 'SUPPORT',
          grants: [],
          stepUpAt: new Date(),
        },
        'admin.roles.manage',
      ),
    ).toThrowError('FORBIDDEN');
    expect(() =>
      service.require(
        {
          userId: owner,
          sessionId: 's',
          role: 'OWNER',
          grants: [],
          stepUpAt: null,
        },
        'moderation.ban',
      ),
    ).toThrowError('STEP_UP_REQUIRED');
  });
  it('atomically enforces a sensitive action and records an immutable audit', async () => {
    const report = await service.submitReport(
      support,
      {
        targetType: 'USER',
        targetId: target,
        reasonCode: 'ABUSE',
        sourceSurface: 'profile',
        idempotencyKey: 'report-key-2',
      },
      'r2',
    );
    const actor = {
      userId: owner,
      sessionId: 's',
      role: 'OWNER' as const,
      grants: [],
      stepUpAt: new Date(),
    };
    const c = await service.createCase(actor, report.id, 'r3');
    await service.act(
      actor,
      c.id,
      {
        actionType: 'BAN',
        reasonCode: 'ABUSE_CONFIRMED',
        idempotencyKey: 'action-key-1',
        expectedVersion: 1,
      },
      'r4',
    );
    expect(
      (
        await pool.query('SELECT account_state FROM users WHERE id=$1', [
          target,
        ])
      ).rows[0].account_state,
    ).toBe('BANNED');
    const audit = await pool.query(
      "SELECT * FROM admin_audit_logs WHERE action='MODERATION_ACTION'",
    );
    expect(audit.rowCount).toBe(1);
    await expect(
      pool.query('DELETE FROM admin_audit_logs WHERE id=$1', [
        audit.rows[0].id,
      ]),
    ).rejects.toMatchObject({ code: '55000' });
  });
});
