import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
export function assertTestDatabase(url: string): void {
  const parsed = new URL(url);
  if (!/(test|localhost|127\.0\.0\.1)/i.test(`${parsed.hostname}/${parsed.pathname}`) || /prod/i.test(url)) throw new Error('Refusing non-test database');
}
export async function migrate(url: string): Promise<void> {
  const client = new pg.Client({ connectionString: url }); await client.connect();
  try { const path = fileURLToPath(new URL('../migrations/0001_step6_identity.sql', import.meta.url)); await client.query(await readFile(path, 'utf8')); }
  finally { await client.end(); }
}
