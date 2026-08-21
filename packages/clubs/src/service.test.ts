import { describe, expect, it } from 'vitest';
import { ClubError } from './service.js';
describe('club domain', () => {
  it('exposes typed owner protection errors', () =>
    expect(new ClubError('OWNER_PROTECTED').code).toBe('OWNER_PROTECTED'));
});
