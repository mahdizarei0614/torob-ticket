import { type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SearchRecoverySchema, type TransportSearchQuery } from '@torob-ticket/contracts';
import { expect, test, loadQuery, priceCards, queryFor, readSearch, resetReviewer, resultRegion, runSearch } from '../fixtures';
import { assertCardEvidence, expectedCards } from './acceptance/matrix-assertions';

const evidence = process.env.T17_EVIDENCE_DIR;
function record(name: string, value: unknown) { if (evidence) { mkdirSync(evidence, { recursive: true }); writeFileSync(resolve(evidence, name), JSON.stringify(value, null, 2)); } }
const region = resultRegion, cards = priceCards;
async function screenshot(page: Page, name: string) { if (evidence) { await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: resolve(evidence, name + '.png') }); } }

test.describe('@results real comparison product', () => {
  test('normal real stream, exact seller price cards and original quote expiry', async ({ reviewer }) => {
    const { page } = reviewer;
    await page.clock.install();
    const errors: string[] = []; page.on('pageerror', () => errors.push('uncaught-page-error'));
    await loadQuery(reviewer, queryFor());
    const began = Date.now();
    const started = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/v1/searches');
    await page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true }).click();
    const response = await started; expect(response.status()).toBe(201);
    const initial = SearchRecoverySchema.parse(await response.json());
    await expect(cards(page).first()).toBeVisible(); const firstUsefulMs = Date.now() - began;
    await expect(region(page)).toHaveAttribute('data-status', 'complete', { timeout: 30_000 }); const completeMs = Date.now() - began;
    const final = await readSearch(reviewer, initial.snapshot.searchId);
    await assertCardEvidence(page, final, 'cheapest');
    const group = final.snapshot.groups.find(group => group.itinerary.outbound.stops.length === 0 && ['demo-provider-02', 'demo-provider-04'].every(id => group.eligibleQuotes.some(quote => quote.providerId === id)))!;
    expect(group).toBeDefined();
    const selections = [];
    let selectedId = '';
    for (const providerId of ['demo-provider-02', 'demo-provider-04']) {
      const quote = group.eligibleQuotes.find(quote => quote.providerId === providerId)!;
      const card = cards(page).locator(`xpath=self::article[@data-quote-id="${quote.quoteId}"]`);
      await card.locator('[data-card-select]').click();
      await expect(card).toHaveAttribute('data-selected', 'true');
      await expect(card).toHaveAttribute('data-amount-rial', String(quote.total.amountRial));
      await card.getByRole('button', { name: 'جزئیات سفر', exact: true }).click();
      const offer = card.locator(`[data-offer-quote-id="${quote.quoteId}"]`);
      await expect(offer).toContainText(providerId === 'demo-provider-02' ? 'بار تحویلی: نامشخص' : 'بار تحویلی: ۳۰ کیلوگرم');
      if (providerId === 'demo-provider-04') await expect(offer).toContainText('قابل استرداد طبق شرایط فروشنده');
      const endpoint = card.locator('[data-card-route-leg="outbound"] button').first();
      await endpoint.focus(); await expect(page.getByRole('tooltip')).toBeVisible(); await page.keyboard.press('Escape');
      await endpoint.hover(); await expect(page.getByRole('tooltip')).toBeVisible(); await page.mouse.move(1, 1);
      selectedId = quote.quoteId;
      selections.push({ providerId, quoteId: quote.quoteId, total: quote.total, conditions: quote.conditions });
    }
    await screenshot(page, 'normal-provider');
    await page.clock.fastForward(601_000);
    const selected = cards(page).locator(`xpath=self::article[@data-quote-id="${selectedId}"]`);
    await expect(selected.locator('[data-card-select]')).toBeDisabled();
    await expect(selected.locator('[data-invalid-price="expired"]')).toBeVisible();
    await expect(selected).toHaveAttribute('data-quote-id', selectedId);
    expect(errors).toEqual([]);
    record('normal-provider.json', { metadata: reviewer.session, initial, final, selections, firstUsefulMs, completeMs, expiry: 'Unmodified server expiry; client clock advanced 601 seconds only after selecting actual seller cards.', errors });
  });

  test('six mode/scope routes normalize old party links to one adult and retain complete round-trip responsive palettes', async ({ newReviewer }) => {
    test.setTimeout(180_000);
    const checks = [];
    for (const mode of ['flight', 'train', 'bus'] as const) for (const scope of ['domestic', 'international'] as const) {
      const reviewer = await newReviewer(); const { page } = reviewer;
      const query = queryFor(mode, scope, 'round-trip', { party: { adults: 2, children: 1, infants: 1, childAges: [8], infantAgesMonths: [12] } });
      await loadQuery(reviewer, query); const final = await runSearch(reviewer);
      expect(final.snapshot.query.party).toEqual({ adults: 1, children: 0, infants: 0 });
      await assertCardEvidence(page, final, 'cheapest');
      const first = cards(page).first(); await expect(first.getByRole('group', { name: /^مجموع ۱ مسافر:/ })).toBeVisible();
      await first.getByRole('button', { name: 'جزئیات سفر', exact: true }).click();
      await expect(first.getByRole('region', { name: 'جزئیات مسیر رفت' })).toBeVisible();
      await expect(first.getByRole('region', { name: 'جزئیات مسیر برگشت' })).toBeVisible();
      const palettes = [];
      for (const appearance of ['light', 'dark']) {
        const button = page.getByRole('button', { name: appearance === 'light' ? 'نمای روشن' : 'نمای تیره', exact: true });
        if (await button.count()) await button.click();
        await expect(page.locator('html')).toHaveAttribute('data-appearance', appearance);
        for (const width of [390, 768, 1440]) {
          await page.setViewportSize({ width, height: 1000 }); await first.scrollIntoViewIfNeeded();
          const dimensions = await page.evaluate(() => ({ viewport: innerWidth, scroll: document.documentElement.scrollWidth }));
          expect(dimensions.scroll).toBeLessThanOrEqual(width); palettes.push({ appearance, width, ...dimensions });
          if (width === 390 || width === 1440) await screenshot(page, mode + '-' + scope + '-' + appearance + '-' + width);
        }
      }
      checks.push({ incomingQuery: query, currentQuery: final.snapshot.query, searchId: final.snapshot.searchId, palettes });
    }
    record('six-modes-responsive.json', { checks, replacement: 'Consumer searches normalize to one adult; varied-party coverage runs through the actual API in acceptance/party-and-eligibility.spec.ts.' });
  });

  test('slow cheaper refundable provider stages after an early manual choice, adopts explicitly and preserves scroll anchor', async ({ newReviewer }) => {
    const reviewer = await newReviewer({ scenario: 'slow-provider' }); const { page } = reviewer;
    await loadQuery(reviewer, queryFor('flight', 'domestic', 'one-way', { filters: { refundableOnly: true } }));
    const started = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/v1/searches');
    await page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true }).click();
    const initial = SearchRecoverySchema.parse(await (await started).json());
    // Retiring Motion rows are inert/aria-hidden and cannot be native targets.
    const currentCards = region(page).getByRole('article'), first = currentCards.first();
    await expect(first).toBeVisible(); const choice = first.getByRole('button', { name: 'انتخاب پیشنهاد', exact: true });
    await choice.focus(); await expect(choice).toBeFocused(); await expect(region(page)).toHaveAttribute('data-frozen', 'true');
    await expect(region(page)).toHaveAttribute('data-status', 'collecting');
    const atFocus = await readSearch(reviewer, initial.snapshot.searchId); expect(atFocus.snapshot.status).toBe('collecting');
    expect(atFocus.snapshot.coverage.pendingProviderIds).toContain('demo-provider-04');
    const focused = await first.evaluate(node => ({ cardId: node.getAttribute('data-price-card-id'), quoteId: node.getAttribute('data-quote-id'), amountRial: Number(node.getAttribute('data-amount-rial')), presence: node.closest('[data-result-presence]')?.getAttribute('data-result-presence'), sequence: node.closest('[data-sequence]')?.getAttribute('data-sequence') }));
    expect(focused.presence).toBe('current');
    const earlyQuote = atFocus.snapshot.groups.flatMap(group => group.eligibleQuotes).find(quote => quote.quoteId === focused.quoteId); expect(earlyQuote).toBeDefined(); expect(earlyQuote!.total.amountRial).toBe(focused.amountRial);
    // A manual early choice deliberately keeps authority while the slow seller
    // completes. Without it the current automatic-final-selection policy adopts
    // terminal evidence even after focus; that default is covered separately.
    await choice.press('Space'); await expect(first).toHaveAttribute('data-selected', 'true');
    await expect(region(page)).toHaveAttribute('data-status', 'collecting');
    await expect(first.locator(`[data-seller-link-quote-id="${focused.quoteId}"]`)).toBeFocused();
    const beforeId = focused.cardId!, beforePrice = focused.amountRial, selected = focused.quoteId!;
    await expect(region(page)).toHaveAttribute('data-status', 'complete', { timeout: 30_000 });
    const latest = await readSearch(reviewer, initial.snapshot.searchId), expected = expectedCards(latest, 'cheapest');
    expect(expected[0]!.id).not.toBe(beforeId); expect(expected[0]!.amountRial).toBeLessThan(beforePrice);
    await expect(currentCards.first()).toHaveAttribute('data-price-card-id', beforeId); await expect(first).toHaveAttribute('data-amount-rial', String(beforePrice));
    await expect(first).toHaveAttribute('data-quote-id', selected); await expect(first).toHaveAttribute('data-selected', 'true');
    await expect(region(page).getByRole('button', { name: 'اعمال نتایج تازه', exact: true })).toBeVisible();
    const firstTop = await first.evaluate(node => node.getBoundingClientRect().top);
    await region(page).getByRole('button', { name: 'اعمال نتایج تازه', exact: true }).click();
    const oldCard = currentCards.locator(`xpath=self::article[@data-quote-id="${selected}"]`);
    await expect(currentCards.first()).toHaveAttribute('data-price-card-id', expected[0]!.id);
    await expect(oldCard).toHaveAttribute('data-selected', 'true');
    await expect.poll(async () => Math.abs(await oldCard.evaluate(node => node.getBoundingClientRect().top) - firstTop)).toBeLessThan(5);
    record('slow-staging.json', { metadata: reviewer.session, initial, atFocus, focused, beforeId, beforePrice, latest, selected, firstTop, afterTop: await oldCard.evaluate(node => node.getBoundingClientRect().top), manualChoiceBeforeSlowCompletion: true, retiredRowsExcludedFromNativeTargets: true });
  });

  test('local sorting preserves immutable URL/date evidence; actual filters refine once and a city draft blocks stale selection', async ({ reviewer }) => {
    const { page } = reviewer; let datePosts = 0; const requests: TransportSearchQuery[] = [];
    page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/api/v1/date-prices')) datePosts++; if (request.method() === 'POST' && request.url().endsWith('/api/v1/searches')) requests.push(request.postDataJSON().query); });
    await loadQuery(reviewer, queryFor()); const initial = await runSearch(reviewer);
    const batch = await page.locator('[data-date-price-id]').getAttribute('data-date-price-id'), beforeDatePosts = datePosts, initialUrl = page.url();
    const fast = region(page).getByRole('radio', { name: 'سریع‌ترین', exact: true }); await fast.focus(); await page.keyboard.press('Space');
    await expect(fast).toBeChecked(); await assertCardEvidence(page, initial, 'fastest');
    expect(requests).toHaveLength(1); expect(page.url()).toBe(initialUrl); expect(datePosts).toBe(beforeDatePosts);
    expect(await page.locator('[data-date-price-id]').getAttribute('data-date-price-id')).toBe(batch);
    await region(page).getByRole('button', { name: /^فیلتر نتایج/ }).click();
    const form = page.getByRole('form', { name: 'فیلتر پیشنهادهای سفر', exact: true });
    await form.getByLabel('فقط قابل استرداد؛ شرایط نامشخص پذیرفته نمی‌شود').check();
    const final = await runSearch(reviewer, () => form.getByRole('button', { name: 'اعمال فیلترها', exact: true }).click());
    expect(requests).toHaveLength(2); expect(requests[1]!.filters.refundableOnly).toBe(true); expect(requests[1]!.sort).toBe('fastest');
    expect(final.snapshot.groups.flatMap(group => group.eligibleQuotes).every(quote => quote.conditions.outbound.refundable.status === 'known' && quote.conditions.outbound.refundable.value)).toBe(true);
    const destination = page.getByRole('combobox', { name: 'مقصد', exact: true });
    await destination.fill('شیراز'); await expect(destination).toHaveValue('شیراز');
    await page.keyboard.press('Escape'); await expect(destination).not.toHaveAttribute('aria-expanded', 'true');
    await expect(destination).toHaveValue('شیراز');
    await expect(region(page).getByRole('radio', { name: 'ارزان‌ترین', exact: true })).toBeDisabled();
    await expect(cards(page).first().locator('[data-card-select]')).toBeDisabled();
    await expect(cards(page).first().locator('[data-invalid-price="changed-intent"]')).toBeVisible();
    expect(requests).toHaveLength(2);
    record('sort-filter.json', { metadata: reviewer.session, requests, beforeDatePosts, datePosts, initialUrl, sortPreservedDateBatch: true, final, draftField: 'destination city' });
  });

  test('no eligible and timeout coverage distinguish absence from failed provider retrieval', async ({ newReviewer }) => {
    const reviewer = await newReviewer({ scenario: 'no-eligible-results' }); const { page } = reviewer;
    await loadQuery(reviewer, queryFor()); const empty = await runSearch(reviewer);
    await expect(region(page).locator('[data-results-empty="no-match"]')).toBeVisible(); expect(await cards(page).count()).toBe(0);
    await resetReviewer(reviewer, { scenario: 'provider-timeout' }); await loadQuery(reviewer, queryFor()); const partial = await runSearch(reviewer);
    await expect(region(page)).toHaveAttribute('data-status', 'partial'); expect(partial.snapshot.coverage.failedProviderIds.length).toBeGreaterThan(0);
    expect(await cards(page).count()).toBeGreaterThan(0); await expect(region(page).locator('[data-results-empty="no-match"]')).toHaveCount(0);
    record('coverage-recovery.json', { metadata: reviewer.session, empty, partial, truthfulPartial: true });
  });
});

