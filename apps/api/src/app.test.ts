import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
let app: Awaited<ReturnType<typeof buildApp>> | undefined;
afterEach(async () => app?.close());
describe('API probes', () => {
  it.each([
    ['/health', 'ok'],
    ['/ready', 'ready'],
  ])('serves %s', async (path, status) => {
    app = await buildApp({ allowedOrigins: ['http://localhost:3000'] });
    const response = await app.inject({ method: 'GET', url: path });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status });
  });
  it('does not leak errors', async () => {
    app = await buildApp({ allowedOrigins: [] });
    const response = await app.inject('/missing');
    expect(response.json()).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource is unavailable.',
        requestId: expect.any(String),
      },
    });
  });
});
