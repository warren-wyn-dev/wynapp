import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
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
export async function migrate(url: string): Promise<void> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    for (const name of [
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
    ]) {
      const path = fileURLToPath(
        new URL(`../migrations/${name}`, import.meta.url),
      );
      await client.query(await readFile(path, 'utf8'));
    }
  } finally {
    await client.end();
  }
}
