import { describe, expect, it } from 'vitest';
import { commentSchema, quoteSchema, shareSchema } from './schemas.js';
describe('engagement boundaries', () => {
  it('accepts plain Unicode text without interpreting HTML', () => {
    expect(
      commentSchema.parse({ text: '<script>alert(1)</script> สวัสดี' }).text,
    ).toContain('<script>');
  });
  it('rejects oversized, control-character, unknown and forged inputs', () => {
    expect(() => commentSchema.parse({ text: 'x'.repeat(2001) })).toThrow();
    expect(() => commentSchema.parse({ text: 'bad\u0000text' })).toThrow();
    expect(() =>
      quoteSchema.parse({ text: 'ok', authorId: 'forged' }),
    ).toThrow();
    expect(() => shareSchema.parse({ channel: 'TRUST_ME' })).toThrow();
  });
});
