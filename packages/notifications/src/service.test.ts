import { describe, expect, it } from 'vitest';
import { categories } from './service.js';
describe('notification contract', () => {
  it('keeps every V1 preference category', () =>
    expect(categories).toEqual([
      'LIKES',
      'COMMENTS',
      'REPLIES',
      'REDROPS',
      'FOLLOWS',
      'FOLLOW_REQUESTS',
      'MENTIONS',
      'TRENDING',
      'SYSTEM',
    ]));
});
