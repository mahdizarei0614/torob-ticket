import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { TransportSearchQuery } from '@torob-ticket/contracts';

const evidence = resolve(process.env.COMPACT_JOURNEY_EVIDENCE_DIR ?? '.local/evidence/adjustments/compact-journey/browser');
const base: TransportSearchQuery = { mode: 'flight', scope: 'domestic', tripType: 'one-way', originCityId: 'tehran', destinationCityId: 'mashhad', departureDate: '2026-10-30', party: { adults: 1, children: 0, infants: 0 }, classCode: 'economy', filters: {}, sort: 'cheapest' };
const save = (name: string, value: unknown) => writeFileSync(resolve(evidence, name + '.json'), JSON.stringify(value, null, 2) + '\n');
const form = (page: Page) => page.getByRole('form', { name: 'جست‌وجوی سفر', exact: true });
const calendar = (page: Page) => page.getByRole('dialog', { name: 'انتخاب تاریخ سفر', exact: true });
const hotel = (page: Page) => page.getByRole('dialog', { name: 'هتل‌های مشهد', exact: true });
const hotelTrigger = (page: Page) => page.getByRole('button', { name: 'مقایسه اقامتگاه‌های مشهد', exact: true });
async function open(page: Page, query = base) {
  await page.goto('/?q=' + encodeURIComponent(JSON.stringify(query)));
  await expect(form(page).getByRole('button', { name: 'جست‌وجوی سفر', exact: true })).toBeEnabled();
}
test.beforeEach(async ({ context, page }) => {
  mkdirSync(evidence, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => localStorage.setItem('torobticket.appearance', 'dark'));
  expect((await context.request.post('/api/v1/demo/session', { data: { seed: 3333, anchorInstant: '2026-10-25T06:00:00Z' } })).status()).toBe(201);
});
test.afterEach(async ({ context }, info) => {
  const response = await context.request.post('/api/v1/admin/reset', { data: {} });
  save('cleanup-' + info.title.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 70), { status: response.status() });
  expect(response.status()).toBe(201);
});

test('@compact-journey compact forms keep defaults and searchable city controls', async ({ page }) => {
  await open(page, { ...base, party: { adults: 2, children: 1, infants: 0, childAges: [8] }, classCode: 'seat' });
  await expect(page.getByRole('radiogroup', { name: 'کلاس سفر', exact: true }).getByRole('radio', {name:'اقتصادی',exact:true})).toBeChecked();
  const response = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/api/v1/searches'));
  await form(page).getByRole('button', { name: 'جست‌وجوی سفر', exact: true }).click();
  const body = await (await response).json();
  expect(body.snapshot.query.party).toEqual({ adults: 1, children: 0, infants: 0 });
  await expect(page.getByRole('region', { name: 'نتایج مقایسه سفر', exact: true })).toHaveAttribute('data-status', 'complete');
  await expect(page.getByText(/مسافران · حداکثر/)).toHaveCount(0);
  await expect(page.getByText('روزهای سفر را مقایسه کنید', { exact: true })).toHaveCount(0);
  await expect(page.getByText('بکشید یا از کلیدهای بالا و پایین استفاده کنید', { exact: true })).toHaveCount(0);
  for (const [name, value] of [['قطار', 'seat'], ['اتوبوس', 'standard'], ['پرواز', 'economy']]) {
    await page.getByRole('radiogroup', { name: 'وسیله سفر', exact: true }).getByText(name!, { exact: true }).click();
    await expect(page.getByRole('radiogroup', { name: 'کلاس سفر', exact: true }).getByRole('radio', {name:({seat:'صندلی (سالنی)',standard:'معمولی',economy:'اقتصادی'} as Record<string,string>)[value!]!,exact:true})).toBeChecked();
    // Decision0043: these are uncommitted form choices; URL keeps the actual
    // economy comparison until another explicit search is accepted.
    expect(JSON.parse(new URL(page.url()).searchParams.get('q')!).classCode).toBe('economy');
  }
  const destination = page.getByRole('combobox', { name: 'مقصد', exact: true });
  await page.getByRole('button', { name: 'پاک کردن مقصد', exact: true }).click();
  await expect(destination).toHaveValue(''); await expect(destination).toBeFocused();
  await expect(destination).toHaveAttribute('placeholder', 'جست‌وجوی شهر مقصد');
  await expect(page.locator('[data-hotel-entry]')).toHaveCount(0);
  await destination.fill('مشهد'); await destination.press('ArrowDown'); await destination.press('Enter');
  await expect(destination).toHaveValue('مشهد');
  const measurements = [];
  for (const size of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 968, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(size); await page.evaluate(() => scrollTo(0, 0));
    const dimensions = await form(page).evaluate(node => { const box = node.getBoundingClientRect(); return { top: box.top, bottom: box.bottom, height: box.height, scrollWidth: document.documentElement.scrollWidth, width: innerWidth }; });
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(size.width);
    if (size.width >= 768) { expect(dimensions.bottom).toBeLessThan(size.height); await expect(page.getByRole('region', { name: 'جزئیات مسیر سفر', exact: true })).not.toBeVisible(); }
    measurements.push({ size, dimensions });
    await page.screenshot({ path: resolve(evidence, `form-${size.width}.png`) });
  }
  save('compact-controls', { measurements, submittedParty: body.snapshot.query.party });
});

