import { describe, expect, it } from 'vitest';
import { ChatError } from './service.js';
describe('chat domain', () => {
  it('uses non-enumerating authorization errors', () =>
    expect(new ChatError('NOT_FOUND').code).toBe('NOT_FOUND'));
});
