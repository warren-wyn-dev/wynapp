import pg from 'pg';
import { hashPassword } from '../../packages/auth/src/crypto.js';
import {
  assertTestDatabase,
  migrate,
} from '../../packages/database/src/migrate.js';
import {
  SEED_ADMIN_EMAIL,
  SEED_ADMIN_PASSWORD,
  TEST_DATABASE_URL,
} from './constants.js';

// Runs once before the API/Web servers start. Resets the disposable local
// test database to a known schema and seeds a single admin principal used by
// the admin-api E2E coverage (there is no Admin frontend to drive yet, see
// tests/e2e/admin-api.spec.ts).
export default async function globalSetup(): Promise<void> {
  assertTestDatabase(TEST_DATABASE_URL);
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  } finally {
    await client.end();
  }
  await migrate(TEST_DATABASE_URL);

  const pool = new pg.Pool({ connectionString: TEST_DATABASE_URL });
  try {
    const passwordHash = await hashPassword(SEED_ADMIN_PASSWORD);
    const users = await pool.query(
      'INSERT INTO users(email_normalized,email_verified_at) VALUES($1,now()) RETURNING id',
      [SEED_ADMIN_EMAIL],
    );
    const userId = users.rows[0].id as string;
    await pool.query(
      'INSERT INTO user_credentials(user_id,password_hash) VALUES($1,$2)',
      [userId, passwordHash],
    );
    await pool.query(
      "INSERT INTO profiles(user_id,username_normalized,display_name) VALUES($1,'e2eadmin','E2E Admin')",
      [userId],
    );
    await pool.query('INSERT INTO privacy_settings(user_id) VALUES($1)', [
      userId,
    ]);
    await pool.query(
      "INSERT INTO admin_principals(user_id,enabled,role,permissions) VALUES($1,true,'OWNER','{}')",
      [userId],
    );
  } finally {
    await pool.end();
  }
}
