import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';
import { assertSafeDatabase } from '@wyn/config';
export interface Database {
  pool: Pool;
  db: NodePgDatabase;
  close(): Promise<void>;
}
export function createDatabase(config: {
  databaseUrl: string;
  environment: string;
  pool?: Omit<PoolConfig, 'connectionString'>;
}): Database {
  assertSafeDatabase(config.environment, config.databaseUrl);
  const pool = new Pool({
    ...config.pool,
    connectionString: config.databaseUrl,
    max: config.pool?.max ?? 10,
  });
  return { pool, db: drizzle(pool), close: () => pool.end() };
}
export async function inTransaction<T>(
  database: Database,
  operation: (transaction: NodePgDatabase) => Promise<T>,
): Promise<T> {
  return database.db.transaction(operation);
}
