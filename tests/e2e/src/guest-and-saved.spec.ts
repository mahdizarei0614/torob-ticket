import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { TransportSearchQuery } from '@torob-ticket/contracts';
// Failed traces can include HttpOnly session cookies; keep explicit public receipts only.
test.use({ trace: 'off' });
const evidence = process.env.T19_EVIDENCE_DIR;
const query: TransportSearchQuery = { mode: 'flight', scope: 'domestic', tripType: 'one-way', originCityId: 'tehran', destinationCityId: 'mashhad', departureDate: '2026-11-01', party: { adults: 1, children: 0, infants: 0 }, classCode: 'economy', filters: {}, sort: 'cheapest' };
const account = (page: Page) => page.getByRole('dialog', { name: 'حساب کاربری', exact: true });
const map = (page: Page) => page.getByRole('complementary', { name: 'نقشه سفر', exact: true });
function record(name: string, value: unknown) { if (evidence) { mkdirSync(evidence, { recursive: true }); writeFileSync(resolve(evidence, name + '.json'), JSON.stringify(value, null, 2) + '\n'); } }
async function setup(page: Page) {
  expect((await page.request.post('/api/v1/demo/session', { data: { seed: 1919, anchorInstant: '2026-10-25T06:00:00Z', scenario: 'normal' } })).status()).toBe(201);
  await page.goto('/?' + new URLSearchParams({ q: JSON.stringify(query) }));
  await expect(page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true })).toBeEnabled();
  await expect(page.locator('[data-date-price-status]')).toHaveAttribute('data-date-price-status', 'complete', { timeout: 20000 });
}
async function open(page: Page) { const trigger = page.getByRole('button', { name: 'حساب کاربری', exact: true }); await trigger.scrollIntoViewIfNeeded(); await trigger.click(); await expect(account(page)).toBeVisible(); await expect(page.locator('[data-profile-popover]')).not.toHaveAttribute('data-entering', /.*/); }
async function login(page: Page) { await account(page).getByRole('button', { name: 'ادامه با ترب', exact: true }).click(); await expect(account(page).getByRole('button', { name: 'خروج از حساب', exact: true })).toBeEnabled(); }
async function close(page: Page) { await account(page).getByRole('button', { name: 'بستن حساب کاربری', exact: true }).click(); await expect(account(page)).toHaveCount(0); }

test.describe('@guest-saved optional identity without saved-search presentation', () => {
  test.afterEach(async ({ page }) => { if (!page.isClosed()) expect((await page.request.post('/api/v1/admin/reset', { data: {} })).status()).toBe(201); });
  test('sign-in and sign-out preserve the guest comparison and pinned journey without searching or saving', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1080 }); await setup(page);
    let starts = 0, saves = 0;
    page.on('request', r => { if (r.method() === 'POST' && r.url().endsWith('/api/v1/searches')) starts++; if (r.method() === 'POST' && r.url().endsWith('/api/v1/saved-searches')) saves++; });
    await page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true }).click();
    const results = page.getByRole('region', { name: 'نتایج مقایسه سفر', exact: true });
    await expect(results).toHaveAttribute('data-status', 'complete', { timeout: 20000 });
    await expect(map(page)).toHaveAttribute('data-map-itinerary', /.+/);
    const id = await results.getAttribute('data-search-id'), pinned = await map(page).getAttribute('data-map-itinerary');
    await open(page); await login(page); await expect(account(page).getByRole('button')).toHaveCount(2);
    await expect(account(page).getByRole('button', { name: /ذخیره/ })).toHaveCount(0); await close(page);
    await expect(results).toHaveAttribute('data-search-id', id!); await expect(map(page)).toHaveAttribute('data-map-itinerary', pinned!);
    await open(page); await account(page).getByRole('button', { name: 'خروج از حساب', exact: true }).click();
    await expect(account(page).getByRole('button', { name: 'ادامه با ترب', exact: true })).toBeEnabled(); await close(page);
    await expect(map(page)).toHaveAttribute('data-map-itinerary', pinned!); expect(starts).toBe(1); expect(saves).toBe(0);
    record('identity-comparison', { searchId: id, pinned, starts, saves });
  });
  test('legacy saved records remain on the server and never populate the compact mobile profile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); await setup(page);
    expect((await page.request.post('/api/v1/auth/demo/sign-in', { data: {} })).status()).toBe(201);
    for (let i = 0; i < 20; i++) {
      const departureDate = new Date(Date.UTC(2026, 9, 25 + i)).toISOString().slice(0, 10);
      expect((await page.request.post('/api/v1/saved-searches', { data: { name: 'قصد سفر ' + (i + 1), query: { ...query, departureDate } } })).status()).toBe(201);
    }
    await page.reload(); let savedReads = 0;
    page.on('request', r => { if (r.method() === 'GET' && r.url().endsWith('/api/v1/saved-searches')) savedReads++; });
    await open(page); await expect(account(page).getByRole('button', { name: 'خروج از حساب', exact: true })).toBeEnabled();
    await expect(account(page).locator('[data-saved-search-id]')).toHaveCount(0); await expect(account(page).getByRole('button')).toHaveCount(2);
    await expect(account(page).getByRole('button', { name: 'بستن حساب کاربری', exact: true })).toBeInViewport({ ratio: 1 });
    const bounds = (await page.locator('[data-profile-popover]').boundingBox())!; expect(bounds.x + bounds.width).toBeLessThanOrEqual(390); expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
    expect(savedReads).toBe(0); await close(page);
    const retained = await (await page.request.get('/api/v1/saved-searches')).json();
    expect(retained.items).toHaveLength(20); record('legacy-records-hidden', { retainedCount: retained.items.length, savedReads, bounds });
  });
  test('toolbar appearance persists for guests while the profile has no theme or save controls', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      const transitions: Promise<void>[] = [], original = document.startViewTransition?.bind(document);
      Object.assign(window, { profileThemeTransitions: transitions });
      if (original) document.startViewTransition = ((update: Parameters<Document['startViewTransition']>[0]) => {
        const transition = original(update); transitions.push(transition.finished.catch(() => undefined)); return transition;
      }) as Document['startViewTransition'];
    });
    await setup(page);
    await page.getByRole('button', { name: 'نمای تیره', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-preference', 'dark');
    await expect.poll(() => page.evaluate(() => (window as unknown as { profileThemeTransitions: Promise<void>[] }).profileThemeTransitions.length)).toBeGreaterThan(0);
    await page.evaluate(() => Promise.all((window as unknown as { profileThemeTransitions: Promise<void>[] }).profileThemeTransitions));
    await open(page); await expect(account(page).getByRole('combobox')).toHaveCount(0); await login(page);
    await page.keyboard.press('Escape'); await expect(account(page)).toHaveCount(0); await expect(page.getByRole('button', { name: 'حساب کاربری', exact: true })).toBeFocused();
    await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-preference', 'dark');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390); await expect(map(page)).toHaveCount(0);
    record('toolbar-preference', { preference: await page.locator('html').getAttribute('data-preference'), viewport: { width: 390, height: 844 } });
  });
});
