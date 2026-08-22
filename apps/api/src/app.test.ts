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
  it('treats malformed request bodies as 400s, not captured 500s', async () => {
    const captured: unknown[] = [];
    app = await buildApp({
      allowedOrigins: ['http://localhost:3000'],
      errorCapture: { capture: (error) => captured.push(error) },
    });
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email: 'not-an-email' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: { code: 'VALIDATION_ERROR' },
    });
    expect(captured).toHaveLength(0);
  });
  it('captures genuinely unexpected errors', async () => {
    const captured: unknown[] = [];
    app = await buildApp({
      allowedOrigins: ['http://localhost:3000'],
      errorCapture: { capture: (error) => captured.push(error) },
    });
    // A well-formed request with no pool configured hits buildApp's
    // Database-is-unavailable stub, a genuine unexpected failure.
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'user@example.com', password: 'whatever' },
    });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({
      error: { code: 'INTERNAL_ERROR' },
    });
    expect(captured).toHaveLength(1);
  });
});
