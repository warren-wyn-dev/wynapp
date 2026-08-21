import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { DEV_EMAIL_LOG_PATH } from './constants.js';

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

type DevEmail = {
  to: string;
  template: 'VERIFY_EMAIL' | 'PASSWORD_RESET' | 'PASSWORD_CHANGED';
  token?: string;
};

/**
 * Reads the raw token out of the most recent matching message
 * DevelopmentEmailAdapter appended to DEV_EMAIL_LOG_PATH (see
 * apps/api/src/email.ts) — there is no real mailbox in E2E, so this is how
 * specs get the actual token the API generated for a verify-email or
 * password-reset link, rather than stubbing the flow out.
 */
export async function readDevEmailToken(
  to: string,
  template: DevEmail['template'],
): Promise<string> {
  const content = await readFile(DEV_EMAIL_LOG_PATH, 'utf8');
  const messages: DevEmail[] = content
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as DevEmail);
  const match = messages
    .reverse()
    .find((m) => m.to === to && m.template === template);
  if (!match?.token) throw new Error(`no ${template} email found for ${to}`);
  return match.token;
}
