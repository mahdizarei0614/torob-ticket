import type { Page } from '@playwright/test';
import { test, expect, loadQuery, priceCards, queryFor, resultRegion, runSearch } from '../fixtures';
import { graphicsReady, installNativeAudit, nativeAudit, save, waitForPaint } from './t32-graphics-audit';

const palettes = (['flight', 'train', 'bus'] as const).flatMap(mode => (['light', 'dark'] as const).map(appearance => ({ mode, appearance })));
const views = [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }];

async function imageFacts(page: Page) {
  return page.evaluate(() => ({ scroll: { x: scrollX, y: scrollY }, viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio }, fontStatus: document.fonts.status,
    documentWidth: document.documentElement.scrollWidth, language: document.documentElement.lang,
    imageCount: document.images.length, brokenImages: Array.from(document.images).filter(image => !image.naturalWidth).map(image => new URL(image.src).pathname),
    selected: document.querySelector('[data-price-card-id][data-selected="true"]')?.getAttribute('data-amount-rial') ?? null,
    mapPresent: !!document.querySelector('[data-camera-intent]'),
    totalPriceCards: document.querySelectorAll('article[data-price-card-id][data-amount-rial]').length,
    visiblePriceCards: Array.from(document.querySelectorAll('article[data-price-card-id][data-amount-rial]')).filter(card => { const box = card.getBoundingClientRect(); return box.width > 0 && Math.min(innerHeight, box.bottom) - Math.max(0, box.top) >= box.height * .65; }).map(card => ({ id: card.getAttribute('data-price-card-id'), amountRial: card.getAttribute('data-amount-rial'), top: card.getBoundingClientRect().top, height: card.getBoundingClientRect().height })),
    routeItinerary: document.querySelector('[data-map-itinerary]')?.getAttribute('data-map-itinerary') ?? null,
    scripts: performance.getEntriesByType('resource').filter(entry => new URL(entry.name).pathname.endsWith('.js')).map(entry => { const resource = entry as PerformanceResourceTiming; return { path: new URL(entry.name).pathname, startTime: entry.startTime, responseEnd: resource.responseEnd, transferSize: resource.transferSize, encodedBodySize: resource.encodedBodySize, decodedBodySize: resource.decodedBodySize, initiatorType: resource.initiatorType }; }),
  }));
}

test('@visual six palettes preserve 24 controlled desktop/mobile search/results baselines', async ({ newReviewer, browser }, info) => {
  test.setTimeout(360_000);
  const receipts: unknown[] = [];
  try {
    for (const palette of palettes) for (const viewport of views) {
      const reviewer = await newReviewer({ seed: 3232, anchorInstant: '2026-10-29T06:00:00Z', scenario: 'normal', reducedMotion: 'reduce', viewport });
      const { page } = reviewer; await installNativeAudit(page);
      await page.addInitScript(appearance => localStorage.setItem('torobticket.appearance', appearance), palette.appearance);
      const query = queryFor(palette.mode);
      await loadQuery(reviewer, query); await graphicsReady(page);
      await expect(page.locator('html')).toHaveAttribute('data-mode', palette.mode); await expect(page.locator('html')).toHaveAttribute('data-appearance', palette.appearance);
      await expect(priceCards(page)).toHaveCount(0);
      let quoteObservedAt: string | null = null;
      for (const state of ['search', 'results'] as const) {
        if (state === 'results') {
          const completed = await runSearch(reviewer); expect(completed.snapshot.status).toBe('complete');
          quoteObservedAt = completed.snapshot.observedAt;
          // The first sparse batch may precede the full document scroll range.
          // Align the real completed results heading, without centering the long list.
          await expect(priceCards(page).first()).toBeVisible();
          await resultRegion(page).getByRole('heading').first().evaluate(heading => heading.scrollIntoView({ block: 'start', behavior: 'instant' }));
          await expect(resultRegion(page).getByRole('heading').first()).toBeVisible();
          if (viewport.name === 'desktop') await expect(page.locator('[data-route-presentation]')).toHaveAttribute('data-route-reveal', '1.000');
        }
        await page.mouse.move(0, 0); await waitForPaint(page);
        const name = `${palette.mode}-${palette.appearance}-${viewport.name}-${state}.png`;
        const facts = await imageFacts(page);
        save(info, name.replace('.png', '-facts'), { facts, palette, viewport, state, seed: reviewer.session.seed, fixtureAnchorInstant: reviewer.session.anchorInstant, quoteObservedAt, graphics: await nativeAudit(page) });
        await page.screenshot({ path: info.outputPath(name), animations: 'disabled' });
        expect(facts.documentWidth).toBeLessThanOrEqual(viewport.width);
        expect(facts.fontStatus).toBe('loaded'); expect(facts.brokenImages).toEqual([]);
        if (state === 'results') { expect(facts.visiblePriceCards.length).toBeGreaterThanOrEqual(viewport.name === 'desktop' ? 3 : 2); expect(facts.visiblePriceCards.every(card => Number(card.amountRial) > 0)).toBe(true); if (viewport.name === 'desktop') expect(facts.routeItinerary).toBeTruthy(); }
        expect((await nativeAudit(page)).canvas.app).toBe(1);
        // Keep the real app-owned GPU map and all text. The selected tolerances
        // permit small edge/antialias differences, not missing or shifted panels.
        await expect(page).toHaveScreenshot(name, { animations: 'disabled', caret: 'hide', threshold: .08, maxDiffPixelRatio: .003 });
        let mapComparison: unknown = null;
        if (viewport.name === 'desktop') {
          const bounds = await page.getByRole('complementary', { name: 'نقشه سفر', exact: true }).boundingBox(); expect(bounds).not.toBeNull();
          const clip = { x: Math.max(0, bounds!.x), y: Math.max(0, bounds!.y), width: Math.min(bounds!.width, viewport.width - Math.max(0, bounds!.x)), height: Math.min(bounds!.height, viewport.height - Math.max(0, bounds!.y)) };
          const mapName = name.replace('.png', '-map-detail.png');
          await page.screenshot({ path: info.outputPath(mapName), clip, animations: 'disabled' });
          await expect(page).toHaveScreenshot(mapName, { clip, animations: 'disabled', caret: 'hide', threshold: .05, maxDiffPixels: 96 });
          mapComparison = { name: mapName, clip, threshold: .05, maxDiffPixels: 96, masks: [] };
        }
        receipts.push({ name, browser: browser.version(), seed: reviewer.session.seed, anchorInstant: reviewer.session.anchorInstant, fixtureVersion: reviewer.session.fixtureVersion,
          palette, viewport, query, state, fixtureAnchorInstant: reviewer.session.anchorInstant, quoteObservedAt, reducedMotion: 'reduce', facts, graphics: await nativeAudit(page), comparison: { threshold: .08, maxDiffPixelRatio: .003, masks: [] }, mapComparison });
      }
      // Keep only one document/GPU owner active; fixture retains the cookie jar
      // until its safe, owned namespace reset during teardown.
      await page.close();
    }
    expect(receipts).toHaveLength(24);
  } finally { save(info, 'visual-matrix', { receipts, limits: 'Controlled headless-browser CSS viewports and GPU driver, not physical devices. Actual owned WebGL is retained. These reduced-motion baseline captures do not establish normal-motion performance. Baseline creation and subsequent comparison runs must be recorded separately.' }); }
});

