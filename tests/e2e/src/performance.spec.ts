import type { Page } from '@playwright/test';
import { test, expect, dateExplorer, loadQuery, priceCards, queryFor, resultRegion, runSearch } from '../fixtures';
import { cardClickPoint, frameWindow, graphicsReady, inputLatency, installNativeAudit, nativeAudit, observeWindow, quantile, save, waitForPaint } from './t32-graphics-audit';

async function nativeCadence(page: Page, milliseconds = 1000) {
  return page.evaluate(duration => new Promise<{ intervals: number[]; medianMs: number | null; submittedFps: number | null }>(resolve => {
    const intervals: number[] = []; let first = 0, last = 0;
    const tick = (time: number) => { if (!first) first = time; if (last) intervals.push(time - last); last = time;
      if (time - first < duration) requestAnimationFrame(tick);
      else { const sorted = [...intervals].sort((a, b) => a - b), medianMs = sorted[Math.floor(sorted.length / 2)] ?? null; resolve({ intervals, medianMs, submittedFps: medianMs ? 1000 / medianMs : null }); }
    }; requestAnimationFrame(tick);
  }), milliseconds);
}
const addDay = (value: string) => new Date(Date.parse(value + 'T12:00:00Z') + 86400_000).toISOString().slice(0, 10);

