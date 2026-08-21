import { defineConfig } from 'drizzle-kit';
if (!process.env.DATABASE_URL)
  throw new Error('DATABASE_URL is required for explicit migration commands');
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './migrations',
  dbCredentials: { url: process.env.DATABASE_URL },
  strict: true,
  verbose: true,
});
