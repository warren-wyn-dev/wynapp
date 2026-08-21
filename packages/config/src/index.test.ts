import { describe, expect, it } from 'vitest';
import { baseEnvironmentSchema, assertSafeDatabase } from './index.js';
describe('environment validation', () => {
  it('supports all approved environments', () => {
    for (const WYN_ENV of [
      'local',
      'development',
      'staging',
      'production',
      'test',
    ])
      expect(baseEnvironmentSchema.parse({ WYN_ENV }).WYN_ENV).toBe(WYN_ENV);
  });
  it('rejects production databases in tests', () =>
    expect(() =>
      assertSafeDatabase('test', 'postgresql://host/wyn_production'),
    ).toThrow());
});