test('@performance trusted date chart route selection scrolling hotel and theme feedback stay responsive', async ({ newReviewer, browser }, info) => {
  test.setTimeout(150_000);
  const reference = await newReviewer({ seed: 3239, reducedMotion: 'no-preference', viewport: { width: 1440, height: 900 } });
  const blankCadence = await nativeCadence(reference.page);
  await loadQuery(reference, queryFor()); await graphicsReady(reference.page); const uninstrumentedAppCadence = await nativeCadence(reference.page); await reference.page.close();
  const reviewer = await newReviewer({ seed: 3239, reducedMotion: 'no-preference', viewport: { width: 1440, height: 900 } });
  const { page } = reviewer; await installNativeAudit(page); await loadQuery(reviewer, queryFor()); await graphicsReady(page);
  const latencies: Awaited<ReturnType<typeof inputLatency>>[] = [], scrolls: unknown[] = [], windows: unknown[] = [];
  try {
    windows.push({ name: 'warm-visible-map', ...await observeWindow(page, 2000) });
    let phaseStart = await nativeAudit(page);
    for (let i = 0; i < 4; i++) {
      const wheel = page.getByRole('listbox', { name: 'روزهای نزدیک', exact: true }); await wheel.scrollIntoViewIfNeeded();
      const date = (await wheel.getAttribute('data-preview-date'))!, next = addDay(date);
      const geometry = await wheel.evaluate(node => { const box = node.querySelector('[aria-selected="true"]')!.getBoundingClientRect(); return { x: box.x + box.width / 2, y: box.y + box.height / 2, pitch: box.height }; });
      await page.mouse.move(geometry.x, geometry.y); await page.mouse.down();
      latencies.push(await inputLatency(page, 'date-drag-chart-' + i, wheel, 'pointermove', { selector: '[data-chart-selected]', attribute: 'data-chart-selected', expected: next }, () => page.mouse.move(geometry.x, geometry.y - geometry.pitch)));
      await runSearch(reviewer, () => page.mouse.up()); await expect(dateExplorer(page)).toHaveAttribute('data-selected-outbound', next);
    }
    windows.push({ name: 'actual-date-drag-chart-and-settle-including-provider-waits', ...frameWindow(phaseStart, await nativeAudit(page)) });
    await resultRegion(page).scrollIntoViewIfNeeded(); await waitForPaint(page); expect(await priceCards(page).count()).toBeGreaterThan(24);
    phaseStart = await nativeAudit(page);
    for (let i = 0; i < 4; i++) {
      const previousGroup = (await priceCards(page).filter({ has: page.locator('[data-card-select][aria-pressed="true"]') }).getAttribute('data-group-id'))!;
      const otherGroupSelector = await page.evaluate(group => `article[data-price-card-id][data-quote-id]:not([data-selected="true"]):not([data-group-id="${CSS.escape(group)}"])`, previousGroup);
      const card = resultRegion(page).locator(otherGroupSelector).first();
      await expect(card).not.toHaveAttribute('data-selected', 'true'); await card.scrollIntoViewIfNeeded(); const cardId = (await card.getAttribute('data-price-card-id'))!;
      const cardSelector = await page.evaluate(id => `[data-price-card-id="${CSS.escape(id)}"]`, cardId);
      await expect(page.locator(cardSelector)).toHaveCount(1);
      const select = card.locator('[data-card-select]'), position = await cardClickPoint(select);
      latencies.push(await inputLatency(page, 'route-pin-' + i, select, 'click', { selector: cardSelector, attribute: 'data-selected', expected: 'true' }, () => select.click({ position })));
      const itinerary = await page.locator('main[data-pinned-itinerary]').getAttribute('data-pinned-itinerary'); expect(itinerary).toBeTruthy();
      await expect(page.getByRole('complementary', { name: 'نقشه سفر', exact: true })).toHaveAttribute('data-map-itinerary', itinerary!);
    }
    windows.push({ name: 'actual-ticket-route-selection', ...frameWindow(phaseStart, await nativeAudit(page)) });
    windows.push({ name: 'selected-route-visible', ...await observeWindow(page, 1500) });
    await page.mouse.move(1200, 700);
    phaseStart = await nativeAudit(page);
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => {
        const state = { eventAt: 0, captureAt: 0, observedAt: 0, paintProxyAt: 0, before: scrollY, after: scrollY, trusted: false };
        const wheel = (event: WheelEvent) => { if (!event.isTrusted) return; state.eventAt = event.timeStamp; state.captureAt = performance.now(); state.trusted = true; };
        const scroll = () => { if (!state.eventAt || scrollY === state.before) return; state.after = scrollY; state.observedAt = performance.now(); window.removeEventListener('scroll', scroll); window.removeEventListener('wheel', wheel, true); requestAnimationFrame(() => requestAnimationFrame(() => { state.paintProxyAt = performance.now(); })); };
        window.addEventListener('wheel', wheel, { once: true, capture: true }); window.addEventListener('scroll', scroll, { passive: true }); Object.assign(window, { t32Scroll: state });
      });
      await page.mouse.wheel(0, 340);
      await expect.poll(() => page.evaluate(() => (window as unknown as { t32Scroll: { paintProxyAt: number } }).t32Scroll.paintProxyAt)).toBeGreaterThan(0);
      const sample = await page.evaluate(() => (window as unknown as { t32Scroll: { eventAt: number; captureAt: number; observedAt: number; paintProxyAt: number; before: number; after: number; trusted: boolean } }).t32Scroll);
      expect(sample.after).toBeGreaterThan(sample.before); scrolls.push({ ...sample, eventToPaintProxyMs: sample.paintProxyAt - sample.eventAt });
    }
    windows.push({ name: 'actual-native-list-wheel', ...frameWindow(phaseStart, await nativeAudit(page)) });
    windows.push({ name: 'long-list-after-native-wheel', ...await observeWindow(page, 1000) });
    phaseStart = await nativeAudit(page);
    for (let i = 0; i < 4; i++) {
      const open = page.getByRole('button', { name: 'مقایسه اقامتگاه‌های مشهد', exact: true });
      latencies.push(await inputLatency(page, 'hotel-modal-' + i, open, 'click', { selector: '[role="dialog"]', attribute: 'role', expected: 'dialog', visible: true }, () => open.click()));
      const dialog = page.getByRole('dialog', { name: 'هتل‌های مشهد', exact: true }); await expect(dialog.locator('article[data-hotel-status="priced"]').first()).toBeVisible();
      const card = dialog.locator('article[data-hotel-status="priced"]:not([data-selected="true"])').first(), hotelId = (await card.getAttribute('data-hotel-id'))!;
      await expect(card).not.toHaveAttribute('data-selected', 'true');
      const hotelSelector = await page.evaluate(id => `[data-hotel-id="${CSS.escape(id)}"]`, hotelId);
      await expect(page.locator(hotelSelector)).toHaveCount(1);
      const select = card.locator('[data-hotel-card-select]'), position = await cardClickPoint(select);
      latencies.push(await inputLatency(page, 'hotel-selection-' + i, select, 'click', { selector: hotelSelector, attribute: 'data-selected', expected: 'true' }, () => select.click({ position })));
      await dialog.getByRole('button', { name: 'بستن', exact: true }).click();
    }
    windows.push({ name: 'actual-hotel-modal-and-selection-background-app-is-covered', ...frameWindow(phaseStart, await nativeAudit(page)) });
    phaseStart = await nativeAudit(page);
    for (let i = 0; i < 4; i++) {
      const old = await page.locator('html').getAttribute('data-appearance'), next = old === 'dark' ? 'light' : 'dark';
      const toggle = page.getByRole('button', { name: next === 'light' ? 'نمای روشن' : 'نمای تیره', exact: true });
      latencies.push(await inputLatency(page, 'theme-feedback-' + i, toggle, 'click', { selector: 'html', attribute: 'data-appearance', expected: next }, () => toggle.click()));
      await waitForPaint(page);
    }
    windows.push({ name: 'actual-theme-changes', ...frameWindow(phaseStart, await nativeAudit(page)) });
    const p95 = quantile([...latencies.map(item => item.eventToPaintProxyMs), ...scrolls.map(item => (item as { eventToPaintProxyMs: number }).eventToPaintProxyMs)], .95);
    const families = ['date-drag-chart', 'route-pin', 'hotel-modal', 'hotel-selection', 'theme-feedback'].map(name => { const samples = latencies.filter(item => item.name.startsWith(name)); return { name, count: samples.length, p95Ms: quantile(samples.map(item => item.eventToPaintProxyMs), .95) }; });
    families.push({ name: 'native-list-scroll', count: scrolls.length, p95Ms: quantile(scrolls.map(item => (item as { eventToPaintProxyMs: number }).eventToPaintProxyMs), .95) });
    save(info, 'interaction-family-budgets', families);
    for (const family of families) { expect(family.count).toBe(4); expect(family.p95Ms).not.toBeNull(); expect(family.p95Ms!, family.name).toBeLessThan(200); }
    expect(latencies.every(item => item.trusted)).toBe(true); expect(p95).not.toBeNull(); expect(p95!).toBeLessThan(200);
    save(info, 'interaction-performance', { browser: browser.version(), seed: reviewer.session.seed, clock: reviewer.session.anchorInstant, motion: 'no-preference', blankCadence, uninstrumentedAppCadence, latencies, scrolls, p95InputToPaintProxyMs: p95, windows, finalGraphics: await nativeAudit(page), budgets: { inputToPaintProxyP95Ms: 200, desktopSubmittedFpsTarget: 60, lowCadenceReferenceFps: 30 }, method: 'Trusted event creation timestamp to exact domain/scroll feedback and two-rAF paint opportunity, not physical presentation or INP. Date preview is measured before the deliberate settle. Route drawing (~2s) and theme reveal (~780ms) are approved completion animations, distinct from immediate feedback. Warmup, blank native cadence and uninstrumented app cadence are separate; passive draw wrappers have nonzero cost and callback CPU is not GPU time.' });
    await page.close();
    const world = await newReviewer({ seed: 3248, reducedMotion: 'no-preference', viewport: { width: 1440, height: 900 } }), worldQuery = queryFor('flight', 'international');
    const worldWindows: unknown[] = [];
    try {
      await installNativeAudit(world.page); await loadQuery(world, worldQuery); await graphicsReady(world.page);
      worldWindows.push({ name: 'world-warm-visible-map', ...await observeWindow(world.page, 2000) });
      const result = await runSearch(world); expect(result.snapshot.status).toBe('complete'); await expect(priceCards(world.page).first()).toBeVisible();
      await expect(world.page.locator('[data-route-presentation]')).toHaveAttribute('data-route-reveal', '1.000', { timeout: 20_000 });
      worldWindows.push({ name: 'world-priced-selected-route-visible', ...await observeWindow(world.page, 2500) });
      expect((await nativeAudit(world.page)).shaders).toEqual([]);
      await world.page.screenshot({ path: info.outputPath('world-selected-route-reference.png') });
    } finally { save(info, 'world-graphics-performance', { browser: browser.version(), seed: world.session.seed, clock: world.session.anchorInstant, query: worldQuery, motion: 'no-preference', windows: worldWindows, graphics: await nativeAudit(world.page).catch(() => null), method: 'Separate fresh normal-motion international world map and priced selected route; actual GPU scene retained in reference PNG. These world samples are distinct from Iran and do not establish a new device/performance guarantee.' }); await world.page.close(); }
  } catch (error) { save(info, 'interaction-performance-partial', { latencies, scrolls, windows, blankCadence, uninstrumentedAppCadence, finalGraphics: await nativeAudit(page).catch(() => null) }); throw error; }
});

