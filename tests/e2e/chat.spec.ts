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

test.describe('1:1 Chat', () => {
  test('a first message to a stranger is a Message Request until accepted', async ({
    request,
  }) => {
    const sender = uniqueUser('chatsender');
    const recipient = uniqueUser('chatrecipient');
    await request.post('/v1/auth/register', { data: sender });
    await request.post('/v1/auth/register', { data: recipient });

    const senderHeaders = await loginApi(request, sender);

    // POST /v1/conversations needs the recipient's raw user id, but until
    // this test was written /v1/users/:username never returned one and
    // there was no other client-facing way to resolve it — nothing in the
    // web app ever called POST /v1/conversations either, so starting a new
    // 1:1 chat was unreachable end to end. Added `user_id` to the profile
    // response alongside this test to close that gap.
    const recipientProfile = await request.get(
      `/v1/users/${recipient.username}`,
      { headers: senderHeaders },
    );
    const recipientId = (await recipientProfile.json()).data.user_id as
      | string
      | undefined;
    expect(
      recipientId,
      '/v1/users/:username should return user_id',
    ).toBeTruthy();

    const conv = await request.post('/v1/conversations', {
      headers: senderHeaders,
      data: { targetUserId: recipientId },
    });
    expect(conv.status()).toBe(201);
    const convBody = (await conv.json()).data as {
      conversation_id: string;
      created: boolean;
      status?: string;
    };
    expect(convBody.status).toBe('PENDING');
    const conversationId = convBody.conversation_id;

    const blockedSend = await request.post(
      `/v1/conversations/${conversationId}/messages`,
      {
        headers: senderHeaders,
        data: {
          kind: 'TEXT',
          body: 'hi before accepted',
          clientMessageId: randomUUID(),
        },
      },
    );
    expect(blockedSend.status()).toBe(409);
    expect((await blockedSend.json()).error.code).toBe('REQUEST_PENDING');

    const recipientHeadersAgain = await loginApi(request, recipient);
    const requests = await request.get('/v1/message-requests', {
      headers: recipientHeadersAgain,
    });
    const requestRow = (await requests.json()).data.items.find(
      (r: { conversation_id: string }) => r.conversation_id === conversationId,
    );
    expect(requestRow).toBeTruthy();

    const accept = await request.post(
      `/v1/message-requests/${requestRow.id}/accept`,
      { headers: recipientHeadersAgain },
    );
    expect(accept.status()).toBe(200);

    const senderHeadersAgain = await loginApi(request, sender);
    const send = await request.post(
      `/v1/conversations/${conversationId}/messages`,
      {
        headers: senderHeadersAgain,
        data: {
          kind: 'TEXT',
          body: 'hello after acceptance',
          clientMessageId: randomUUID(),
        },
      },
    );
    expect(send.status()).toBe(201);
    const messageId = (await send.json()).data.id as string;

    const recipientHeadersFinal = await loginApi(request, recipient);
    const messages = await request.get(
      `/v1/conversations/${conversationId}/messages`,
      { headers: recipientHeadersFinal },
    );
    expect(
      (await messages.json()).data.items.some(
        (m: { id: string; body: string }) =>
          m.id === messageId && m.body === 'hello after acceptance',
      ),
    ).toBeTruthy();

    const markRead = await request.post(
      `/v1/conversations/${conversationId}/read`,
      { headers: recipientHeadersFinal, data: { sequence: 1 } },
    );
    expect(markRead.ok()).toBeTruthy();

    // The recipient cannot delete a message they did not send.
    const deleteAttempt = await request.delete(`/v1/messages/${messageId}`, {
      headers: recipientHeadersFinal,
    });
    expect(deleteAttempt.status()).toBe(404);
  });
});
