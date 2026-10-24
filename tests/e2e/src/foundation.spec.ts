import { expect, test } from '@playwright/test';
test('consumer loads a Persian demo entry', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('main')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('ترب تیکت');
  await expect(page.getByRole('note')).toContainText('نسخه نمایشی');
});
test('admin entry is English and visibly a demo', async ({ page }) => {
  await page.goto('http://127.0.0.1:4301/admin/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('TorobTicket Admin');
  await expect(page.getByRole('main')).toHaveAttribute('dir', 'ltr');
  await expect(page.getByRole('note')).toContainText('Demo environment');
});
test('web development proxy reaches the API liveness endpoint', async ({ request }) => {
  const response = await request.get('/api/health/live');
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: 'ok', service: 'torob-ticket-api', mode: 'demo' });
});
