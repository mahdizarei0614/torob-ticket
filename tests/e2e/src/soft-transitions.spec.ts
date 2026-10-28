import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { TransportSearchQuery } from '@torob-ticket/contracts';

const out = resolve(process.env.SOFT_TRANSITIONS_EVIDENCE_DIR ?? 'docs/evidence/adjustments/soft-transitions/native');
const query: TransportSearchQuery = { mode: 'flight', scope: 'domestic', tripType: 'one-way', originCityId: 'tehran', destinationCityId: 'mashhad', departureDate: '2026-10-29', party: { adults: 1, children: 0, infants: 0 }, classCode: 'economy', filters: {}, sort: 'cheapest' };
const results = (page: Page) => page.getByRole('region', { name: 'نتایج مقایسه سفر', exact: true });
const save = (name: string, value: unknown) => writeFileSync(resolve(out, name + '.json'), JSON.stringify(value, null, 2) + '\n');
async function open(page: Page) {
  await page.goto('/?q=' + encodeURIComponent(JSON.stringify(query)));
  await expect(page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true })).toBeEnabled();
  await expect(page.locator('[data-date-price-status]')).toHaveAttribute('data-date-price-status', 'complete', { timeout: 20000 });
}
test.beforeEach(async ({ page }) => {
  mkdirSync(out, { recursive: true });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.addInitScript(() => localStorage.setItem('torobticket.appearance', 'dark'));
  expect((await page.request.post('/api/v1/demo/session', { data: { seed: 3333, scenario: 'normal', anchorInstant: '2026-10-25T06:00:00Z' } })).status()).toBe(201);
});
test.afterEach(async ({ page }, info) => { const reset = await page.request.post('/api/v1/admin/reset', { data: {} }); save('cleanup-' + info.title.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 65), { status: reset.status() }); expect(reset.status()).toBe(201); });

test('@soft-motion vehicle palettes interpolate CSS and GPU while appearance keeps a slower circle', async ({ page }) => {
  await page.addInitScript(() => {
    const state = { clips: [] as number[], colors: [] as { css: string; gpu: number[]; mode?: string }[] };
    Object.assign(window, { softMotion: state });
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (frames, options) { if (options && typeof options === 'object' && 'pseudoElement' in options) state.clips.push(Number(options.duration)); return animate.call(this, frames, options); };
    const uniform = WebGL2RenderingContext.prototype.uniform4f;
    const location = WebGL2RenderingContext.prototype.getUniformLocation;
    const names = new WeakMap<WebGLUniformLocation, string>();
    WebGL2RenderingContext.prototype.getUniformLocation = function (program, name) { const value = location.call(this, program, name); if (value) names.set(value, name); return value; };
    WebGL2RenderingContext.prototype.uniform4f = function (at, x, y, z, w) { if (at && names.get(at) === 'dot' && document.documentElement.dataset.paletteTransition) state.colors.push({ css: getComputedStyle(document.documentElement).getPropertyValue('--scene-dot').trim(), gpu: [x, y, z, w], mode: document.documentElement.dataset.mode }); return uniform.call(this, at, x, y, z, w); };
  });
  await open(page); console.log('palette: date inventory ready'); await expect(page.locator('[data-graphics-status="ready"]')).toBeVisible({timeout:15000});
  console.log('palette: graphics ready');
  const before = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--canvas'));
  await page.getByRole('radiogroup', { name: 'وسیله سفر', exact: true }).getByText('قطار', { exact: true }).click();
  console.log('palette: train clicked');
  await expect(page.locator('html')).toHaveAttribute('data-palette-transition', 'morph');
  const middle = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--canvas'));
  await expect(page.locator('html')).not.toHaveAttribute('data-palette-transition', /.+/);
  const after = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--canvas'));
  expect(middle).not.toBe(before); expect(middle).not.toBe(after);
  const modeSamples = await page.evaluate(() => (window as unknown as { softMotion: { clips: number[]; colors: { css: string; gpu: number[] }[] } }).softMotion);
  expect(modeSamples.clips).toEqual([]); expect(new Set(modeSamples.colors.map(frame => frame.css)).size).toBeGreaterThan(3);
  const linear = (v: number) => v / 255 <= .04045 ? v / 255 / 12.92 : Math.pow((v / 255 + .055) / 1.055, 2.4);
  for (const sample of modeSamples.colors) { const rgb = sample.css.match(/[\d.]+/g)!.map(Number); sample.gpu.slice(0, 3).forEach((v, i) => expect(v).toBeCloseTo(linear(rgb[i]!), 4)); }
  console.log('palette: intermediate GPU samples verified');
  await page.getByRole('button', { name: 'نمای روشن', exact: true }).click();
  await expect.poll(async () => page.evaluate(() => (window as unknown as { softMotion: { clips: number[] } }).softMotion.clips.at(-1))).toBe(780);
  await page.waitForTimeout(850);
  await expect(page.locator('html')).toHaveAttribute('data-appearance', 'light');
  save('palette', { before, middle, after, modeSamples, appearanceClips: await page.evaluate(() => (window as unknown as {softMotion:{clips:number[]}}).softMotion.clips) }); await page.screenshot({ path: resolve(out, 'train-light.png') });
});

