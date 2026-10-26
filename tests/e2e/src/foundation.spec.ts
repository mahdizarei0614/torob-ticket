import { expect, test } from '@playwright/test';
test.afterEach(async ({ context }) => {
  const session = await context.request.get('/api/v1/demo/session');
  if (session.status() === 200) expect((await context.request.post('/api/v1/admin/reset', { data: {} })).status()).toBe(201);
  else expect(session.status()).toBe(401);
});
test('consumer loads the Persian travel comparison entry', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('main')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('سفر بعدی از کجا شروع می‌شود؟');
  await expect(page.getByRole('button',{name:'سفرهای پیشنهادی',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'حساب کاربری',exact:true})).toBeVisible();await expect(page.locator('body')).not.toContainText(/نمایشی|خیالی|شبیه‌سازی/);
});
test('admin entry is an English operations shell', async ({ page }) => {
  await page.goto('/admin/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Providers');
  await expect(page.getByRole('main')).toHaveAttribute('dir', 'ltr');
  await expect(page.getByRole('navigation', { name: 'Operations' }).getByRole('link', { name: /Providers/ })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('note')).toContainText('Travel comparison operations');
});
test('web development proxy reaches the API liveness endpoint', async ({ request }) => {
  const response = await request.get('/api/health/live');
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: 'ok', service: 'torob-ticket-api', mode: 'demo' });
});
