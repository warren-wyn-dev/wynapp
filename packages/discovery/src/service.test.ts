import { describe, expect, it, vi } from 'vitest';
import { DiscoveryService, RankingService } from './service.js';

describe('discovery privacy and scope guardrails', () => {
  it('rejects malformed cursors before querying', async () => {
    const query = vi.fn();
    const service = new DiscoveryService({ query } as never);
    await expect(service.following('actor', 'not-json')).rejects.toMatchObject({
      code: 'INVALID_CURSOR',
    });
    expect(query).not.toHaveBeenCalled();
  });
  it('global ranking explicitly scopes every engagement source', async () => {
    const queries: string[] = [];
    const client = {
      query: vi.fn(async (sql: string) => {
        queries.push(sql);
        return { rows: [] };
      }),
      release: vi.fn(),
    };
    const ranking = new RankingService({
      connect: vi.fn(async () => client),
    } as never);
    await ranking.recompute();
    const sql = queries.join('\n');
    expect(sql).toContain("l.scope='GLOBAL_PUBLIC'");
    expect(sql).toContain("x.scope='GLOBAL_PUBLIC'");
    expect(sql).toContain("r.scope='GLOBAL_PUBLIC'");
    expect(sql).toContain("v.scope='GLOBAL_PUBLIC'");
    expect(sql).not.toMatch(/scope='CLUB_INTERNAL'/);
  });
  it('feed eligibility applies block and mute before ranking', async () => {
    const statements: string[] = [];
    const query = vi.fn(async (sql: string) => {
      statements.push(sql);
      return { rows: [] };
    });
    const service = new DiscoveryService({ query } as never);
    await service.forYou('actor');
    const sql = statements[0] ?? '';
    expect(sql).toContain('FROM blocks');
    expect(sql).toContain('FROM mutes');
    expect(sql).toContain("d.visibility='PUBLIC'");
    expect(sql).toContain("u.account_state='ACTIVE'");
  });
});
