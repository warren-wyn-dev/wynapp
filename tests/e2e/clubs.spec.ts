/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment -- response.json() crosses an untyped HTTP boundary, same rationale as packages/admin/src/service.ts */
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

function slugFor(prefix: string) {
  return `${prefix}${(Date.now().toString(36) + Math.random().toString(36).slice(2, 6)).toLowerCase()}`;
}

test.describe('Clubs', () => {
  test('a Public Club can be joined directly and roles can be managed', async ({
    request,
  }) => {
    const owner = uniqueUser('clubowner');
    const member = uniqueUser('clubmember');
    await request.post('/v1/auth/register', { data: owner });
    await request.post('/v1/auth/register', { data: member });

    const ownerHeaders = await loginApi(request, owner);
    const slug = slugFor('public-club-');
    const created = await request.post('/v1/clubs', {
      headers: ownerHeaders,
      data: { name: 'Public Club', slug, visibility: 'PUBLIC' },
    });
    expect(created.status()).toBe(201);
    expect((await created.json()).data.slug).toBe(slug);

    const memberHeaders = await loginApi(request, member);
    const joinRes = await request.post(`/v1/clubs/${slug}/join`, {
      headers: memberHeaders,
    });
    expect(joinRes.status()).toBe(200);
    expect((await joinRes.json()).data.status).toBe('MEMBER');

    const asMember = await request.get(`/v1/clubs/${slug}`, {
      headers: memberHeaders,
    });
    expect((await asMember.json()).data.viewer_role).toBe('MEMBER');

    // There was previously no way for a client to discover a member's raw
    // user id at all (/v1/users/:username never returned it, and there was
    // no members list) which made the existing PATCH .../role endpoint
    // unreachable from any real client. GET /v1/clubs/:slug/members is new
    // — added alongside this test to close that gap.
    const ownerHeadersForRoleChange = await loginApi(request, owner);
    const membersList = await request.get(`/v1/clubs/${slug}/members`, {
      headers: ownerHeadersForRoleChange,
    });
    expect(membersList.ok()).toBeTruthy();
    const memberRow = (await membersList.json()).data.items.find(
      (m: { username: string }) => m.username === member.username,
    );
    expect(memberRow).toBeTruthy();
    expect(memberRow.role).toBe('MEMBER');

    const roleChange = await request.patch(
      `/v1/clubs/${slug}/members/${memberRow.user_id}/role`,
      { headers: ownerHeadersForRoleChange, data: { role: 'MODERATOR' } },
    );
    expect(roleChange.status()).toBe(200);
    expect((await roleChange.json()).data.role).toBe('MODERATOR');

    const memberHeadersForLeave = await loginApi(request, member);
    const leave = await request.delete(`/v1/clubs/${slug}/membership`, {
      headers: memberHeadersForLeave,
    });
    expect(leave.status()).toBe(204);

    const afterLeave = await request.get(`/v1/clubs/${slug}`, {
      headers: memberHeadersForLeave,
    });
    expect((await afterLeave.json()).data.viewer_role).toBeNull();
  });

  test('joining a Private Club requires Owner/Admin approval', async ({
    request,
  }) => {
    const owner = uniqueUser('privclubowner');
    const requester = uniqueUser('privclubjoiner');
    await request.post('/v1/auth/register', { data: owner });
    await request.post('/v1/auth/register', { data: requester });

    const ownerHeaders = await loginApi(request, owner);
    const slug = slugFor('private-club-');
    const created = await request.post('/v1/clubs', {
      headers: ownerHeaders,
      data: { name: 'Private Club', slug, visibility: 'PRIVATE' },
    });
    expect(created.status()).toBe(201);

    const requesterHeaders = await loginApi(request, requester);
    const joinRes = await request.post(`/v1/clubs/${slug}/join`, {
      headers: requesterHeaders,
    });
    expect(joinRes.status()).toBe(200);
    const joinBody = (await joinRes.json()).data as {
      status: string;
      request_id: string;
    };
    expect(joinBody.status).toBe('PENDING');

    const stillOutside = await request.get(`/v1/clubs/${slug}`, {
      headers: requesterHeaders,
    });
    expect((await stillOutside.json()).data.viewer_role).toBeNull();
    expect((await stillOutside.json()).data.can_view_content).toBe(false);

    const ownerHeadersAgain = await loginApi(request, owner);
    const approve = await request.post(
      `/v1/clubs/${slug}/join-requests/${joinBody.request_id}/approve`,
      { headers: ownerHeadersAgain },
    );
    expect(approve.status()).toBe(200);
    expect((await approve.json()).data.status).toBe('APPROVED');

    const requesterHeadersAgain = await loginApi(request, requester);
    const afterApproval = await request.get(`/v1/clubs/${slug}`, {
      headers: requesterHeadersAgain,
    });
    expect((await afterApproval.json()).data.viewer_role).toBe('MEMBER');
  });
});
