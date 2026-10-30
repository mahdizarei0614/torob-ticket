import { test, expect, type Locator, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const evidence = resolve(process.env.E2E_EVIDENCE_DIR ?? 'docs/evidence/adjustments/word-scramble-motion/native');
const query = { mode: 'flight', scope: 'domestic', tripType: 'one-way', originCityId: 'tehran', destinationCityId: 'mashhad', departureDate: '2026-11-02', party: { adults: 1, children: 0, infants: 0 }, classCode: 'economy', filters: {}, sort: 'cheapest' };
interface Word { expected: string; visual: string; hiddenVisual: boolean; width: number; height: number; opacity: number; place: string }
interface Frame { time: number; words: Word[]; oldSafe: boolean; slots: number }
type Trace = { done: boolean; frames: Frame[] };
type ProbeWindow = Window & { wordScrambleTrace: Trace };
function save(name: string, value: unknown) { mkdirSync(evidence, { recursive: true }); writeFileSync(resolve(evidence, name + '.json'), JSON.stringify(value, null, 2) + '\n'); }

async function arm(button: Locator, duration = 1050) {
 await button.evaluate((node, duration) => {
  const trace: Trace = { done: false, frames: [] }; (window as unknown as ProbeWindow).wordScrambleTrace = trace;
  node.addEventListener('pointerdown', () => {
   const start = performance.now();
   const sample = () => {
    const classes = document.querySelector('[data-search-controls]')?.children[2];
    trace.frames.push({ time: performance.now() - start,
     words: Array.from(document.querySelectorAll<HTMLElement>('[data-text-effect="scramble"]')).filter(root => !root.closest('[data-segment-slot="outgoing"]')).map(root => {
      const current = root.querySelector<HTMLElement>('[data-motion-text-visual="current"]')!, slot = root.closest<HTMLElement>('[data-segment-slot]'), box = root.getBoundingClientRect();
      return { expected: root.querySelector('[data-motion-text-accessible]')?.textContent ?? '', visual: current.textContent ?? '', hiddenVisual: current.getAttribute('aria-hidden') === 'true',
       width: box.width, height: box.height, opacity: Number(getComputedStyle(current).opacity) * Number(slot ? getComputedStyle(slot).opacity : 1), place: root.closest('h2') ? 'heading' : 'class' };
     }),
     oldSafe: Array.from(classes?.querySelectorAll<HTMLElement>('[data-segment-slot="outgoing"]') ?? []).every(slot => slot.inert && slot.getAttribute('aria-hidden') === 'true' && !slot.querySelector('input:not(:disabled)')),
     slots: classes?.querySelectorAll('[data-segment-slot]').length ?? 0,
    });
    if (performance.now() - start < duration) requestAnimationFrame(sample); else trace.done = true;
   }; sample();
  }, { once: true, capture: true });
 }, duration);
}
async function finish(page: Page) {
 await expect.poll(() => page.evaluate(() => (window as unknown as ProbeWindow).wordScrambleTrace.done), { timeout: 5000 }).toBe(true);
 return page.evaluate(() => (window as unknown as ProbeWindow).wordScrambleTrace.frames);
}

for (const width of [1366, 390]) test(`@word-scramble ${width}px selective decoding preserves current names, geometry and policy`, async ({ page, context, browser }) => {
 test.setTimeout(60000); mkdirSync(evidence, { recursive: true });
 expect(await context.cookies()).toEqual([]);
 expect((await context.request.post('/api/v1/demo/session', { data: { seed: 5900 + width, anchorInstant: '2026-10-29T06:00:00Z' } })).status()).toBe(201);
 await page.setViewportSize({ width, height: width < 600 ? 844 : 768 }); await page.emulateMedia({ reducedMotion: 'no-preference' });
 const errors: string[] = [], posts: string[] = []; page.on('pageerror', error => errors.push(error.message));
 page.on('request', request => { if (request.method() === 'POST') posts.push(new URL(request.url()).pathname); });
 await page.goto('/?q=' + encodeURIComponent(JSON.stringify(query))); await page.bringToFront(); await page.evaluate(() => document.fonts.ready);
 const modes = page.getByRole('radiogroup', { name: 'وسیله سفر', exact: true }), classes = page.getByRole('radiogroup', { name: 'کلاس سفر', exact: true });
 await expect(classes.getByRole('radio', { name: 'اقتصادی', exact: true })).toBeChecked();
 const input = page.getByRole('combobox', { name: 'مبدا', exact: true }), originalInput = await input.elementHandle();
 const train = modes.getByText('قطار', { exact: true }); await arm(train); await train.click();
 await expect(classes.getByRole('radio', { name: 'صندلی (سالنی)', exact: true })).toBeChecked();
 await expect(classes.getByRole('radio')).toHaveCount(3);
 const classFrames = await finish(page), names = ['کوپه چهار تخته', 'صندلی (سالنی)', 'کوپه شش تخته'];
 const scrambledFrames = classFrames.filter(frame => frame.words.some(word => word.place === 'class' && names.includes(word.expected) && word.visual !== word.expected && word.opacity > .1)).length;
 const geometry = names.map(name => {
  const words = classFrames.flatMap(frame => frame.words.filter(word => word.expected === name));
  return { name, frames: words.length, widthSpread: Math.max(...words.map(word => word.width)) - Math.min(...words.map(word => word.width)), heightSpread: Math.max(...words.map(word => word.height)) - Math.min(...words.map(word => word.height)) };
 });
 save(`class-${width}`, { browser: browser.version(), classFrames, scrambledFrames, geometry });
 expect(scrambledFrames).toBeGreaterThan(2);
 expect(classFrames.every(frame => frame.oldSafe && frame.slots <= 5 && frame.words.every(word => !!word.expected && word.hiddenVisual))).toBe(true);
 for (const word of geometry) { expect(word.frames).toBeGreaterThan(2); expect(word.widthSpread).toBeLessThan(1); expect(word.heightSpread).toBeLessThan(1); }
 for (const word of classFrames.at(-1)!.words) expect(word.visual).toBe(word.expected);
 const finalGeometry = await page.locator('[data-search-controls]').evaluate(row => {
  const tops = Array.from(row.children).map(field => (field.querySelector('[data-segment-track]') ?? field.querySelector('[role="combobox"]')!.parentElement!).getBoundingClientRect().top);
  return { topSpread: Math.max(...tops) - Math.min(...tops), pageWidth: document.documentElement.scrollWidth, viewport: innerWidth };
 }); expect(finalGeometry.topSpread).toBeLessThan(1); expect(finalGeometry.pageWidth).toBeLessThanOrEqual(width);
 for (const label of ['اتوبوس', 'پرواز', 'قطار', 'اتوبوس']) await modes.getByText(label, { exact: true }).click({ force: true });
 await expect(classes.getByRole('radio', { name: 'معمولی', exact: true })).toBeChecked();
 await expect.poll(() => classes.locator('[data-text-effect="scramble"]').evaluateAll(nodes => nodes.every(node => node.querySelector('[data-motion-text-visual="current"]')?.textContent === node.querySelector('[data-motion-text-accessible]')?.textContent))).toBe(true);
 expect(await input.evaluate((node, original) => node === original, originalInput)).toBe(true);
 await page.emulateMedia({ reducedMotion: 'reduce' }); await modes.getByText('پرواز', { exact: true }).click();
 await expect(classes.getByRole('radio', { name: 'اقتصادی', exact: true })).toBeChecked();
 expect(await classes.locator('[data-text-effect="scramble"]').evaluateAll(nodes => nodes.every(node => node.getAttribute('data-text-motion') === 'static' && node.querySelector('[data-motion-text-visual="current"]')?.textContent === node.querySelector('[data-motion-text-accessible]')?.textContent))).toBe(true);
 await page.emulateMedia({ reducedMotion: 'no-preference' });
 expect(await classes.locator('[data-motion-text-visual="outgoing"]').count()).toBe(0);
 if (width === 1366) {
  const search = page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true }); await arm(search, 2200); await search.click();
  const region = page.getByRole('region', { name: 'نتایج مقایسه سفر', exact: true });
  await expect(region.getByRole('heading', { name: /مقایسه پروازها/ })).toBeVisible();
  const headingFrames = await finish(page), decodingFrames = headingFrames.filter(frame => frame.words.some(word => word.place === 'heading' && word.expected === 'مقایسه پروازها' && word.visual !== word.expected && word.opacity > .1)).length;
  const words = headingFrames.flatMap(frame => frame.words.filter(word => word.place === 'heading'));
  const geometry = { widthSpread: Math.max(...words.map(word => word.width)) - Math.min(...words.map(word => word.width)), heightSpread: Math.max(...words.map(word => word.height)) - Math.min(...words.map(word => word.height)) };
  save('heading', { browser: browser.version(), headingFrames, decodingFrames, geometry }); expect(decodingFrames).toBeGreaterThan(2);
  expect(words.every(word => word.expected === 'مقایسه پروازها' && word.hiddenVisual)).toBe(true);
  expect(words.at(-1)!.visual).toBe('مقایسه پروازها'); expect(geometry.widthSpread).toBeLessThan(1); expect(geometry.heightSpread).toBeLessThan(1);
  await expect(region).toHaveAttribute('data-status', 'complete', { timeout: 30000 });
  await expect(region.locator('article[data-price-card-id]')).toHaveCount(48); expect(await region.locator('article[data-price-card-id] [data-text-effect="scramble"]').count()).toBe(0);
 }
 expect(errors).toEqual([]); expect(posts.filter(path => path === '/api/v1/searches')).toHaveLength(width === 1366 ? 1 : 0);
 save(`class-${width}`, { browser: browser.version(), classFrames, scrambledFrames, geometry, finalGeometry, inputRetained: true, latestChoiceWins: true, reducedSettled: true, posts, errors,
  cleanup: 'Fresh empty-cookie isolated session. No reset/deletion; context closes and normal server expiry applies.' });
 await page.screenshot({ path: resolve(evidence, `settled-${width}.png`) });
});