test('@visual arrival hotel desktop/mobile and English admin references retain real map and complete facts', async ({ newReviewer, browser }, info) => {
  test.setTimeout(120_000); const receipts: unknown[] = [];
  try {
    for (const viewport of views) {
      const reviewer = await newReviewer({ seed: 3233, viewport, reducedMotion: 'reduce' }); const { page } = reviewer;
      await installNativeAudit(page); await loadQuery(reviewer, queryFor()); const completed = await runSearch(reviewer);
      await page.getByRole('button', { name: 'مقایسه اقامتگاه‌های مشهد', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'هتل‌های مشهد', exact: true }); await expect(dialog).toBeVisible();
      await expect(dialog.locator('article[data-hotel-status="priced"]').first()).toBeVisible();
      const map = dialog.locator('[data-hotel-map]');
      await expect(map).toHaveAttribute('data-free-map-status', /ready|unavailable/, { timeout: 30_000 }); await waitForPaint(page);
      const mapStatus = await map.getAttribute('data-free-map-status');
      const name = `hotel-${viewport.name}-reference.png`; await page.screenshot({ path: info.outputPath(name), animations: 'disabled' });
      receipts.push({ name, browser: browser.version(), seed: reviewer.session.seed, fixtureAnchorInstant: reviewer.session.anchorInstant, transportObservedAt: completed.snapshot.observedAt, viewport, mapStatus, graphics: await nativeAudit(page), facts: await imageFacts(page), hotelCards: await dialog.locator('article[data-hotel-id]').count(), comparison: 'Real external tile/photo reference captured without pixel gating or replacement. Semantic/card/geometry assertions remain enforced.' });
      await dialog.getByRole('button', { name: 'بستن', exact: true }).click();
      if (viewport.name === 'desktop') {
        await page.goto('/admin/searches/' + completed.snapshot.searchId);
        await expect(page.getByRole('heading', { name: 'Search inspection', exact: true })).toBeVisible(); await expect(page.locator('html')).toHaveAttribute('lang', 'en');
        await expect(page.getByRole('heading', { name: 'Processing evidence', exact: true })).toBeVisible();
        const mapping = page.getByText('Mapping revision', { exact: true }).locator('..').locator('dd');
        await expect(mapping).toHaveText(reviewer.session.mappingRevision);
        await expect(page.getByText('Ranked groups', { exact: true }).locator('..').locator('dd')).toHaveText(String(completed.snapshot.groups.length));
        await expect(page.getByText('Loading recorded activity…', { exact: true })).toHaveCount(0); await waitForPaint(page);
        await page.screenshot({ path: info.outputPath('admin-search-reference.png'), animations: 'disabled' });
        receipts.push({ name: 'admin-search-reference.png', browser: browser.version(), viewport, seed: reviewer.session.seed, fixtureAnchorInstant: reviewer.session.anchorInstant, transportObservedAt: completed.snapshot.observedAt, capturedWallClockISO: await page.evaluate(() => new Date().toISOString()), searchId: completed.snapshot.searchId, mappingRevision: await mapping.innerText(), rankedGroups: completed.snapshot.groups.length, processingEvidenceReady: true, comparison: 'English inspector source row IDs are session-specific; reference is reviewed separately from the deterministic consumer matrix.' });
      }
    }
    expect(receipts).toHaveLength(3);
  } finally { save(info, 'visual-reference-screens', { receipts, limits: 'External hotel map/raster/photos are actual network content and are not deterministic image baselines. Admin IDs/time-derived inspector facts require explicit reference review. No fabricated paint or hidden app map.' }); }
});