test.describe('@results final entry and recovery', () => {
  test('normal no-clock timing and collapsed comparison overview at390 and1440', async ({ newReviewer }) => {
    const reviewer = await newReviewer({ reducedMotion: 'no-preference' }); const { page } = reviewer;
    await loadQuery(reviewer, queryFor()); const began = Date.now();
    const started = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/api/v1/searches'));
    await page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true }).click(); const initial = SearchRecoverySchema.parse(await (await started).json());
    await expect(cards(page).first()).toBeVisible(); const firstUsefulMs = Date.now() - began;
    await expect(region(page)).toHaveAttribute('data-status', 'complete', { timeout: 30_000 }); const completeMs = Date.now() - began;
    const widths = [];
    for (const width of [390, 1440]) { await page.setViewportSize({ width, height: 1000 }); await cards(page).first().scrollIntoViewIfNeeded(); await screenshot(page, 'collapsed-' + width); const result = await page.evaluate(() => ({ viewport: innerWidth, scroll: document.documentElement.scrollWidth })); expect(result.scroll).toBeLessThanOrEqual(width); widths.push(result); }
    expect(firstUsefulMs).toBeLessThanOrEqual(1500); expect(completeMs).toBeLessThanOrEqual(3000);
    record('normal-no-clock.json', { metadata: reviewer.session, browser: page.context().browser()?.version(), firstUsefulMs, completeMs, firstUsefulTargetMs: 1500, completeTargetMs: 3000, environment: 'Native browser clock and real API/SSE; no route interception or virtual clock', initial, widths });
  });
  test('real snapshot recovery after injected stream connection failure preserves current comparison data', async ({ reviewer }) => {
    const { page } = reviewer; let failedStreams = 0, recoveries = 0, searches = 0;
    await page.route('**/api/v1/searches/*/events', async route => { failedStreams++; await route.abort('failed'); });
    page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/api/v1/searches')) searches++; if (request.method() === 'GET' && /\/api\/v1\/searches\/[^/]+$/.test(request.url())) recoveries++; });
    await loadQuery(reviewer, queryFor()); const final = await runSearch(reviewer);
    expect(failedStreams).toBeGreaterThan(0); expect(recoveries).toBeGreaterThan(0); expect(searches).toBe(1); expect(await cards(page).count()).toBeGreaterThan(0);
    await assertCardEvidence(page, final, 'cheapest');
    record('stream-recovery.json', { metadata: reviewer.session, failedStreams, recoveries, searches, final, fault: 'Only SSE HTTP connections are aborted. Actual owned snapshot reads and provider inventory remain unchanged.' });
  });
});
