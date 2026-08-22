import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import {
  assertTestDatabase,
  deployMigrations,
  MIGRATION_FILES,
} from '../../packages/database/src/migrate.js';
const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;
let pool: pg.Pool;
run('deployMigrations (real, persistent-database path)', () => {
  beforeAll(async () => {
    if (!url) throw new Error('TEST_DATABASE_URL required');
    assertTestDatabase(url);
    pool = new pg.Pool({ connectionString: url });
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  });
  afterAll(async () => pool?.end());

  it('applies every migration on a fresh database, then no-ops on redeploy', async () => {
    const first = await deployMigrations(url!);
    expect(first.applied).toEqual([...MIGRATION_FILES]);
    expect(first.alreadyApplied).toEqual([]);

    const q = await pool.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public'",
    );
    expect(q.rows.map((r) => r.tablename)).toEqual(
      expect.arrayContaining(['users', 'admin_principals']),
    );

    // A second run against the same, now-migrated database is what a
    // redeploy looks like — it must not try to re-run any migration
    // (which would fail on the first already-exists object) and must
    // report every one as already applied.
    const second = await deployMigrations(url!);
    expect(second.applied).toEqual([]);
    expect(second.alreadyApplied).toEqual([...MIGRATION_FILES]);
  });

  it('applies only newly-added migrations, leaving prior ones alone', async () => {
    await pool.query(
      "DELETE FROM schema_migrations WHERE name='0011_media_club_purposes.sql'",
    );
    const result = await deployMigrations(url!);
    expect(result.applied).toEqual(['0011_media_club_purposes.sql']);
    expect(result.alreadyApplied).toHaveLength(MIGRATION_FILES.length - 1);
  });
});
