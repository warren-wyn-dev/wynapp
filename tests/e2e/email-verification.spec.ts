import { expect, test } from '@playwright/test';
import { readDevEmailToken, uniqueUser } from './helpers.js';

test.describe('email verification and password reset', () => {
  test('a user can verify their email via the link the API queues', async ({
    page,
  }) => {
    const user = uniqueUser('verifylink');
    await page.goto('/register');
    await page.getByLabel('ชื่อที่แสดง').fill(user.displayName);
    await page.getByLabel('ชื่อผู้ใช้').fill(user.username);
    await page.getByLabel('อีเมล').fill(user.email);
    await page.getByLabel('รหัสผ่าน').fill(user.password);
    await page.getByRole('button', { name: 'สมัครสมาชิก' }).click();
    await expect(page.getByRole('status')).toHaveText(
      'ตรวจสอบอีเมลเพื่อยืนยันบัญชี',
    );

    const token = await readDevEmailToken(user.email, 'VERIFY_EMAIL');
    await page.goto(`/verify-email?token=${token}`);
    await expect(page.getByRole('status')).toHaveText(
      'ยืนยันอีเมลสำเร็จ คุณสามารถเข้าสู่ระบบได้แล้ว',
    );

    // Reusing the same (now-consumed) token must not verify a second time.
    await page.goto(`/verify-email?token=${token}`);
    await expect(page.locator('section.card').getByRole('alert')).toHaveText(
      'ลิงก์หมดอายุหรือไม่ถูกต้อง',
    );
  });

  test('an invalid link falls back to a working resend form', async ({
    page,
  }) => {
    const user = uniqueUser('resendlink');
    await page.goto('/register');
    await page.getByLabel('ชื่อที่แสดง').fill(user.displayName);
    await page.getByLabel('ชื่อผู้ใช้').fill(user.username);
    await page.getByLabel('อีเมล').fill(user.email);
    await page.getByLabel('รหัสผ่าน').fill(user.password);
    await page.getByRole('button', { name: 'สมัครสมาชิก' }).click();
    await expect(page.getByRole('status')).toHaveText(
      'ตรวจสอบอีเมลเพื่อยืนยันบัญชี',
    );

    await page.goto('/verify-email?token=not-a-real-token-at-all');
    await expect(page.locator('section.card').getByRole('alert')).toHaveText(
      'ลิงก์หมดอายุหรือไม่ถูกต้อง',
    );
    await page.getByLabel('อีเมล').fill(user.email);
    await page.getByRole('button', { name: 'ส่งอีเมลยืนยันอีกครั้ง' }).click();
    await expect(page.getByRole('status')).toHaveText(
      'หากบัญชีมีสิทธิ์ เราจะส่งอีเมลให้คุณ',
    );

    const token = await readDevEmailToken(user.email, 'VERIFY_EMAIL');
    await page.goto(`/verify-email?token=${token}`);
    await expect(page.getByRole('status')).toHaveText(
      'ยืนยันอีเมลสำเร็จ คุณสามารถเข้าสู่ระบบได้แล้ว',
    );
  });

  test('a user can reset their password via the link and log in with it', async ({
    page,
  }) => {
    const user = uniqueUser('resetlink');
    await page.goto('/register');
    await page.getByLabel('ชื่อที่แสดง').fill(user.displayName);
    await page.getByLabel('ชื่อผู้ใช้').fill(user.username);
    await page.getByLabel('อีเมล').fill(user.email);
    await page.getByLabel('รหัสผ่าน').fill(user.password);
    await page.getByRole('button', { name: 'สมัครสมาชิก' }).click();
    await expect(page.getByRole('status')).toHaveText(
      'ตรวจสอบอีเมลเพื่อยืนยันบัญชี',
    );

    await page.goto('/forgot-password');
    await page.getByLabel('อีเมล').fill(user.email);
    await page.getByRole('button', { name: 'ส่งลิงก์รีเซ็ต' }).click();
    await expect(page.getByRole('status')).toHaveText(
      'หากบัญชีมีสิทธิ์ เราจะส่งอีเมลให้คุณ',
    );

    const token = await readDevEmailToken(user.email, 'PASSWORD_RESET');
    const newPassword = 'Bb2!Reset5678';
    await page.goto(`/reset-password?token=${token}`);
    await page.getByLabel('รหัสผ่านใหม่').fill(newPassword);
    await page.getByRole('button', { name: 'เปลี่ยนรหัสผ่าน' }).click();
    await expect(page.getByRole('status')).toHaveText(
      'เปลี่ยนรหัสผ่านสำเร็จ คุณสามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้แล้ว',
    );

    await page.goto('/login');
    await page.getByLabel('อีเมล').fill(user.email);
    await page.getByLabel('รหัสผ่าน').fill(newPassword);
    await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
    await expect(page.getByRole('status')).toHaveText('เข้าสู่ระบบสำเร็จ');
  });

  test('reset-password with no token shows an invalid-link message', async ({
    page,
  }) => {
    await page.goto('/reset-password');
    await expect(page.locator('section.card').getByRole('alert')).toHaveText(
      'ลิงก์ไม่ถูกต้อง โปรดเปิดลิงก์จากอีเมลของคุณอีกครั้ง',
    );
  });

  test('verify-email with no token shows the resend form directly', async ({
    page,
  }) => {
    await page.goto('/verify-email');
    await expect(page.locator('section.card').getByRole('alert')).toHaveText(
      'เปิดลิงก์ในอีเมลของคุณ ลิงก์ที่หมดอายุหรือไม่ถูกต้องสามารถขอใหม่ได้',
    );
    await expect(
      page.getByRole('button', { name: 'ส่งอีเมลยืนยันอีกครั้ง' }),
    ).toBeVisible();
  });
});
