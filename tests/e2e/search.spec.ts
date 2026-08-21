/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- response.json() crosses an untyped HTTP boundary, same rationale as packages/admin/src/service.ts */
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

test.describe('Search', () => {
  test('finds users by username, Drops by body text, and hashtags', async ({
    request,
  }) => {
    const searcher = uniqueUser('searcher');
    const target = uniqueUser('findablesubject');
    await request.post('/v1/auth/register', { data: searcher });
    await request.post('/v1/auth/register', { data: target });

    const rareWord = `zzq${(Date.now().toString(36) + Math.random().toString(36).slice(2, 6)).toLowerCase()}`;
    const hashtag = `e2e${rareWord}`;
    const targetHeaders = await loginApi(request, target);
    const drop = await request.post('/v1/drops', {
      headers: { ...targetHeaders, 'idempotency-key': randomUUID() },
      data: { body: `Searchable content ${rareWord} #${hashtag}` },
    });
    expect(drop.status()).toBe(201);
    const dropId = (await drop.json()).data.id as string;

    await loginApi(request, searcher);

    const userSearch = await request.get(
      `/v1/search/users?q=${encodeURIComponent(target.username.slice(0, 12))}`,
    );
    expect(userSearch.ok()).toBeTruthy();
    expect(
      (await userSearch.json()).data.items.some(
        (u: { username: string }) => u.username === target.username,
      ),
    ).toBeTruthy();

    const dropSearch = await request.get(
      `/v1/search/drops?q=${encodeURIComponent(rareWord)}`,
    );
    expect(dropSearch.ok()).toBeTruthy();
    expect(
      (await dropSearch.json()).data.items.some(
        (d: { id: string }) => d.id === dropId,
      ),
    ).toBeTruthy();

    const hashtagSearch = await request.get(
      `/v1/search/hashtags?q=${encodeURIComponent(hashtag)}`,
    );
    expect(hashtagSearch.ok()).toBeTruthy();
    expect(
      (await hashtagSearch.json()).data.items.some(
        (h: { normalized: string }) => h.normalized === hashtag.toLowerCase(),
      ),
    ).toBeTruthy();

    const combined = await request.get(
      `/v1/search?q=${encodeURIComponent(target.username.slice(0, 12))}`,
    );
    expect(
      (await combined.json()).data.users.some(
        (u: { username: string }) => u.username === target.username,
      ),
    ).toBeTruthy();
  });

  test("a blocked author's Drops are excluded from search results", async ({
    request,
  }) => {
    const blocker = uniqueUser('searchblocker');
    const blocked = uniqueUser('searchblocked');
    await request.post('/v1/auth/register', { data: blocked });
    await request.post('/v1/auth/register', { data: blocker });

    const blockedHeaders = await loginApi(request, blocked);
    const rareWord = `qzz${(Date.now().toString(36) + Math.random().toString(36).slice(2, 6)).toLowerCase()}`;
    const drop = await request.post('/v1/drops', {
      headers: { ...blockedHeaders, 'idempotency-key': randomUUID() },
      data: { body: `Blocked content ${rareWord}` },
    });
    expect(drop.status()).toBe(201);
    const dropId = (await drop.json()).data.id as string;

    const blockerHeaders = await loginApi(request, blocker);
    const beforeBlock = await request.get(
      `/v1/search/drops?q=${encodeURIComponent(rareWord)}`,
    );
    expect(
      (await beforeBlock.json()).data.items.some(
        (d: { id: string }) => d.id === dropId,
      ),
    ).toBeTruthy();

    const blockRes = await request.post(`/v1/users/${blocked.username}/block`, {
      headers: blockerHeaders,
    });
    expect(blockRes.status()).toBe(204);

    const afterBlock = await request.get(
      `/v1/search/drops?q=${encodeURIComponent(rareWord)}`,
    );
    expect(
      (await afterBlock.json()).data.items.some(
        (d: { id: string }) => d.id === dropId,
      ),
    ).toBe(false);
  });
});
