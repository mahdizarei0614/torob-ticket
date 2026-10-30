import { test, expect, type Locator, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const evidence = resolve(process.env.E2E_EVIDENCE_DIR ?? 'docs/evidence/adjustments/vehicle-filter-text-motion/native');
const query = { mode: 'flight', scope: 'domestic', tripType: 'one-way', originCityId: 'tehran', destinationCityId: 'mashhad', departureDate: '2026-11-02', party: { adults: 1, children: 0, infants: 0 }, classCode: 'economy', filters: {}, sort: 'cheapest' };
interface Frame {
 time: number; width: number; slots: { id: string; present: string; opacity: number; width: number; retiredSafe: boolean }[];
 texts: { text: string; opacity: number; kind: string }[];
 panels: { present: string; opacity: number; inert: boolean }[];
}
type TraceWindow = Window & { filterMotionTrace: { done: boolean; frames: Frame[] } };
function receipt(name: string, data: unknown) { mkdirSync(evidence, { recursive: true }); writeFileSync(resolve(evidence, name + '.json'), JSON.stringify(data, null, 2) + '\n'); }

async function arm(target: Locator, duration = 850) {
 await target.evaluate((element, duration) => {
  const state = { done: false, frames: [] as Frame[] }; (window as unknown as TraceWindow).filterMotionTrace = state;
  element.addEventListener('pointerdown', () => {
   const start = performance.now();
   const sample = () => {
    const row = document.querySelector('[data-search-controls]')!, track = row?.children[2]?.querySelector('[data-segment-track]');
    state.frames.push({ time: performance.now() - start, width: track?.getBoundingClientRect().width ?? 0,
     slots: Array.from(track?.querySelectorAll<HTMLElement>('[data-segment-slot]') ?? []).map(slot => ({
      id: slot.querySelector('[data-segment-option]')?.getAttribute('data-segment-option') ?? slot.getAttribute('data-segment-retired-option') ?? '',
      present: slot.dataset['segmentSlot']!, opacity: Number(getComputedStyle(slot).opacity), width: slot.getBoundingClientRect().width,
      retiredSafe: slot.dataset['segmentSlot'] !== 'outgoing' || (slot.inert && slot.getAttribute('aria-hidden') === 'true' && !slot.querySelector('input:not(:disabled)') && !slot.querySelector('[data-segment-option]')),
     })),
     texts: Array.from(document.querySelectorAll<HTMLElement>('[data-motion-text-visual]')).map(node => ({ text: node.textContent ?? '', opacity: Number(getComputedStyle(node).opacity), kind: node.dataset['motionTextVisual']! })),
     panels: Array.from(document.querySelectorAll<HTMLElement>('[data-content-presence]')).filter(node => node.querySelector('form[aria-label="فیلتر پیشنهادهای سفر"]')).map(node => ({ present: node.dataset['contentPresence']!, opacity: Number(getComputedStyle(node).opacity), inert: node.inert })),
    });
    if (performance.now() - start < duration) requestAnimationFrame(sample); else state.done = true;
   }; sample();
  }, { once: true, capture: true });
 }, duration);
}
async function finish(page: Page) {
 await expect.poll(() => page.evaluate(() => (window as unknown as TraceWindow).filterMotionTrace.done), { timeout: 12000 }).toBe(true);
 return page.evaluate(() => (window as unknown as TraceWindow).filterMotionTrace.frames);
}
async function rowGeometry(page: Page) {
 return page.locator('[data-search-controls]').evaluate(row => ({ viewport: innerWidth, pageWidth: document.documentElement.scrollWidth,
  top: Array.from(row.children).map(node => {
   const surface = node.querySelector('[data-segment-track]') ?? node.querySelector('[role="combobox"]')?.parentElement;
   if (!surface) throw new Error('A labeled trip control is missing');
   return surface.getBoundingClientRect().top;
  }),
  widths: Array.from(row.querySelectorAll<HTMLElement>('[data-segment-option]')).map(node => node.getBoundingClientRect().height),
 }));
}

for (const width of [1366, 390]) test(`@filter-motion ${width}px eases vehicle options with bounded exits, native authority and stable fields`, async ({ page, context, browser }) => {
 test.setTimeout(90000); mkdirSync(evidence, { recursive: true });
 expect(await context.cookies()).toEqual([]);
 expect((await context.request.post('/api/v1/demo/session', { data: { seed: 5800 + width, anchorInstant: '2026-10-29T06:00:00Z' } })).status()).toBe(201);
 await page.setViewportSize({ width, height: width < 600 ? 844 : 768 }); await page.emulateMedia({ reducedMotion: 'no-preference' });
 await page.addInitScript(() => localStorage.setItem('torobticket.appearance', 'dark'));
 const errors: string[] = [], posts: string[] = []; page.on('pageerror', error => errors.push(error.message));
 page.on('request', request => { if (request.method() === 'POST') posts.push(new URL(request.url()).pathname); });
 await page.goto('/?q=' + encodeURIComponent(JSON.stringify(query))); await page.bringToFront(); await page.evaluate(() => document.fonts.ready);
 const modes = page.getByRole('radiogroup', { name: 'وسیله سفر', exact: true }), classes = page.getByRole('radiogroup', { name: 'کلاس سفر', exact: true });
 await expect(classes.getByRole('radio', { name: 'اقتصادی', exact: true })).toBeChecked();
 const origin = page.getByRole('combobox', { name: 'مبدا', exact: true }), originalInput = await origin.elementHandle();
 const records: unknown[] = [];
 try {
  const train = modes.getByText('قطار', { exact: true }); await arm(train); await train.click();
  await expect(classes.getByRole('radio', { name: 'صندلی (سالنی)', exact: true })).toBeChecked();
  await expect(classes.getByRole('radio')).toHaveCount(3);
  const frames = await finish(page), finalWidth = frames.at(-1)!.width, initialWidth = frames[0]!.width;
  const intermediateWidths = frames.filter(frame => frame.width > Math.min(initialWidth, finalWidth) + 1 && frame.width < Math.max(initialWidth, finalWidth) - 1).length;
  const intermediateOpacity = frames.filter(frame => frame.slots.some(slot => slot.present === 'current' && slot.opacity > .01 && slot.opacity < .99)).length;
  records.push({ phase: 'flight-to-train', frames, intermediateWidths, intermediateOpacity }); receipt(`controls-${width}`, { browser: browser.version(), records });
  expect(intermediateWidths).toBeGreaterThan(2); expect(intermediateOpacity).toBeGreaterThan(2);
  expect(frames.every(frame => frame.slots.every(slot => slot.retiredSafe))).toBe(true);
  const geometry = await rowGeometry(page); expect(geometry.pageWidth).toBeLessThanOrEqual(width); expect(Math.max(...geometry.top) - Math.min(...geometry.top)).toBeLessThan(1);
  expect(geometry.widths.every(height => height >= 44)).toBe(true);
  const indicator = await classes.locator('[data-segment-track]').evaluate(track => {
   const selected = track.querySelector<HTMLElement>('[data-segment-option][data-selected]')!.getBoundingClientRect(), line = track.querySelector('[data-segment-indicator]')!.getBoundingClientRect();
   return { x: Math.abs(selected.x-line.x), width: Math.abs(selected.width-line.width) };
  }); expect(indicator.x).toBeLessThan(1); expect(indicator.width).toBeLessThan(1);
  // A stable segmented label accepts real rapid clicks without accumulating exits.
  for (const label of ['اتوبوس', 'پرواز', 'قطار', 'اتوبوس']) await modes.getByText(label, { exact: true }).click({ force: true });
  await expect(classes.getByRole('radio', { name: 'معمولی', exact: true })).toBeChecked();
  await expect(classes.locator('[data-segment-slot="outgoing"]')).toHaveCount(0);
  expect(await origin.evaluate((node, original) => node === original, originalInput)).toBe(true);
  await origin.fill('تهر'); await expect(origin).toHaveValue('تهر'); expect(await origin.evaluate((node, original) => node === original, originalInput)).toBe(true);
  await page.keyboard.press('Escape');
  // Reduced motion settles synchronously and does not replay when enabled again.
  await page.emulateMedia({ reducedMotion: 'reduce' }); await modes.getByText('پرواز', { exact: true }).click();
  await expect(classes.getByRole('radio', { name: 'اقتصادی', exact: true })).toBeChecked();
  await expect(classes.locator('[data-segment-slot="outgoing"]')).toHaveCount(0);
  expect(await classes.locator('[data-segment-slot]').evaluateAll(nodes => nodes.every(node => getComputedStyle(node).opacity === '1'))).toBe(true);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(classes.locator('[data-motion-text-visual="outgoing"]')).toHaveCount(0);
  const finalGeometry = await rowGeometry(page); expect(finalGeometry.pageWidth).toBeLessThanOrEqual(width);
  expect(errors).toEqual([]); expect(posts.filter(path => path === '/api/v1/searches')).toEqual([]);
  receipt(`controls-${width}`, { browser: browser.version(), records, geometry, finalGeometry, indicator, inputNodeRetained: true, rapidLatestMode: 'bus', reducedMotionSettled: true, posts, errors,
   cleanup: 'Fresh empty-cookie context only. No server reset/deletion; normal expiry after context closes.' });
  await page.screenshot({ path: resolve(evidence, `controls-${width}.png`) });
 } finally { await originalInput?.dispose(); }
});

test('@filter-motion results text and filter overlay ease without per-card motion or stale actions', async ({ page, context, browser }) => {
 test.setTimeout(90000); mkdirSync(evidence, { recursive: true });
 expect(await context.cookies()).toEqual([]);
 expect((await context.request.post('/api/v1/demo/session', { data: { seed: 5800, anchorInstant: '2026-10-29T06:00:00Z' } })).status()).toBe(201);
 await page.setViewportSize({ width: 1366, height: 768 }); await page.emulateMedia({ reducedMotion: 'no-preference' });
 const errors: string[] = [], posts: string[] = []; page.on('pageerror', error => errors.push(error.message));
 page.on('request', request => { if (request.method() === 'POST') posts.push(new URL(request.url()).pathname); });
 await page.goto('/?q=' + encodeURIComponent(JSON.stringify(query))); await page.bringToFront();
 const search = page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true }); await arm(search, 10000); await search.click();
 const region = page.getByRole('region', { name: 'نتایج مقایسه سفر', exact: true });
 await expect(region).toHaveAttribute('data-status', 'complete', { timeout: 30000 });
 const providerFrames = await finish(page); receipt('results-text', { browser: browser.version(), providerFrames });
 await expect(region.locator('article[data-price-card-id]')).toHaveCount(48);
 expect(await region.locator('article[data-price-card-id] [data-motion-text]').count()).toBe(0);
 expect(await region.locator('[data-motion-text]').count()).toBeLessThan(16);
 const filter = region.getByRole('button', { name: 'فیلتر نتایج', exact: true }); await arm(filter); await filter.click();
 const form = page.getByRole('form', { name: 'فیلتر پیشنهادهای سفر', exact: true }); await expect(form).toBeVisible();
 const openFrames = await finish(page); receipt('filter-panel', { browser: browser.version(), openFrames });
 expect(openFrames.filter(frame => frame.panels.some(panel => panel.present === 'present' && panel.opacity > .01 && panel.opacity < .99)).length).toBeGreaterThan(2);
 const budget = form.getByRole('spinbutton', { name: 'سقف مبلغ کل (تومان)', exact: true }), original = await budget.elementHandle();
 await budget.fill('3000000'); expect(await budget.evaluate((node, old) => node === old, original)).toBe(true);
 const oldForm = await form.elementHandle(), oldClear = await form.getByRole('button', { name: 'پاک کردن فیلترها', exact: true }).elementHandle();
 const cancel = form.getByRole('button', { name: 'انصراف از فیلتر', exact: true }); await arm(cancel); await cancel.click();
 // Programmatic events must be rejected even while an old form is visually retained.
 await oldForm!.evaluate(node => node.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
 await oldClear!.evaluate(node => (node as HTMLButtonElement).click());
 await filter.click({ force: true }); const fresh = page.getByRole('form', { name: 'فیلتر پیشنهادهای سفر', exact: true });
 await expect(fresh.getByRole('spinbutton', { name: 'سقف مبلغ کل (تومان)', exact: true })).toHaveValue('');
 await oldForm!.evaluate(node => { node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); node.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
 await expect(fresh).toBeVisible(); await expect(filter).toHaveAttribute('aria-expanded', 'true');
 const closeFrames = await finish(page); receipt('filter-panel', { browser: browser.version(), openFrames, closeFrames });
 expect(closeFrames.some(frame => frame.panels.some(panel => panel.present === 'exiting' && panel.inert && panel.opacity > .01 && panel.opacity < .99))).toBe(true);
 await fresh.getByRole('spinbutton', { name: 'سقف مبلغ کل (تومان)', exact: true }).focus();
 await page.keyboard.press('Escape'); await expect(filter).toHaveAttribute('aria-expanded', 'false');
 await expect(page.locator('[data-content-presence] form[aria-label="فیلتر پیشنهادهای سفر"]')).toHaveCount(0);
 expect(posts.filter(path => path === '/api/v1/searches')).toHaveLength(1); expect(posts.some(path => /\/referrals\//.test(path))).toBe(false); expect(errors).toEqual([]);
 const animatedWords = providerFrames.filter(frame => frame.texts.some(text => /فروشنده/.test(text.text) && text.opacity > .01 && text.opacity < .99)).length;
 expect(animatedWords).toBeGreaterThan(0);
 await page.screenshot({ path: resolve(evidence, 'results.png') });
 receipt('results-text', { browser: browser.version(), providerFrames, animatedWords, cards: 48, perCardMotionText: 0, inputNodeRetained: true, rejectedOldActions: true, posts, errors,
  cleanup: 'Fresh empty-cookie context only. No server reset/deletion; normal expiry after context closes.' });
});
