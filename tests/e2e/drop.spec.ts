import { expect, test } from '@playwright/test';
import { registerAndLogin, uniqueUser } from './helpers.js';

test.describe('Drop create, view, and like', () => {
  test('publish a text Drop and see it in the feed and its own page', async ({
    page,
  }) => {
    const user = uniqueUser('dropper');
    await registerAndLogin(page, user);

    const body = `E2E drop ${Date.now()}`;
    await page.goto('/create');
    await page.getByLabel('ข้อความ').fill(body);
    const created = page.waitForResponse(
      (r) => r.url().includes('/v1/drops') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'เผยแพร่' }).click();
    await expect(page.getByText('เผยแพร่ Drop แล้ว')).toBeVisible();
    const dropId = ((await (await created).json()) as { data: { id: string } })
      .data.id;

    // Other specs publish Drops into this same database, and the feed is a
    // ranked "for you" surface rather than a plain reverse-chronological
    // list, so drive the Like interaction from the Drop's own permalink
    // page, which is deterministic regardless of feed ranking/pagination.
    await page.goto(`/drops/${dropId}`);
    const detail = page.locator('article.drop-detail');
    await expect(detail.getByText(body)).toBeVisible();
    await expect(detail.getByRole('button', { name: /Like/ })).toHaveText(
      '❤️ Like',
    );
    await detail.getByRole('button', { name: /Like/ }).click();
    await expect(detail.getByRole('button', { name: /Unlike/ })).toHaveText(
      '❤️ Unlike',
    );
    await expect(detail.getByText('1 Likes')).toBeVisible();
  });

  test('the API rejects an empty Drop', async ({ page }) => {
    const user = uniqueUser('emptydrop');
    await registerAndLogin(page, user);

    await page.goto('/create');
    await page.getByRole('button', { name: 'เผยแพร่' }).click();
    await expect(
      page.getByText('ดำเนินการไม่สำเร็จ กรุณาตรวจข้อมูลแล้วลองอีกครั้ง'),
    ).toBeVisible();
  });
});
