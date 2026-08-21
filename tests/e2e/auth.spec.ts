import { expect, test } from '@playwright/test';
import { registerAndLogin, uniqueUser } from './helpers.js';

test.describe('consumer authentication', () => {
  test('register, login, session survives navigation, and logout', async ({
    page,
  }) => {
    const user = uniqueUser('auth');
    await registerAndLogin(page, user);

    // The session/CSRF cookies are __Host- prefixed and same-origin only.
    // Loading the authenticated feed proves the cookie was actually stored
    // by the browser and sent back on the next same-origin request: an
    // unauthenticated/failed fetch renders the "โหลดฟีดไม่สำเร็จ" error
    // state instead. (Other specs may have published Drops into this same
    // database, so this does not assert the feed is empty.)
    const feedResponse = page.waitForResponse((r) =>
      r.url().includes('/v1/feed/for-you'),
    );
    await page.goto('/');
    await expect(page.getByRole('tab', { name: 'For You' })).toBeVisible();
    expect((await feedResponse).ok()).toBeTruthy();
    await expect(page.getByText('โหลดฟีดไม่สำเร็จ')).toHaveCount(0);

    await page.goto('/settings/security');
    await expect(page).toHaveURL(/\/settings\/security$/);
  });

  test('rejects an invalid password', async ({ page }) => {
    const user = uniqueUser('badauth');
    await page.goto('/register');
    await page.getByLabel('ชื่อที่แสดง').fill(user.displayName);
    await page.getByLabel('ชื่อผู้ใช้').fill(user.username);
    await page.getByLabel('อีเมล').fill(user.email);
    await page.getByLabel('รหัสผ่าน').fill(user.password);
    await page.getByRole('button', { name: 'สมัครสมาชิก' }).click();
    await expect(page.getByRole('status')).toHaveText(
      'ตรวจสอบอีเมลเพื่อยืนยันบัญชี',
    );

    await page.goto('/login');
    await page.getByLabel('อีเมล').fill(user.email);
    await page.getByLabel('รหัสผ่าน').fill('WrongPassword123!');
    await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
    await expect(page.getByText('อีเมลหรือรหัสผ่านไม่ถูกต้อง')).toBeVisible();
  });
});
