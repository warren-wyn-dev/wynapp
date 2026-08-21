import pg from 'pg';
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
export type DbClient = pg.PoolClient;
export async function transaction<T>(fn: (client: DbClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
