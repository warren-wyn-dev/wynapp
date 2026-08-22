import { deployMigrations } from '../packages/database/src/migrate.js';

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required.');
    process.exitCode = 1;
    return;
  }
  if (!process.argv.includes('--yes')) {
    const target = new URL(url);
    console.error(
      `This will apply any pending migrations to ${target.hostname}${target.pathname}.\n` +
        'Re-run with --yes to confirm.',
    );
    process.exitCode = 1;
    return;
  }
  try {
    const { applied, alreadyApplied } = await deployMigrations(url);
    console.log(
      applied.length
        ? `Applied ${applied.length} migration(s): ${applied.join(', ')}`
        : 'No pending migrations.',
    );
    console.log(`Already applied: ${alreadyApplied.length}`);
  } catch (error) {
    console.error('Migration failed:', (error as Error).message);
    process.exitCode = 1;
  }
}

void main();
