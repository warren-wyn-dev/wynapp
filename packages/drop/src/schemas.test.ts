import { describe, expect, it } from 'vitest';
import { dropInputSchema, extractMentions, extractTags } from './schemas.js';
describe('Drop validation', () => {
  it('allows zero, one, and nine images', () => {
    for (const n of [0, 1, 9])
      expect(
        dropInputSchema.safeParse({
          body: 'ok',
          mediaIds: Array.from(
            { length: n },
            (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
          ),
        }).success,
      ).toBe(true);
  });
  it('rejects ten and duplicate images', () => {
    const id = '00000000-0000-4000-8000-000000000000';
    expect(
      dropInputSchema.safeParse({ body: 'x', mediaIds: Array(10).fill(id) })
        .success,
    ).toBe(false);
    expect(
      dropInputSchema.safeParse({ body: 'x', mediaIds: [id, id] }).success,
    ).toBe(false);
  });
  it('rejects active URL schemes', () => {
    for (const externalUrl of [
      'javascript:alert(1)',
      'data:text/html,x',
      'file:///tmp/a',
    ])
      expect(
        dropInputSchema.safeParse({ body: 'x', externalUrl }).success,
      ).toBe(false);
  });
  it('normalizes and deduplicates tags and mentions', () => {
    expect(extractTags('#WYN #wyn')).toEqual(['wyn']);
    expect(extractMentions('@Alice @alice')).toEqual(['alice']);
  });
});