test('@soft-motion aligned class segments and calendar below a shorter wheel fit desktop and mobile', async ({ page }) => {
  await open(page); await page.evaluate(() => document.fonts.ready);
  const geometry = await page.evaluate(() => {
    const box = (element: Element) => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom }; };
    const city = document.querySelector('[role="combobox"][aria-label="مبدا"]') ?? document.querySelector('input[role="combobox"]')!;
    const destination = document.querySelectorAll('input[role="combobox"]')[1]!;
    const classes = Array.from(document.querySelectorAll('[role="radiogroup"]')).find(node => node.textContent?.includes('کلاس سفر'))!;
    const wheel = document.querySelector('[role="listbox"][aria-label="روزهای نزدیک"]')!;
    const calendar = document.querySelector('[aria-label="تقویم جلالی و انتخاب تاریخ"]')!;
    return { origin: box(city.parentElement!), destination: box(destination.parentElement!), classes: box(classes.querySelector('input[type="radio"]')!.closest('label')!.parentElement!), wheel: box(wheel), calendar: box(calendar), chart: box(document.querySelector('[aria-label="انتخاب روز از نمودار"]')!) };
  });
  expect(Math.abs(geometry.origin.y - geometry.destination.y)).toBeLessThan(2); expect(Math.abs(geometry.origin.y - geometry.classes.y)).toBeLessThan(2);
  expect(geometry.wheel.height).toBe(132); expect(Math.abs(geometry.calendar.width - geometry.wheel.width)).toBeLessThan(2);
  expect(geometry.calendar.y).toBeGreaterThan(geometry.wheel.bottom); expect(Math.abs(geometry.chart.y - geometry.wheel.y)).toBeLessThan(2); expect(Math.abs(geometry.chart.bottom - geometry.calendar.bottom)).toBeLessThan(2);
  await page.getByRole('radiogroup', { name: 'کلاس سفر', exact: true }).getByRole('radio', { name: 'اقتصادی', exact: true }).focus(); await page.keyboard.press('ArrowLeft');
  expect(await page.getByRole('radiogroup', { name: 'کلاس سفر', exact: true }).getByRole('radio', { checked: true }).count()).toBe(1);
  await page.getByRole('button', { name: 'تقویم جلالی و انتخاب تاریخ', exact: true }).click(); await expect(page.getByRole('dialog', { name: 'انتخاب تاریخ سفر', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'انصراف', exact: true }).click(); await expect(page.getByRole('button', { name: 'تقویم جلالی و انتخاب تاریخ', exact: true })).toBeFocused();
  await page.getByRole('radiogroup', { name: 'کلاس سفر', exact: true }).getByText('اقتصادی', {exact:true}).click();
  await expect(page.locator('[data-date-price-status]')).toHaveAttribute('data-date-price-status', 'complete', {timeout:20000});
  await page.screenshot({ path: resolve(out, 'aligned-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => scrollTo(0, 0)); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390); await page.screenshot({ path: resolve(out, 'aligned-mobile.png') }); save('layout', geometry);
});

test('@soft-motion skeleton, selected heading and list replacement retain safe finite motion', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true }).click(); await expect(page.locator('[data-results-skeleton]')).toBeVisible();
  await expect(results(page)).toHaveAttribute('data-status', 'complete', { timeout: 20000 });
  const map = page.getByRole('complementary', { name: 'نقشه سفر', exact: true }); await expect(map).toHaveAttribute('data-map-itinerary', /.+/);
  const current = await map.getAttribute('data-map-itinerary');
  const response = await page.request.get('/api/v1/searches/' + await results(page).getAttribute('data-search-id'));
  const snapshot = (await response.json()).snapshot;
  const target = snapshot.groups.find((group: { itinerary: { itineraryId: string } }) => group.itinerary.itineraryId !== current);
  const ticket = results(page).locator('article[data-group-id="' + target.groupId + '"]').first();
  const headingBefore = await map.locator('[data-map-heading]').innerText();
  await ticket.getByRole('button', { name: 'انتخاب پیشنهاد', exact: true }).press('Enter'); await expect(map).toHaveAttribute('data-map-itinerary', target.itinerary.itineraryId);
  await expect(map.locator('[data-map-heading-key]:not([aria-hidden])')).toHaveAttribute('data-map-heading-key', target.itinerary.itineraryId + ':outbound');
  await expect.poll(async () => map.locator('[data-map-heading]').innerText()).not.toBe(headingBefore);
  const detail = ticket.getByRole('button', { name: 'جزئیات سفر', exact: true }); await detail.click(); await expect(detail).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: 'تقویم جلالی و انتخاب تاریخ', exact: true }).click(); await page.getByRole('button', { name: 'انصراف', exact: true }).click(); await expect(detail).toHaveAttribute('aria-expanded', 'true');
  await detail.click(); const exiting = ticket.locator('[data-result-presence="exiting"]'); await expect(exiting.first()).toHaveAttribute('inert'); await expect(exiting).toHaveCount(0);
  await page.getByRole('radiogroup', { name: 'مرتب‌سازی پیشنهادها', exact: true }).getByText('سریع‌ترین', { exact: true }).click(); await expect(results(page)).toHaveAttribute('data-status', 'complete', { timeout: 20000 });
  save('content', { before: headingBefore, after: await map.locator('[data-map-heading]').innerText(), selected: await map.getAttribute('data-map-itinerary') }); await page.screenshot({ path: resolve(out, 'selected-heading.png') });
});
