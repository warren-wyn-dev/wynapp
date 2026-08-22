import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

export const MIGRATION_FILES = [
  '0001_step6_identity.sql',
  '0002_step7_social_graph.sql',
  '0003_step8_media.sql',
  '0004_step9_drop_core.sql',
  '0005_step10_engagement.sql',
  '0006_step11_feed_discovery.sql',
  '0007_step12_notifications.sql',
  '0008_step13_clubs.sql',
  '0009_step14_chat.sql',
  '0010_step15_admin_moderation.sql',
  '0011_media_club_purposes.sql',
] as const;

function migrationPath(name: string): string {
  return fileURLToPath(new URL(`../migrations/${name}`, import.meta.url));
}

export function assertTestDatabase(url: string): void {
  const parsed = new URL(url);
  if (
    !/(test|localhost|127\.0\.0\.1)/i.test(
      `${parsed.hostname}/${parsed.pathname}`,
    ) ||
    /prod/i.test(url)
  )
    throw new Error('Refusing non-test database');
}

/**
 * Runs every migration unconditionally, in order. Only safe against a
 * database whose schema was just dropped (test/E2E setup) — it has no
 * tracking of what's already applied, so running it twice against a
 * database that already has these tables fails on the first
 * already-exists error. For a real, persistent database, use
 * deployMigrations() instead.
 */
export async function migrate(url: string): Promise<void> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    for (const name of MIGRATION_FILES) {
      await client.query(await readFile(migrationPath(name), 'utf8'));
    }
  } finally {
    await client.end();
  }
}

export type DeployMigrationsResult = {
  applied: string[];
  alreadyApplied: string[];
};

/**
 * Applies only the migrations not yet recorded in schema_migrations, each
 * in its own transaction (Postgres DDL is transactional, so a mid-file
 * failure leaves neither the schema change nor its ledger row behind).
 * Unlike migrate(), this is safe to run repeatedly against a real,
 * persistent database — a redeploy that finds every migration already
 * applied is a no-op, and adding a new migration file later only applies
 * the new one.
 */
export async function deployMigrations(
  url: string,
): Promise<DeployMigrationsResult> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    const { rows } = await client.query<{ name: string }>(
      'SELECT name FROM schema_migrations',
    );
    const done = new Set(rows.map((r) => r.name));
    const result: DeployMigrationsResult = { applied: [], alreadyApplied: [] };
    for (const name of MIGRATION_FILES) {
      if (done.has(name)) {
        result.alreadyApplied.push(name);
        continue;
      }
      const sql = await readFile(migrationPath(name), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations(name) VALUES($1)', [
          name,
        ]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
      result.applied.push(name);
    }
    return result;
  } finally {
    await client.end();
  }
}
