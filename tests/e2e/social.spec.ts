/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- response.json() crosses an untyped HTTP boundary, same rationale as packages/admin/src/service.ts */
import type { APIRequestContext } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { API_ORIGIN, WEB_ORIGIN } from './constants.js';
import { uniqueUser } from './helpers.js';

test.use({ baseURL: API_ORIGIN });

// Playwright's APIRequestContext keeps one shared cookie jar per test, keyed
// by cookie name — so logging in as a different user on the same context
// simply replaces the __Host-wyn_session/__Host-wyn_csrf cookies with that
// user's session. That lets a single test switch between two accounts
// sequentially without needing two browser contexts.
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

test.describe('Social graph', () => {
  test('following a public account follows immediately', async ({
    request,
  }) => {
    const follower = uniqueUser('follower');
    const followee = uniqueUser('followee');
    await request.post('/v1/auth/register', { data: followee });
    await request.post('/v1/auth/register', { data: follower });
    const headers = await loginApi(request, follower);

    const res = await request.post(`/v1/users/${followee.username}/follow`, {
      headers,
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).data.state).toBe('FOLLOWING');

    const profile = await request.get(`/v1/users/${followee.username}`, {
      headers,
    });
    expect((await profile.json()).data.relationship.isFollowing).toBe(true);
  });

  test('following a private account requires the target to approve', async ({
    request,
  }) => {
    const requester = uniqueUser('requester');
    const privateUser = uniqueUser('privateuser');
    await request.post('/v1/auth/register', { data: privateUser });
    await request.post('/v1/auth/register', { data: requester });

    const privateHeaders = await loginApi(request, privateUser);
    const privacy = await request.patch('/v1/me/privacy', {
      headers: privateHeaders,
      data: { accountVisibility: 'PRIVATE' },
    });
    expect(privacy.ok()).toBeTruthy();

    const requesterHeaders = await loginApi(request, requester);
    const followRes = await request.post(
      `/v1/users/${privateUser.username}/follow`,
      { headers: requesterHeaders },
    );
    expect(followRes.status()).toBe(200);
    const followBody = (await followRes.json()).data as {
      state: string;
      requestId: string;
    };
    expect(followBody.state).toBe('REQUESTED');

    const profileAsRequester = await request.get(
      `/v1/users/${privateUser.username}`,
      { headers: requesterHeaders },
    );
    expect(
      (await profileAsRequester.json()).data.relationship.followRequestPending,
    ).toBe(true);

    const privateHeadersAgain = await loginApi(request, privateUser);
    const pending = await request.get('/v1/me/follow-requests', {
      headers: privateHeadersAgain,
    });
    expect(
      (await pending.json()).data.items.some(
        (r: { id: string }) => r.id === followBody.requestId,
      ),
    ).toBeTruthy();

    const approve = await request.post(
      `/v1/follow-requests/${followBody.requestId}/approve`,
      { headers: privateHeadersAgain },
    );
    expect(approve.status()).toBe(204);

    const requesterHeadersAgain = await loginApi(request, requester);
    const profileAfter = await request.get(
      `/v1/users/${privateUser.username}`,
      { headers: requesterHeadersAgain },
    );
    expect((await profileAfter.json()).data.relationship.isFollowing).toBe(
      true,
    );
  });
});
