import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export function uniqueUser(prefix: string) {
  const suffix = (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  ).toLowerCase();
  return {
    email: `${prefix}${suffix}@wyn.test`,
    username: `${prefix}${suffix}`.slice(0, 30),
    password: 'Aa1!Test1234',
    displayName: `${prefix} ${suffix}`,
  };
}

export type TestUser = ReturnType<typeof uniqueUser>;

export async function registerAndLogin(
  page: Page,
  user: TestUser,
): Promise<void> {
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
  await page.getByLabel('รหัสผ่าน').fill(user.password);
  await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
  await expect(page.getByRole('status')).toHaveText('เข้าสู่ระบบสำเร็จ');
}