test('@performance five normal searches provide readable current prices and complete within normal scenario budgets', async ({ newReviewer, browser }, info) => {
  test.setTimeout(90_000); const samples: unknown[] = [];
  try {
    for (let i = 0; i < 5; i++) {
      const reviewer = await newReviewer({ seed: 3240 + i, reducedMotion: 'no-preference', viewport: { width: 1440, height: 900 } }); const { page } = reviewer;
      await loadQuery(reviewer, queryFor()); await graphicsReady(page);
      const search = page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true });
      await search.evaluate(button => {
        const timing = { eventAt: 0, captureAt: 0, firstCommitAt: 0, firstUsefulAt: 0, completeCommitAt: 0, completeVisibleAt: 0, firstAmountRial: '', firstDisplayedToman: '', cards: 0 };
        let stopped = false;
        const readable = (element: Element) => { const box = element.getBoundingClientRect(); if (!box.width || !box.height || box.bottom <= 0 || box.top >= innerHeight) return false; for (let node: Element | null = element; node; node = node.parentElement) { const style = getComputedStyle(node); if (Number(style.opacity) < .5 || style.visibility === 'hidden' || style.display === 'none') return false; } return true; };
        const tick = () => {
          if (stopped) return;
          const region = document.querySelector('[aria-label="نتایج مقایسه سفر"][data-search-id]'), cards = Array.from(region?.querySelectorAll('article[data-quote-id][data-amount-rial]') ?? []);
          const priced = cards.find(card => Number(card.getAttribute('data-amount-rial')) > 0);
          if (priced && !timing.firstCommitAt) timing.firstCommitAt = performance.now();
          const priceNode = (card: Element) => card.querySelector('[role="group"][aria-label^="مجموع"] bdi[data-price-band]');
          const displayed = (card: Element) => Number((priceNode(card)?.textContent ?? '').replace(/[۰-۹]/g, character => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(character))).replace(/[٬,\s\u200e\u200f]/g, '').replace('٫', '.'));
          const useful = cards.find(card => Number(card.getAttribute('data-amount-rial')) > 0 && Math.abs(displayed(card) - Number(card.getAttribute('data-amount-rial')) / 10) < .01 && !!priceNode(card) && readable(priceNode(card)!));
          if (useful && !timing.firstUsefulAt) { timing.firstUsefulAt = performance.now(); timing.firstAmountRial = useful.getAttribute('data-amount-rial')!; timing.firstDisplayedToman = priceNode(useful)!.textContent!; }
          if (region?.getAttribute('data-status') === 'complete' && cards.length) {
            if (!timing.completeCommitAt) timing.completeCommitAt = performance.now();
            if (useful) { timing.cards = cards.length; requestAnimationFrame(() => { timing.completeVisibleAt = performance.now(); stopped = true; }); return; }
          }
          requestAnimationFrame(tick);
        };
        button.addEventListener('click', event => { if (!event.isTrusted) return; timing.eventAt = event.timeStamp; timing.captureAt = performance.now(); requestAnimationFrame(tick); }, { once: true, capture: true });
        Object.assign(window, { t32SearchTiming: { timing, stop: () => { stopped = true; } } });
      });
      try {
        const result = await runSearch(reviewer); expect(result.snapshot.status).toBe('complete');
        await expect.poll(() => page.evaluate(() => (window as unknown as { t32SearchTiming: { timing: { completeVisibleAt: number } } }).t32SearchTiming.timing.completeVisibleAt)).toBeGreaterThan(0);
        const timing = await page.evaluate(() => (window as unknown as { t32SearchTiming: { timing: { eventAt: number; captureAt: number; firstCommitAt: number; firstUsefulAt: number; completeCommitAt: number; completeVisibleAt: number; firstAmountRial: string; firstDisplayedToman: string; cards: number } } }).t32SearchTiming.timing);
        const sample = { seed: reviewer.session.seed, scenario: reviewer.session.scenario, clock: reviewer.session.anchorInstant, ...timing, firstCommitMs: timing.firstCommitAt - timing.eventAt, firstUsefulMs: timing.firstUsefulAt - timing.eventAt, completeCommitMs: timing.completeCommitAt - timing.eventAt, completeVisibleMs: timing.completeVisibleAt - timing.eventAt };
        samples.push(sample); expect(Number(timing.firstAmountRial)).toBeGreaterThan(0); expect(sample.firstUsefulMs).toBeLessThanOrEqual(1500); expect(sample.completeVisibleMs).toBeLessThanOrEqual(3000);
      } finally { await page.evaluate(() => (window as unknown as { t32SearchTiming: { stop: () => void } }).t32SearchTiming.stop()); await page.close(); }
    }
  } finally { save(info, 'normal-result-performance', { browser: browser.version(), samples, method: 'Five independent normal seeded sessions. No native GL instrumentation in these runs. Native trusted click creation timestamp to first real positive current price with viewport intersection and ancestor opacity>=0.5. Completion requires terminal complete and a readable actual price, followed by next-rAF paint opportunity. Separate DOM commit and visible-ready proxies; not physical presentation. Fonts/date inventory/graphics initialized before search.' }); }
});
