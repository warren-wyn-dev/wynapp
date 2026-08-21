/* eslint-disable @typescript-eslint/no-unsafe-member-access -- response.json() crosses an untyped HTTP boundary, same rationale as packages/admin/src/service.ts */
import { randomUUID } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';
import { expect, request as playwrightRequest, test } from '@playwright/test';
import { API_ORIGIN, WEB_ORIGIN } from './constants.js';
import { uniqueUser } from './helpers.js';

test.use({ baseURL: API_ORIGIN });

async function loginApi(
  request: APIRequestContext,
  user: { email: string; password: string },
) {
  const login = await request.post('/v1/auth/login', {
    data: { email: user.email, password: user.password },
  });
  expect(login.ok()).toBeTruthy();
  const state = await request.storageState();
  const csrf = state.cookies.find((c) => c.name === '__Host-wyn_csrf')?.value;
  if (!csrf) throw new Error('missing CSRF cookie after login');
  return csrf;
}

test.describe('Security boundaries', () => {
  test('a mutation without a session is rejected', async ({ request }) => {
    const res = await request.post('/v1/drops', {
      headers: { origin: WEB_ORIGIN },
      data: { body: 'should never be created' },
    });
    expect(res.status()).toBe(401);
  });

  test('a mutation with the session cookie but no CSRF token is rejected', async ({
    request,
  }) => {
    const user = uniqueUser('csrfless');
    await request.post('/v1/auth/register', { data: user });
    await loginApi(request, user); // establishes the session cookie on this context

    const res = await request.post('/v1/drops', {
      headers: { origin: WEB_ORIGIN }, // deliberately no x-csrf-token
      data: { body: 'should be rejected' },
    });
    expect(res.status()).toBe(403);
    expect((await res.json()).error.code).toBe('CSRF_INVALID');
  });

  test('a mutation with a forged CSRF token is rejected', async ({
    request,
  }) => {
    const user = uniqueUser('csrfforge');
    await request.post('/v1/auth/register', { data: user });
    await loginApi(request, user);

    const res = await request.post('/v1/drops', {
      headers: { origin: WEB_ORIGIN, 'x-csrf-token': randomUUID() },
      data: { body: 'should be rejected' },
    });
    expect(res.status()).toBe(403);
    expect((await res.json()).error.code).toBe('CSRF_INVALID');
  });

  test('a mutation from an unexpected Origin is rejected even with a valid CSRF token', async ({
    request,
  }) => {
    const user = uniqueUser('csrforigin');
    await request.post('/v1/auth/register', { data: user });
    const csrf = await loginApi(request, user);

    const res = await request.post('/v1/drops', {
      headers: { origin: 'https://evil.example', 'x-csrf-token': csrf },
      data: { body: 'should be rejected' },
    });
    expect(res.status()).toBe(403);
    expect((await res.json()).error.code).toBe('CSRF_INVALID');
  });

  test("one user cannot delete another user's Drop", async ({ request }) => {
    const owner = uniqueUser('dropowner');
    const attacker = uniqueUser('dropattacker');
    await request.post('/v1/auth/register', { data: owner });
    await request.post('/v1/auth/register', { data: attacker });

    const ownerCsrf = await loginApi(request, owner);
    const created = await request.post('/v1/drops', {
      headers: {
        origin: WEB_ORIGIN,
        'x-csrf-token': ownerCsrf,
        'idempotency-key': randomUUID(),
      },
      data: { body: 'owned by owner, not attacker' },
    });
    expect(created.status()).toBe(201);
    const dropId = (await created.json()).data.id as string;

    const attackerCsrf = await loginApi(request, attacker);
    const deleteAttempt = await request.delete(`/v1/drops/${dropId}`, {
      headers: { origin: WEB_ORIGIN, 'x-csrf-token': attackerCsrf },
    });
    expect(deleteAttempt.status()).toBe(403);
    expect((await deleteAttempt.json()).error.code).toBe('FORBIDDEN');

    // The Drop must still exist and be readable — ownership rejection must
    // not have silently deleted or corrupted it.
    const stillThere = await request.get(`/v1/drops/${dropId}`);
    expect(stillThere.status()).toBe(200);
  });

  test('a session revoked by logout can no longer authenticate (no replay)', async ({
    request,
  }) => {
    const user = uniqueUser('replaytest');
    await request.post('/v1/auth/register', { data: user });
    const csrf = await loginApi(request, user);

    const stateBefore = await request.storageState();
    const sessionCookie = stateBefore.cookies.find(
      (c) => c.name === '__Host-wyn_session',
    );
    if (!sessionCookie) throw new Error('missing session cookie');

    const logout = await request.post('/v1/auth/logout', {
      headers: { origin: WEB_ORIGIN, 'x-csrf-token': csrf },
    });
    expect(logout.status()).toBe(204);

    // Replay the exact same (now revoked) session token as a raw Cookie
    // header — a fresh context so the jar doesn't auto-drop it after logout.
    const replay = await playwrightRequest.newContext({
      baseURL: API_ORIGIN,
      extraHTTPHeaders: {
        cookie: `${sessionCookie.name}=${sessionCookie.value}`,
      },
    });
    const me = await replay.get('/v1/me');
    expect(me.status()).toBe(401);
    await replay.dispose();
  });
});
