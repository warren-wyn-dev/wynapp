/* eslint-disable @typescript-eslint/no-unsafe-member-access -- response.json() crosses an untyped HTTP boundary, same rationale as packages/admin/src/service.ts */
import type { APIRequestContext } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { API_ORIGIN, WEB_ORIGIN } from './constants.js';
import { uniqueUser } from './helpers.js';

test.use({ baseURL: API_ORIGIN });

// A minimal valid 1x1 transparent PNG — small enough to keep the test fast,
// but a real image sharp can decode, resize, and re-encode.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

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

async function uploadAndProcess(
  request: APIRequestContext,
  headers: Record<string, string>,
  purpose: string,
): Promise<string> {
  const intent = await request.post('/v1/media/upload-intents', {
    headers: { ...headers, 'content-type': 'application/json' },
    data: { purpose, mime: 'image/png', bytes: PNG_1X1.byteLength },
  });
  expect(intent.status()).toBe(201);
  const { id, upload } = (await intent.json()).data as {
    id: string;
    upload: { url: string; headers: Record<string, string> };
  };

  const put = await request.put(upload.url, {
    headers: upload.headers,
    data: PNG_1X1,
  });
  expect(put.ok()).toBeTruthy();

  const complete = await request.post(`/v1/media/${id}/complete`, {
    headers,
  });
  expect(complete.status()).toBe(202);

  // MediaWorker (apps/worker) processes the upload asynchronously (sharp
  // variant generation + storage writes), so poll until it reaches READY.
  await expect
    .poll(
      async () => {
        const status = await request.get(`/v1/media/${id}`, { headers });
        return (await status.json()).data.status as string;
      },
      { timeout: 10000, message: `media ${id} never reached READY` },
    )
    .toBe('READY');

  return id;
}

test.describe('Media upload', () => {
  test('uploading and attaching a profile avatar works end to end', async ({
    request,
  }) => {
    const user = uniqueUser('avataruser');
    await request.post('/v1/auth/register', { data: user });
    const headers = await loginApi(request, user);

    const mediaId = await uploadAndProcess(request, headers, 'PROFILE_AVATAR');

    const attach = await request.put('/v1/me/avatar', {
      headers,
      data: { mediaId },
    });
    expect(attach.status()).toBe(204);

    const me = await request.get('/v1/me', { headers });
    expect((await me.json()).data.avatar_url).toContain(mediaId);
  });

  test('a Club can be created with an uploaded avatar (CLUB_AVATAR)', async ({
    request,
  }) => {
    const owner = uniqueUser('clubavatarowner');
    await request.post('/v1/auth/register', { data: owner });
    const headers = await loginApi(request, owner);

    // CLUB_AVATAR/CLUB_COVER were accepted by the upload-intent schema but
    // rejected by the database's media_purpose enum on every attempt until
    // migration 0011 added them — this is the regression test for that.
    const avatarMediaId = await uploadAndProcess(
      request,
      headers,
      'CLUB_AVATAR',
    );

    const slug = `avatar-club-${(Date.now().toString(36) + Math.random().toString(36).slice(2, 6)).toLowerCase()}`;
    const created = await request.post('/v1/clubs', {
      headers: { ...headers, 'content-type': 'application/json' },
      data: {
        name: 'Avatar Club',
        slug,
        visibility: 'PUBLIC',
        avatarMediaId,
      },
    });
    expect(created.status()).toBe(201);
    expect((await created.json()).data.avatar_media_id).toBe(avatarMediaId);
  });

  test('a READY Drop image can be viewed by someone other than its uploader', async ({
    request,
  }) => {
    const author = uniqueUser('mediaviewauthor');
    const viewer = uniqueUser('mediaviewviewer');
    await request.post('/v1/auth/register', { data: author });
    await request.post('/v1/auth/register', { data: viewer });

    const authorHeaders = await loginApi(request, author);
    const mediaId = await uploadAndProcess(
      request,
      authorHeaders,
      'DROP_IMAGE',
    );

    const drop = await request.post('/v1/drops', {
      headers: { ...authorHeaders, 'idempotency-key': crypto.randomUUID() },
      data: { body: 'a drop with a picture', mediaIds: [mediaId] },
    });
    expect(drop.status()).toBe(201);

    // GET /v1/media/:id was previously owner-only for every status,
    // including READY, so this 404'd for anyone but the uploader — the web
    // app's <img src="/v1/media/:id"> for other people's Drop images could
    // never load.
    const viewerHeaders = await loginApi(request, viewer);
    const asViewer = await request.get(`/v1/media/${mediaId}`, {
      headers: viewerHeaders,
    });
    expect(asViewer.ok()).toBeTruthy();
    expect((await asViewer.json()).data.urls.feed).toBeTruthy();

    // The actual <img src> the frontend now points at: a redirect straight
    // to the CDN URL, reachable with no session at all.
    const anonymousFile = await request.fetch(`/v1/media/${mediaId}/file`, {
      maxRedirects: 0,
    });
    expect(anonymousFile.status()).toBe(302);
    expect(anonymousFile.headers().location).toContain(mediaId);
  });

  test('a still-processing upload stays private to its uploader', async ({
    request,
  }) => {
    const owner = uniqueUser('mediaprivacyowner');
    const stranger = uniqueUser('mediaprivacystranger');
    await request.post('/v1/auth/register', { data: owner });
    await request.post('/v1/auth/register', { data: stranger });

    const ownerHeaders = await loginApi(request, owner);
    const intent = await request.post('/v1/media/upload-intents', {
      headers: { ...ownerHeaders, 'content-type': 'application/json' },
      data: {
        purpose: 'PROFILE_AVATAR',
        mime: 'image/png',
        bytes: PNG_1X1.byteLength,
      },
    });
    const mediaId = (await intent.json()).data.id as string;

    const strangerHeaders = await loginApi(request, stranger);
    const asStranger = await request.get(`/v1/media/${mediaId}`, {
      headers: strangerHeaders,
    });
    expect(asStranger.status()).toBe(404);
  });
});
