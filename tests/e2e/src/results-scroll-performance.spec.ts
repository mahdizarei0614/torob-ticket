import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { SearchRecovery, TransportSearchQuery } from '@torob-ticket/contracts';

const evidence = resolve(process.env.SCROLL_PERFORMANCE_EVIDENCE_DIR ?? 'docs/evidence/adjustments/results-scroll-performance/native/behavior');
const query: TransportSearchQuery = { mode: 'flight', scope: 'domestic', tripType: 'one-way', originCityId: 'tehran', destinationCityId: 'mashhad', departureDate: '2026-11-02', party: { adults: 1, children: 0, infants: 0 }, classCode: 'economy', filters: {}, sort: 'cheapest' };

for (const width of [1366, 390]) test(`@results-scroll ${width}px defers native rendering and preserves exact offscreen choice, details, keyboard and sorting`, async ({ context, page, browser }) => {
 test.setTimeout(90000);
 mkdirSync(evidence, { recursive: true });
 // This test never adopts reviewer credentials or resets/deletes any session.
 expect((await context.cookies()).length).toBe(0);
 const created = await context.request.post('/api/v1/demo/session', { data: { seed: 4529, anchorInstant: '2026-10-29T06:00:00Z' } });
 expect(created.status()).toBe(201);
 await page.setViewportSize({ width, height: width === 390 ? 844 : 768 });
 const errors: string[] = [], posts: string[] = [];
 page.on('pageerror', error => errors.push(error.message));
 page.on('request', request => { if (request.method() === 'POST') posts.push(new URL(request.url()).pathname); });
 await page.goto('/?q=' + encodeURIComponent(JSON.stringify(query)));
 const received = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/api/v1/searches'));
 await page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true }).click();
 const initial = await (await received).json() as SearchRecovery;
 const region = page.getByRole('region', { name: 'نتایج مقایسه سفر', exact: true });
 await expect(region).toHaveAttribute('data-status', 'complete', { timeout: 30000 });
 const cards = region.locator('article[data-price-card-id]');
 await expect(cards).toHaveCount(48);
 await expect(region.locator('article[data-selected="true"]')).toHaveCount(1);
 const snapshot = await (await page.request.get('/api/v1/searches/' + initial.snapshot.searchId)).json() as SearchRecovery;
 expect(snapshot.snapshot.groups).toHaveLength(12);
 expect(snapshot.snapshot.groups.flatMap(group => group.eligibleQuotes)).toHaveLength(48);
 const list = region.getByRole('list', { name: 'مسیرها و پیشنهادهای مقایسه‌شده' });
 await expect(list).toHaveAttribute('data-result-rendering', 'deferred');
 await list.evaluate(node => window.scrollTo({ top: node.getBoundingClientRect().top + scrollY - 16, behavior: 'instant' }));
 const rendering = await list.evaluate(async node => {
  await new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done())));
  const rows = Array.from(node.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
  // The row's own placeholder box remains laid out; check its skipped contents.
  return { supported: CSS.supports('content-visibility', 'auto'), total: rows.length, deferredStyles: rows.filter(row => getComputedStyle(row).contentVisibility === 'auto').length, skipped: rows.filter(row => { const content = row.querySelector('article'); return content && !content.checkVisibility({ contentVisibilityAuto: true }); }).length };
 });
 expect(rendering.total).toBe(48);
 if (rendering.supported) { expect(rendering.deferredStyles).toBe(48); expect(rendering.skipped).toBeGreaterThan(24); }
 const ids = await cards.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-price-card-id')!));
 const last = cards.last();
 const chosenId = await last.getAttribute('data-price-card-id');
 const chosenQuote = await last.getAttribute('data-quote-id');
 const chosenAmount = await last.getAttribute('data-amount-rial');
 const selection = last.locator('[data-card-select]');
 await selection.focus(); await page.keyboard.press('Enter');
 const chosen = cards.filter({ has: page.locator(`[data-card-select][aria-pressed="true"]`) });
 await expect(chosen).toHaveAttribute('data-quote-id', chosenQuote!);
 await expect(chosen).toHaveAttribute('data-amount-rial', chosenAmount!);
 const details = chosen.getByRole('button', { name: 'جزئیات سفر', exact: true });
 await details.focus(); await details.click();
 await expect(details).toHaveAttribute('aria-expanded', 'true');
 await expect(chosen.getByRole('region', { name: 'جزئیات مسیر رفت', exact: true })).toBeVisible();
 const detailsId = await details.getAttribute('aria-controls');
 await list.evaluate(node => window.scrollTo({ top: node.getBoundingClientRect().top + scrollY - 16, behavior: 'instant' }));
 await expect(cards).toHaveCount(48);
 await expect(chosen).toHaveAttribute('data-price-card-id', chosenId!);
 await expect(details).toHaveAttribute('aria-expanded', 'true');
 await expect(details).toHaveAttribute('aria-controls', detailsId!);
 await expect(details).toBeFocused();
 const searchPosts = posts.filter(path => path === '/api/v1/searches').length;
 await region.getByRole('radio', { name: 'سریع‌ترین', exact: true }).focus();
 await page.keyboard.press('Space');
 await expect(region.getByRole('radio', { name: 'سریع‌ترین', exact: true })).toBeChecked();
 expect(posts.filter(path => path === '/api/v1/searches')).toHaveLength(searchPosts);
 expect(await cards.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-price-card-id')!)).then(value => value.sort())).toEqual([...ids].sort());
 await expect(chosen).toHaveAttribute('data-price-card-id', chosenId!);
 await details.focus();
 await expect(details).toBeFocused();
 await expect(chosen).toBeInViewport();
 await expect(details).toHaveAttribute('aria-expanded', 'true');
 expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 expect(posts.filter(path => /\/referrals\//.test(path))).toEqual([]);
 expect(errors).toEqual([]);
 await page.screenshot({ path: resolve(evidence, `retained-${width}.png`) });
 writeFileSync(resolve(evidence, `retained-${width}.json`), JSON.stringify({ browser: browser.version(), width, rendering, fullCardCount: 48, chosenId, chosenQuote, chosenAmount, retainedDetailsId: detailsId, searchPosts, sortingDidNotSearch: true, pageErrors: errors, cleanup: 'Fresh isolated context only; no reset or deletion. Playwright closes its context; evidence uses normal server expiry.' }, null, 2) + '\n');
});

test('@results-scroll pointer-synchronized first middle last disclosure height and scroll stability', async ({ context, page, browser }) => {
 test.setTimeout(90000);
 mkdirSync(evidence, { recursive: true });
 expect((await context.cookies()).length).toBe(0);
 const created = await context.request.post('/api/v1/demo/session', { data: { seed: 4529, anchorInstant: '2026-10-29T06:00:00Z' } });
 expect(created.status()).toBe(201);
 await page.setViewportSize({ width: 1366, height: 768 });
 await page.emulateMedia({ reducedMotion: 'no-preference' });
 await page.goto('/?q=' + encodeURIComponent(JSON.stringify(query)));
 await page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true }).click();
 const region = page.getByRole('region', { name: 'نتایج مقایسه سفر', exact: true });
 await expect(region).toHaveAttribute('data-status', 'complete', { timeout: 30000 });
 const cards = region.locator('article[data-price-card-id]');
 await expect(cards).toHaveCount(48);
 await expect(region.locator('article[data-selected="true"]')).toHaveCount(1);
 await page.bringToFront();
 await page.evaluate(async () => { await document.fonts.ready; });
 const environment = await page.evaluate(() => ({ reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, visibility: document.visibilityState }));
 expect(environment).toEqual({ reduced: false, visibility: 'visible' });
 type Frame = { time: number; top: number; cardTop: number; height: number; scroll: number; policy: string | null; expanded: string | null };
 const runs: { index: number; open: boolean; frames: Frame[]; intermediate: number; spread: { top: number; cardTop: number; scroll: number } }[] = [];
 try {
  for (const index of [0, 24, 47]) {
   const card = cards.nth(index), button = card.getByRole('button', { name: 'جزئیات سفر', exact: true });
   await button.scrollIntoViewIfNeeded(); await button.focus();
   for (const open of [true, false]) {
    await button.evaluate(node => {
     const button = node as HTMLButtonElement, card = button.closest<HTMLElement>('article[data-price-card-id]')!;
     const state = { started: false, done: false, frames: [] as { time: number; top: number; cardTop: number; height: number; scroll: number; policy: string | null; expanded: string | null }[] };
     Object.assign(window, { pointerDisclosureTrace: state });
     // Begin in the native pointerdown dispatch, before pointerup/onPress; a
     // driver actionability wait cannot consume the finite animation window.
     button.addEventListener('pointerdown', () => {
      state.started = true;
      const start = performance.now();
      const sample = () => {
       const details = document.getElementById(button.getAttribute('aria-controls')!), wrapper = details?.parentElement;
       state.frames.push({ time: performance.now() - start, top: button.getBoundingClientRect().top, cardTop: card.getBoundingClientRect().top, height: wrapper?.getBoundingClientRect().height ?? 0, scroll: scrollY, policy: wrapper?.getAttribute('data-result-motion') ?? null, expanded: button.getAttribute('aria-expanded') });
       if (performance.now() - start < 900) requestAnimationFrame(sample); else state.done = true;
      };
      sample();
     }, { once: true, capture: true });
    });
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', String(open));
    await expect.poll(() => page.evaluate(() => (window as unknown as { pointerDisclosureTrace: { done: boolean } }).pointerDisclosureTrace.done)).toBe(true);
    const frames = await page.evaluate(() => (window as unknown as { pointerDisclosureTrace: { frames: Frame[] } }).pointerDisclosureTrace.frames);
    const spread = { top: Math.max(...frames.map(frame => frame.top)) - Math.min(...frames.map(frame => frame.top)), cardTop: Math.max(...frames.map(frame => frame.cardTop)) - Math.min(...frames.map(frame => frame.cardTop)), scroll: Math.max(...frames.map(frame => frame.scroll)) - Math.min(...frames.map(frame => frame.scroll)) };
    const maxHeight = Math.max(...frames.map(frame => frame.height));
    const intermediate = frames.filter(frame => frame.height > 1 && frame.height < maxHeight - 1).length;
    runs.push({ index, open, frames, intermediate, spread });
    // Persist partial receipts before assertions, including any genuine failure.
    writeFileSync(resolve(evidence, 'pointer-disclosures.json'), JSON.stringify({ browser: browser.version(), environment, runs, method: '900ms rAF trace starts at actual pointerdown, before React Aria onPress; no scripted click or timer stand-in; fresh isolated session, no reset/deletion.' }, null, 2) + '\n');
    expect(spread.top).toBeLessThan(2); expect(spread.cardTop).toBeLessThan(2); expect(spread.scroll).toBeLessThan(2);
    expect(maxHeight).toBeGreaterThan(30); expect(intermediate).toBeGreaterThan(0);
    expect(frames.some(frame => frame.policy === 'finite')).toBe(true);
    expect(frames.at(-1)!.height).toBe(open ? maxHeight : 0);
    await expect(button).toBeFocused();
   }
  }
 } finally {
  await page.screenshot({ path: resolve(evidence, 'pointer-disclosures.png') });
 }
});
