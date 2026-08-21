/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- response.json() crosses an untyped HTTP boundary, same rationale as packages/admin/src/service.ts */
import { randomUUID } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';
import { expect, test } from '@playwright/test';
import {
  ADMIN_ORIGIN,
  API_ORIGIN,
  SEED_ADMIN_EMAIL,
  SEED_ADMIN_PASSWORD,
  WEB_ORIGIN,
} from './constants.js';
import { uniqueUser } from './helpers.js';

// There is currently no Admin frontend to drive with a browser (every route
// under apps/admin/app is a placeholder page with no markup or fetch calls —
// see the PR description). This file exercises the real Admin HTTP surface
// over the network instead, against the same running API server the browser
// specs use, so the admin auth/session/CSRF/step-up/moderation machinery
// gets at least one execution path that isn't the in-process integration
// suite.
test.use({ baseURL: API_ORIGIN });

async function consumerCsrf(request: APIRequestContext): Promise<string> {
  const state = await request.storageState();
  const cookie = state.cookies.find((c) => c.name === '__Host-wyn_csrf');
  if (!cookie) throw new Error('consumer CSRF cookie missing');
  return cookie.value;
}

test.describe('Admin API', () => {
  test('unauthenticated and consumer-only sessions cannot reach Admin', async ({
    request,
  }) => {
    const anonymous = await request.get('/admin/v1/session');
    expect(anonymous.status()).toBe(401);

    const consumer = uniqueUser('adminboundary');
    await request.post('/v1/auth/register', { data: consumer });
    const login = await request.post('/v1/auth/login', {
      data: { email: consumer.email, password: consumer.password },
    });
    expect(login.ok()).toBeTruthy();

    // The consumer session cookie is a different name/realm; it must not
    // grant Admin access even though it is a valid, currently-authenticated
    // session on the same API.
    const asConsumer = await request.get('/admin/v1/session');
    expect(asConsumer.status()).toBe(401);
  });

  test('OWNER can triage a report and warn, but a sensitive action requires step-up', async ({
    request,
  }) => {
    const reporter = uniqueUser('adminreporter');
    await request.post('/v1/auth/register', { data: reporter });
    await request.post('/v1/auth/login', {
      data: { email: reporter.email, password: reporter.password },
    });
    const csrf = await consumerCsrf(request);
    const commonHeaders = { origin: WEB_ORIGIN, 'x-csrf-token': csrf };

    const dropRes = await request.post('/v1/drops', {
      headers: { ...commonHeaders, 'idempotency-key': randomUUID() },
      data: { body: 'reported for e2e coverage' },
    });
    expect(dropRes.status()).toBe(201);
    const dropId = (await dropRes.json()).data.id as string;

    const reportRes = await request.post('/v1/reports', {
      headers: commonHeaders,
      data: {
        targetType: 'DROP',
        targetId: dropId,
        reasonCode: 'SPAM',
        sourceSurface: 'e2e_test',
        idempotencyKey: randomUUID(),
      },
    });
    expect(reportRes.status()).toBe(201);
    const reportId = (await reportRes.json()).data.id as string;

    const adminLogin = await request.post('/admin/v1/auth/login', {
      data: { email: SEED_ADMIN_EMAIL, password: SEED_ADMIN_PASSWORD },
    });
    expect(adminLogin.ok()).toBeTruthy();
    const adminCsrf = (await adminLogin.json()).data.csrf_token as string;
    const adminHeaders = {
      origin: ADMIN_ORIGIN,
      'x-admin-csrf-token': adminCsrf,
    };

    const session = await request.get('/admin/v1/session');
    expect((await session.json()).data.role).toBe('OWNER');

    const reports = await request.get('/admin/v1/reports');
    expect(
      (await reports.json()).data.some(
        (r: { id: string }) => r.id === reportId,
      ),
    ).toBeTruthy();

    const caseRes = await request.post(`/admin/v1/reports/${reportId}/case`, {
      headers: adminHeaders,
    });
    expect(caseRes.status()).toBe(201);
    const created = (await caseRes.json()).data as {
      id: string;
      version: number;
    };

    const warn = await request.post(`/admin/v1/cases/${created.id}/actions`, {
      headers: adminHeaders,
      data: {
        actionType: 'WARNING',
        reasonCode: 'SPAM',
        idempotencyKey: randomUUID(),
        expectedVersion: created.version,
      },
    });
    expect(warn.status()).toBe(201);

    // REMOVE_CONTENT is a sensitive permission: it must be refused until the
    // admin has stepped up, even though WARNING just succeeded on the same
    // session.
    const removeBeforeStepUp = await request.post(
      `/admin/v1/cases/${created.id}/actions`,
      {
        headers: adminHeaders,
        data: {
          actionType: 'REMOVE_CONTENT',
          reasonCode: 'SPAM',
          idempotencyKey: randomUUID(),
          expectedVersion: created.version + 1,
        },
      },
    );
    expect(removeBeforeStepUp.status()).toBe(403);
    expect((await removeBeforeStepUp.json()).error.code).toBe(
      'STEP_UP_REQUIRED',
    );

    const stepUp = await request.post('/admin/v1/auth/step-up', {
      headers: adminHeaders,
      data: { password: SEED_ADMIN_PASSWORD },
    });
    expect(stepUp.ok()).toBeTruthy();

    const removeAfterStepUp = await request.post(
      `/admin/v1/cases/${created.id}/actions`,
      {
        headers: adminHeaders,
        data: {
          actionType: 'REMOVE_CONTENT',
          reasonCode: 'SPAM',
          idempotencyKey: randomUUID(),
          expectedVersion: created.version + 1,
        },
      },
    );
    expect(removeAfterStepUp.status()).toBe(201);

    const dropAfterRemoval = await request.get(`/v1/drops/${dropId}`);
    expect(dropAfterRemoval.status()).toBe(404);
  });
});