test('@compact-journey calendar is small and preserves provisional apply and cancel', async ({ page }) => {
  await open(page);
  const trigger = page.getByRole('button', { name: 'تقویم جلالی و انتخاب تاریخ', exact: true });
  expect(await trigger.locator('svg').count()).toBe(1);
  const metrics = [];
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 844 }); await trigger.click(); await expect(calendar(page)).toBeVisible();
    const box = await calendar(page).boundingBox();
    const cells = await calendar(page).locator('[data-date]:not([data-outside-month])').evaluateAll(nodes => nodes.map(node => { const rect = node.getBoundingClientRect(); return { width: rect.width, height: rect.height }; }));
    expect(box!.width).toBeLessThanOrEqual(432); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
    expect(cells.length).toBeGreaterThan(20); expect(cells.every(cell => cell.width >= 43.9 && cell.height >= 44)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: resolve(evidence, `calendar-${width}.png`) }); metrics.push({ width, dialog: box, smallestCell: { width: Math.min(...cells.map(c => c.width)), height: Math.min(...cells.map(c => c.height)) } });
    await calendar(page).getByRole('button', { name: 'انصراف', exact: true }).click(); await expect(trigger).toBeFocused();
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  const original = page.url(); await trigger.click();
  await calendar(page).locator('summary').filter({ hasText: 'ورود تاریخ میلادی' }).click();
  await calendar(page).getByLabel('تاریخ رفت میلادی در تقویم', { exact: true }).fill('2026-11-02');
  await calendar(page).getByRole('button', { name: 'انصراف', exact: true }).click(); expect(page.url()).toBe(original);
  await trigger.click(); await calendar(page).locator('summary').filter({ hasText: 'ورود تاریخ میلادی' }).click();
  await calendar(page).getByLabel('تاریخ رفت میلادی در تقویم', { exact: true }).fill('2026-11-02');
  await calendar(page).getByRole('button', { name: 'اعمال تاریخ‌ها', exact: true }).click();
  await expect.poll(() => JSON.parse(new URL(page.url()).searchParams.get('q')!).departureDate).toBe('2026-11-02');
  save('compact-calendar', metrics);
});

