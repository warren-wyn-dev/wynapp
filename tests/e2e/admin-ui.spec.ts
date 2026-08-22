/* eslint-disable @typescript-eslint/no-unsafe-member-access -- response.json() crosses an untyped HTTP boundary, same rationale as tests/e2e/admin-api.spec.ts */
import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import {
  ADMIN_ORIGIN,
  API_ORIGIN,
  SEED_ADMIN_EMAIL,
  SEED_ADMIN_PASSWORD,
  WEB_ORIGIN,
} from './constants.js';
import { uniqueUser } from './helpers.js';

// Drives the real Admin frontend (apps/admin) rather than the raw HTTP
// surface admin-api.spec.ts exercises, so a break in the UI's fetch
// wiring, CSRF handling, or step-up flow shows up here even if the API
// itself is fine.
test.use({ baseURL: ADMIN_ORIGIN });

test.describe('Admin UI', () => {
  test('OWNER logs in, triages a reported drop, warns, then steps up to remove it', async ({
    page,
    request,
  }) => {
    const reporter = uniqueUser('adminuireporter');
    await request.post(`${API_ORIGIN}/v1/auth/register`, { data: reporter });
    await request.post(`${API_ORIGIN}/v1/auth/login`, {
      data: { email: reporter.email, password: reporter.password },
    });
    const state = await request.storageState();
    const csrfCookie = state.cookies.find((c) => c.name === '__Host-wyn_csrf');
    if (!csrfCookie) throw new Error('consumer CSRF cookie missing');
    const commonHeaders = {
      origin: WEB_ORIGIN,
      'x-csrf-token': csrfCookie.value,
    };

    const dropRes = await request.post(`${API_ORIGIN}/v1/drops`, {
      headers: { ...commonHeaders, 'idempotency-key': randomUUID() },
      data: { body: 'reported via admin-ui e2e' },
    });
    expect(dropRes.status()).toBe(201);
    const dropId = (await dropRes.json()).data.id as string;

    const reportRes = await request.post(`${API_ORIGIN}/v1/reports`, {
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

    await page.goto('/login');
    await page.getByLabel('อีเมล').fill(SEED_ADMIN_EMAIL);
    await page.getByLabel('รหัสผ่าน').fill(SEED_ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
    await expect(page).toHaveURL(/\/reports$/);
    await expect(page.getByText('เข้าสู่ระบบในฐานะ')).toBeVisible();

    const row = page.locator('.report-row-card').filter({ hasText: dropId });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'เปิด Case' }).click();

    await row.getByLabel('รหัสเหตุผล (reason code)').fill('SPAM');
    await row.getByRole('button', { name: 'ยืนยันการดำเนินการ' }).click();
    await expect(row.getByText('ACTIONED')).toBeVisible();

    // Switch to a sensitive action, which the API refuses without a
    // recent step-up even on this same, already-authenticated session.
    await row.getByLabel('การดำเนินการ').selectOption('REMOVE_CONTENT');
    await row.getByRole('button', { name: 'ยืนยันการดำเนินการ' }).click();
    await expect(row.getByRole('alert')).toContainText('step-up');
    await row.getByLabel('รหัสผ่าน').fill(SEED_ADMIN_PASSWORD);
    await row.getByRole('button', { name: 'ยืนยันตัวตน' }).click();
    await expect(row.getByRole('alert')).toHaveCount(0);

    const removed = await request.get(`${API_ORIGIN}/v1/drops/${dropId}`);
    expect(removed.status()).toBe(404);

    await page.getByRole('button', { name: 'ออกจากระบบ' }).click();
    await expect(page).toHaveURL(/\/login$/);
    // page.request shares the browser's cookie jar (the admin session
    // cookie was set via the login form, not the standalone `request`
    // fixture above) -- confirms logout actually revoked it server-side,
    // not just cleared client state.
    const sessionAfterLogout = await page.request.get(
      `${API_ORIGIN}/admin/v1/session`,
    );
    expect(sessionAfterLogout.status()).toBe(401);
  });

  test('unauthenticated visitors are redirected to login', async ({ page }) => {
    await page.goto('/reports');
    await expect(page).toHaveURL(/\/login$/);
  });
});
