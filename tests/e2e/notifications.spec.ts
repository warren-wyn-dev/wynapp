/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment -- response.json() crosses an untyped HTTP boundary, same rationale as packages/admin/src/service.ts */
import { randomUUID } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';
import { expect, test } from '@playwright/test';
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
  return { origin: WEB_ORIGIN, 'x-csrf-token': csrf };
}

test.describe('Notifications', () => {
  test('liking a Drop delivers a notification to its author (via the real worker process)', async ({
    request,
  }) => {
    const author = uniqueUser('notifyauthor');
    const liker = uniqueUser('notifyliker');
    await request.post('/v1/auth/register', { data: author });
    await request.post('/v1/auth/register', { data: liker });

    const authorHeaders = await loginApi(request, author);
    const drop = await request.post('/v1/drops', {
      headers: { ...authorHeaders, 'idempotency-key': randomUUID() },
      data: { body: 'please notify me when this is liked' },
    });
    expect(drop.status()).toBe(201);
    const dropId = (await drop.json()).data.id as string;

    const likerHeaders = await loginApi(request, liker);
    const like = await request.post(`/v1/drops/${dropId}/like`, {
      headers: likerHeaders,
    });
    expect(like.status()).toBe(200);

    await loginApi(request, author);

    // The worker (apps/worker) dispatches and delivers outbox events
    // asynchronously, so poll for the notification to show up instead of
    // asserting on the first read.
    await expect
      .poll(
        async () => {
          const list = await request.get('/v1/notifications');
          const body = await list.json();
          return body.data.items as { id: string; type: string }[];
        },
        { timeout: 10000, message: 'DROP_LIKED notification never arrived' },
      )
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'DROP_LIKED' }),
        ]),
      );

    const list = await request.get('/v1/notifications');
    const notification = (await list.json()).data.items.find(
      (n: { type: string; entity_id: string }) =>
        n.type === 'DROP_LIKED' && n.entity_id === dropId,
    );
    expect(notification).toBeTruthy();

    const unreadBefore = await request.get('/v1/notifications/unread-count');
    expect((await unreadBefore.json()).data.count).toBeGreaterThan(0);

    const authorHeadersAgain = await loginApi(request, author);
    const markRead = await request.post(
      `/v1/notifications/${notification.id}/read`,
      { headers: authorHeadersAgain },
    );
    expect(markRead.status()).toBe(204);

    const unreadAfter = await request.get('/v1/notifications/unread-count');
    const before = (await unreadBefore.json()).data.count as number;
    const after = (await unreadAfter.json()).data.count as number;
    expect(after).toBe(before - 1);
  });

  test('notification preferences can be read and updated, but SYSTEM in-app cannot be disabled', async ({
    request,
  }) => {
    const user = uniqueUser('notifyprefs');
    await request.post('/v1/auth/register', { data: user });
    const headers = await loginApi(request, user);

    const initial = await request.get('/v1/me/notification-preferences');
    const items = (await initial.json()).data.items as {
      category: string;
      in_app_enabled: boolean;
      web_push_enabled: boolean;
    }[];
    expect(items.some((p) => p.category === 'LIKES')).toBeTruthy();
    expect(items.find((p) => p.category === 'SYSTEM')?.in_app_enabled).toBe(
      true,
    );

    const update = await request.patch('/v1/me/notification-preferences', {
      headers,
      data: {
        preferences: [
          { category: 'LIKES', in_app_enabled: false, web_push_enabled: true },
        ],
      },
    });
    expect(update.ok()).toBeTruthy();
    const updatedItems = (await update.json()).data.items as {
      category: string;
      in_app_enabled: boolean;
      web_push_enabled: boolean;
    }[];
    const likes = updatedItems.find((p) => p.category === 'LIKES');
    expect(likes?.in_app_enabled).toBe(false);
    expect(likes?.web_push_enabled).toBe(true);

    const rejectSystemOptOut = await request.patch(
      '/v1/me/notification-preferences',
      {
        headers,
        data: { preferences: [{ category: 'SYSTEM', in_app_enabled: false }] },
      },
    );
    expect(rejectSystemOptOut.status()).toBe(409);
    expect((await rejectSystemOptOut.json()).error.code).toBe(
      'SYSTEM_REQUIRED',
    );
  });
});