test('@compact-journey hotel dock starts one comparison and retains its automatic stay across responsive movement', async ({ page }) => {
  let transportPosts = 0; page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/api/v1/searches')) transportPosts++; });
  await open(page);
  await expect(page.locator('[data-map-hotel-dock] [data-hotel-entry]')).toHaveCount(1);
  await expect(page.locator('[data-hotel-entry]')).toHaveCount(1); expect(transportPosts).toBe(0);
  await expect(page.locator('[data-hotel-entry]')).toHaveAttribute('data-motion-policy', 'finite');
  const opening = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/api/v1/hotel-searches'));
  await hotelTrigger(page).click(); await expect(hotel(page)).toBeVisible();
  const http = await opening; const body = await http.json(); expect(http.status()).toBe(201); expect(body.status).toBe('complete');
  expect(transportPosts).toBe(1); expect(body.query.rooms).toBe(1);
  expect(new Date(body.query.checkOut + 'T12:00:00Z').getTime() - new Date(body.query.checkIn + 'T12:00:00Z').getTime()).toBe(86400000);
  const snapshot = hotel(page).locator('[data-hotel-dialog]');
  const capacity = hotel(page).getByRole('combobox', { name: 'ظرفیت اتاق', exact: true });
  await expect(capacity).toHaveValue('1'); await expect(capacity.locator('option')).toHaveCount(4);
  await expect(hotel(page).locator('input:not([type=radio])')).toHaveCount(0);
  const results = hotel(page).getByRole('region', { name: 'نتایج مقایسه اقامتگاه‌ها', exact: true });
  await expect(results).toHaveAttribute('data-hotel-search-id', body.hotelSearchId);
  for (const width of [968, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 }); await expect(hotel(page)).toBeVisible();
    await expect(snapshot).toHaveAttribute('data-hotel-check-in', body.query.checkIn);
    await expect(snapshot).toHaveAttribute('data-hotel-check-out', body.query.checkOut);
    await expect(results).toHaveAttribute('data-hotel-search-id', body.hotelSearchId);
    await expect(capacity).toHaveValue('1');
  }
  await page.setViewportSize({ width: 968, height: 900 });
  await hotel(page).getByRole('button', { name: 'بستن', exact: true }).click(); await expect(hotelTrigger(page)).toBeFocused();
  await expect(page.locator('[data-hotel-entry]')).toHaveAttribute('data-hotel-placement', 'inline');
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator('[data-map-hotel-dock] [data-hotel-entry]')).toHaveCount(1);
  await hotelTrigger(page).click(); await expect(results).toHaveAttribute('data-hotel-search-id', body.hotelSearchId); expect(transportPosts).toBe(1);
  await expect(page.getByRole('region', { name: 'نتایج مقایسه سفر', exact: true, includeHidden: true })).toHaveAttribute('data-status', 'complete');
  await expect(page.locator('article[data-group-id][data-selected="true"]')).toHaveCount(1);
  await hotel(page).getByRole('button', { name: 'بستن', exact: true }).click(); await expect(hotelTrigger(page)).toBeFocused();
  await page.screenshot({ path: resolve(evidence, 'hotel-under-map.png') });
  save('hotel-dock', { transportPosts, hotelStatus: body.status, hotelQuery: body.query, replacedAssertion: 'Decision0061 automatic selected-arrival one-night stay supersedes editable hotel dates and Apply trip.' });
});

test('@compact-journey reduced motion settles hotel entry and respects clear route', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await open(page);
  await expect(page.locator('[data-hotel-entry]')).toHaveAttribute('data-motion-policy', 'static');
  await page.getByRole('button', { name: 'پاک کردن مقصد', exact: true }).click();
  await expect(page.locator('[data-hotel-entry]')).toHaveCount(0);
  const destination = page.getByRole('combobox', { name: 'مقصد', exact: true }); await destination.fill('مشهد');
  await page.getByRole('option').filter({ has: page.getByText('مشهد', { exact: true }) }).click();
  await expect(page.locator('[data-map-hotel-dock] [data-hotel-entry]')).toHaveAttribute('data-motion-policy', 'static');
  const style = await page.locator('[data-hotel-entry]').evaluate(node => ({ opacity: getComputedStyle(node).opacity, transform: getComputedStyle(node).transform }));
  expect(style.opacity).toBe('1'); expect(style.transform).toBe('none'); save('reduced-motion-dock', style);
});
