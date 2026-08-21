import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import {
  assertTestDatabase,
  migrate,
} from '../../packages/database/src/migrate.js';
const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;
let pool: pg.Pool;
run('real PostgreSQL migration and constraints', () => {
  beforeAll(async () => {
    if (!url) throw new Error('TEST_DATABASE_URL required');
    assertTestDatabase(url);
    pool = new pg.Pool({ connectionString: url });
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    await migrate(url);
  });
  afterAll(async () => pool?.end());
  it('creates all Step 6 tables', async () => {
    const q = await pool.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public'",
    );
    expect(q.rows.map((r) => r.tablename)).toEqual(
      expect.arrayContaining([
        'users',
        'user_credentials',
        'profiles',
        'sessions',
        'email_verification_tokens',
        'password_reset_tokens',
        'privacy_settings',
        'account_deletion_requests',
      ]),
    );
  });
  it('enforces case-insensitive email races', async () => {
    await pool.query(
      "INSERT INTO users(email_normalized) VALUES('person@example.com')",
    );
    await expect(
      pool.query(
        "INSERT INTO users(email_normalized) VALUES('PERSON@example.com')",
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });
  it('refuses production-like database URLs', () => {
    expect(() => assertTestDatabase('postgresql://x@production/db')).toThrow();
  });
});
