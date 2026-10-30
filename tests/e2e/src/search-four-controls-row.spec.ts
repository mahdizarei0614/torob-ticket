import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const evidence = resolve(process.env.FOUR_CONTROLS_EVIDENCE_DIR ?? 'docs/evidence/adjustments/search-four-controls-row/native');
const query = { mode: 'flight', scope: 'domestic', tripType: 'one-way', originCityId: 'tehran', destinationCityId: 'mashhad', departureDate: '2026-11-02', party: { adults: 1, children: 0, infants: 0 }, classCode: 'economy', filters: {}, sort: 'cheapest' };

async function geometry(page: Page) {
 return page.locator('[data-search-controls]').evaluate(row => {
  const fields = Array.from(row.children).map(node => {
   const control = node.querySelector<HTMLElement>('[role="combobox"],[role="radiogroup"]')!;
   const labels = (control.getAttribute('aria-labelledby') ?? '').split(/\s+/).map(id => document.getElementById(id)).filter((item): item is HTMLElement => !!item && item.tagName !== 'INPUT');
   const label = labels.find(item => item.textContent?.trim());
   const surface = node.querySelector<HTMLElement>('[data-segment-track]') ?? control.parentElement!;
   const options = Array.from(node.querySelectorAll<HTMLElement>('[data-segment-option]'));
   const box = surface.getBoundingClientRect();
   return { name: label?.textContent?.trim(), labelTop: label?.getBoundingClientRect().top, labelWidth: label?.getBoundingClientRect().width,
    fieldTop: node.getBoundingClientRect().top, top: box.top, height: box.height, width: box.width, fontSize: getComputedStyle(control).fontSize,
    optionTops: options.map(option => option.getBoundingClientRect().top), optionHeights: options.map(option => option.getBoundingClientRect().height) };
  });
  return { viewport: innerWidth, pageWidth: document.documentElement.scrollWidth, rowWidth: row.clientWidth, rowScrollWidth: row.scrollWidth, rowScrollLeft: row.scrollLeft,
   overflowX: getComputedStyle(row).overflowX, fields };
 });
}

test('@four-controls all four labeled controls share one row and the leg remains visible in one-way', async ({ page, context, browser }) => {
 test.setTimeout(60000); mkdirSync(evidence, { recursive: true });
 expect(await context.cookies()).toEqual([]);
 expect((await context.request.post('/api/v1/demo/session', { data: { seed: 5730, anchorInstant: '2026-10-29T06:00:00Z' } })).status()).toBe(201);
 await page.addInitScript(() => localStorage.setItem('torobticket.appearance', 'dark'));
 await page.setViewportSize({ width: 1366, height: 768 });
 const errors: string[] = [], searches: string[] = [], rows: { phase: string; geometry: Awaited<ReturnType<typeof geometry>> }[] = [];
 page.on('pageerror', error => errors.push(error.message));
 page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/api/v1/searches')) searches.push(request.url()); });
 await page.goto('/?q=' + encodeURIComponent(JSON.stringify(query)));
 const leg = page.getByRole('radiogroup', { name: 'جستجو بر اساس', exact: true });
 const explorer = page.getByRole('region', { name: 'کاوش تاریخ سفر', exact: true });
 const calendar = page.getByRole('button', { name: 'تقویم جلالی و انتخاب تاریخ', exact: true });
 await expect(leg.getByRole('radio', { name: 'تاریخ رفت', exact: true })).toBeChecked();
 await expect(leg.getByRole('radio')).toHaveCount(1);
 await expect(leg.getByText('جستجو بر اساس', { exact: true })).toBeVisible();
 await page.evaluate(() => document.fonts.ready);
 const originalCalendar = await calendar.elementHandle();
 const record = async (phase: string) => {
  const value = await geometry(page); rows.push({ phase, geometry: value });
  expect(value.fields).toHaveLength(4);
  expect(value.fields.map(field => field.name)).toEqual(['مبدا', 'مقصد', 'کلاس سفر', 'جستجو بر اساس']);
  expect(value.pageWidth).toBeLessThanOrEqual(value.viewport);
  expect(Math.max(...value.fields.map(field => field.top)) - Math.min(...value.fields.map(field => field.top))).toBeLessThan(1);
  expect(Math.max(...value.fields.map(field => field.labelTop!)) - Math.min(...value.fields.map(field => field.labelTop!))).toBeLessThan(1);
  expect(value.fields.every(field => field.height >= 44 && field.labelWidth! > 20)).toBe(true);
  for (const field of value.fields) if (field.optionTops.length) {
   expect(Math.max(...field.optionTops) - Math.min(...field.optionTops)).toBeLessThan(1);
   expect(field.optionHeights.every(height => height >= 44)).toBe(true);
  }
  return value;
 };
 try {
  const oneWay = await record('flight-one-way-1366');
  expect(oneWay.rowScrollWidth - oneWay.rowWidth).toBeLessThanOrEqual(1);
  await page.screenshot({ path: resolve(evidence, 'one-way-1366.png') });
  await page.getByRole('radiogroup', { name: 'نوع سفر', exact: true }).getByText('رفت‌وبرگشت', { exact: true }).click();
  await expect(leg.getByRole('radio')).toHaveCount(2);
  await record('flight-round-trip-1366');
  await page.screenshot({ path: resolve(evidence, 'round-trip-1366.png') });
  for (const width of [1280, 390, 320]) {
   await page.setViewportSize({ width, height: width < 600 ? 844 : 768 });
   const value = await record(`flight-round-trip-${width}`);
   if (width < 600) expect(value.rowScrollWidth).toBeGreaterThan(value.rowWidth);
  }
  const beforeLeg = page.url();
  await leg.getByText('تاریخ برگشت', { exact: true }).click();
  await expect(explorer).toHaveAttribute('data-date-leg', 'return'); expect(page.url()).toBe(beforeLeg);
  const narrow = await record('320-after-local-scroll-to-return');
  expect(Math.abs(narrow.rowScrollLeft)).toBeGreaterThan(0);
  await page.screenshot({ path: resolve(evidence, 'local-row-320.png') });
  expect(await calendar.evaluate((node, original) => node === original, originalCalendar)).toBe(true);
  const wheelBox = await explorer.getByRole('listbox', { name: 'روزهای نزدیک', exact: true }).boundingBox(), calendarBox = await calendar.boundingBox();
  expect(calendarBox!.y).toBeGreaterThanOrEqual(wheelBox!.y + wheelBox!.height);
  await page.setViewportSize({ width: 1366, height: 768 });
  for (const [mode, label] of [['train', 'قطار'], ['bus', 'اتوبوس']] as const) {
   await page.getByRole('radiogroup', { name: 'وسیله سفر', exact: true }).getByText(label, { exact: true }).click();
   await expect(leg).toBeVisible(); await record(`${mode}-round-trip-1366`);
  }
  expect(searches).toEqual([]); expect(errors).toEqual([]);
 } finally {
  writeFileSync(resolve(evidence, 'four-controls.json'), JSON.stringify({ browser: browser.version(), rows, searchPosts: searches.length, pageErrors: errors,
   cleanup: 'Fresh empty-cookie context, no reset/deletion. Playwright closes its context; isolated evidence follows normal expiry.' }, null, 2) + '\n');
 }
});
