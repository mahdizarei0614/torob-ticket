import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RecheckResultSchema, ReferralReceiptSchema, SearchRecoverySchema, type SearchRecovery, type TransportSearchQuery } from '@torob-ticket/contracts';
import { exactReceipt, expectPlaceholder } from './acceptance/journey-helpers';

const evidence = resolve(process.env.COMPACT_RESULTS_EVIDENCE_DIR ?? '.local/evidence/adjustments/compact-results/native');
const query: TransportSearchQuery = { mode: 'flight', scope: 'domestic', tripType: 'one-way', originCityId: 'tehran', destinationCityId: 'mashhad', departureDate: '2026-10-25', party: { adults: 1, children: 0, infants: 0 }, classCode: 'economy', filters: {}, sort: 'cheapest' };
const results = (page: Page) => page.getByRole('region', { name: 'نتایج مقایسه سفر', exact: true });
const cards = (page: Page) => results(page).locator('article[data-group-id]');
const selected = (page: Page) => results(page).locator('article[data-selected="true"]');
const action = (page: Page) => page.locator('button[data-referral-source="transport"][role="link"]').first();
const save = (name: string, data: unknown) => writeFileSync(resolve(evidence, name + '.json'), JSON.stringify(data, null, 2) + '\n');
async function open(page: Page, input = query) {
  await page.goto('/?q=' + encodeURIComponent(JSON.stringify(input)));
  const submit = page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true });
  await expect(submit).toBeEnabled();
  const initial = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/api/v1/searches'));
  await submit.click();
  const body = await (await initial).json() as SearchRecovery;
  await expect(results(page)).toHaveAttribute('data-status', 'complete', { timeout: 20000 });
  await expect(selected(page)).toHaveCount(1);
  const response = await page.request.get('/api/v1/searches/' + body.snapshot.searchId);
  expect(response.ok()).toBe(true);
  return await response.json() as SearchRecovery;
}
async function verifyDefault(page: Page, recovery: SearchRecovery) {
  const eligible = recovery.snapshot.groups.flatMap(g => g.eligibleQuotes.map(q => ({ groupId: g.groupId, quote: q }))).filter(({ quote }) => quote.completeness.status === 'complete' && quote.eligibility.status === 'eligible' && Date.parse(quote.expiresAt) > Date.now());
  const min = Math.min(...eligible.map(({ quote }) => quote.total.amountRial));
  const selectedId = await selected(page).getAttribute('data-quote-id');
  const exact = eligible.find(({ quote }) => quote.quoteId === selectedId)!;
  expect(exact).toBeTruthy(); expect(exact.quote.total.amountRial).toBe(min);
  await expect(selected(page)).toHaveAttribute('data-group-id', exact.groupId);
  await expect(selected(page)).toHaveAttribute('data-quote-version', String(exact.quote.version));
  await expect(selected(page).locator('[data-card-select]')).toHaveAttribute('aria-pressed', 'true');
  await expect(action(page)).toHaveCount(1); await expect(action(page)).not.toBeFocused();
  return { quoteId: selectedId, amountRial: min, groupId: exact.groupId };
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

test('@compact-results desktop density, native whole-card choice and cheapest automatic route', async ({ page, browser }) => {
  const requests: string[] = []; page.on('request', r => { if (r.method() === 'POST' && r.url().includes('/referrals/')) requests.push(r.url()); });
  const recovery = await open(page, { ...query, sort: 'fastest' });
  const automatic = await verifyDefault(page, recovery);
  const sellers = new Set(recovery.snapshot.coverage.successfulProviderIds).size;
  await expect(results(page).getByRole('heading', { level: 2 })).toHaveText(`مقایسه پروازها (${new Intl.NumberFormat('fa-IR').format(sellers)} فروشنده)`);
  await expect(page.locator('[data-route-presentation]')).toHaveAttribute('data-route-complete', 'true', { timeout: 15000 });
  await expect(page.getByRole('complementary', { name: 'نقشه سفر', exact: true })).toHaveAttribute('data-map-progress', '0.7');
  expect(requests).toEqual([]);
  for (const text of ['نتایج به‌روز در دسترس است', 'شرایط و هزینه‌ها', 'مقایسه تا این لحظه؛ دریافت پیشنهادها ادامه دارد.', 'مسیر خودت را پیدا کن']) await expect(page.getByText(text, { exact: true })).toHaveCount(0);
  await expect(results(page).getByRole('button', { name: 'ویرایش سفر', exact: true })).toHaveCount(0);
  const suggestions = page.getByRole('button', { name: 'سفرهای پیشنهادی', exact: true });
  expect(await suggestions.evaluate(node => Boolean(node.compareDocumentPosition(document.querySelector('form')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  const measurements = [];
  for (const size of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }]) {
    await page.setViewportSize(size);
    await results(page).evaluate(node => window.scrollTo(0, node.getBoundingClientRect().top + scrollY - 12));
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const geometry = await cards(page).evaluateAll(nodes => nodes.map(node => { const box = node.getBoundingClientRect(); return { selected: node.getAttribute('data-selected') === 'true', height: box.height, visible: box.top >= 0 && box.bottom <= innerHeight, width: box.width, nestedButtons: node.querySelectorAll('button button').length }; }));
    save(`density-${size.width}`, { size, geometry });
    await page.screenshot({ path: resolve(evidence, `results-${size.width}.png`) });
    expect(geometry.length).toBeGreaterThanOrEqual(3);
    expect(geometry.every(card => card.height <= (card.selected ? 280 : 185))).toBe(true);
    expect(geometry.filter(card => card.visible).length).toBeGreaterThanOrEqual(3);
    expect(geometry.every(card => card.nestedButtons === 0)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
    measurements.push({ size, geometry });
  }
  const different = cards(page).filter({ has: page.locator('[data-card-select][aria-pressed="false"]') }).first();
  const nextId = await different.getAttribute('data-group-id');
  await different.click({ position: { x: 14, y: 18 } });
  await expect(selected(page)).toHaveAttribute('data-group-id', nextId!); await expect(action(page)).toBeFocused();
  expect(requests).toEqual([]);
  const another = cards(page).filter({ has: page.locator('[data-card-select][aria-pressed="false"]') }).first();
  const keyboardId = await another.getAttribute('data-group-id');
  await another.locator('[data-card-select]').focus(); await page.keyboard.press('Enter');
  await expect(selected(page)).toHaveAttribute('data-group-id', keyboardId!); await expect(action(page)).toBeFocused();
  const details = selected(page).getByRole('button', { name: 'جزئیات سفر', exact: true }); await details.click();
  await expect(details).toHaveAttribute('aria-expanded', 'true'); expect(requests).toEqual([]);
  await expect(selected(page)).toHaveAttribute('data-group-id', keyboardId!);
  save('desktop', { browser: browser.version(), automatic, sellerCount: sellers, measurements, manual: nextId, keyboard: keyboardId, referralPostsBeforeExplicitContinue: requests });
});

for (const mode of ['train', 'bus'] as const) test(`@compact-results ${mode} defaults pin the actual mode and preserve compact round-trip mobile cards`, async ({ page }) => {
  const recovery = await open(page, { ...query, mode, classCode: mode === 'train' ? 'seat' : 'standard', tripType: 'round-trip', returnDate: '2026-10-29' });
  const automatic = await verifyDefault(page, recovery);
  const itinerary = recovery.snapshot.groups.find(group => group.groupId === automatic.groupId)!.itinerary;
  expect(itinerary.mode).toBe(mode);
  await expect(page.getByRole('complementary', { name: 'نقشه سفر', exact: true })).toHaveAttribute('data-map-itinerary', itinerary.itineraryId);
  await expect(page.locator('[data-route-presentation]')).toHaveAttribute('data-route-complete', 'true', { timeout: 15000 });
  const widths = [];
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await selected(page).scrollIntoViewIfNeeded();
    await expect(selected(page).getByText(/^برگشت ·/)).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(overflow).toBeLessThanOrEqual(width);
    await expect(action(page)).toBeVisible();
    const bounds = await selected(page).boundingBox();
    await page.screenshot({ path: resolve(evidence, `${mode}-roundtrip-${width}.png`) });
    widths.push({ width, overflow, selectedCard: bounds });
  }
  await selected(page).getByRole('button', { name: 'جزئیات سفر', exact: true }).click();
  await expect(selected(page).getByRole('region', { name: 'جزئیات مسیر رفت', exact: true })).toBeVisible();
  await expect(selected(page).getByRole('region', { name: 'جزئیات مسیر برگشت', exact: true })).toBeVisible();
  save(mode, { automatic, widths });
});

test('@compact-results confirmed new-tab provider handoff preserves the exact automatic quote and original comparison', async ({ page, context }) => {
  await context.route(/^https:\/\/zarei\.xyz(?:\/|$)/, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Approved placeholder intercepted</title>' }));
  const recovery = await open(page); const automatic = await verifyDefault(page, recovery);
  const originalURL = page.url(), originalHistory = await page.evaluate(() => history.length);
  const originalCamera = await page.locator('[data-camera-intent]').getAttribute('data-camera-intent');
  const quote = recovery.snapshot.groups.flatMap(group => group.eligibleQuotes).find(quote => quote.quoteId === automatic.quoteId)!;
  const posts: string[] = []; page.on('request', r => { if (r.method() === 'POST') posts.push(new URL(r.url()).pathname); });
  const prepare = page.waitForResponse(r => r.url().endsWith('/api/v1/referrals/prepare') && r.request().method() === 'POST');
  const confirm = page.waitForResponse(r => r.url().endsWith('/api/v1/referrals/confirm') && r.request().method() === 'POST');
  const popup = await expectPlaceholder(page, () => action(page).click());
  const checked = await prepare; expect(checked.status()).toBe(201); const recheck = RecheckResultSchema.parse(await checked.json());
  expect(recheck.status).toBe('ready'); if (recheck.status !== 'ready') throw new Error('Expected an exact ready referral intent');
  const response = await confirm; expect(response.status()).toBe(201); const receipt = ReferralReceiptSchema.parse(await response.json());
  exactReceipt(receipt, recheck.intent); expect(receipt.selection).toMatchObject({ quoteId: quote.quoteId, quoteVersion: quote.version + 1 });
  expect(receipt.payload.quote.version).toBe(recheck.intent.selection.quoteVersion); expect(response.request().postDataJSON().acceptedQuoteVersion).toBe(recheck.intent.selection.quoteVersion);
  expect(receipt.payload.kind).toBe('transport'); if (receipt.payload.kind !== 'transport') throw new Error('Expected a transport receipt');
  expect(receipt.payload.quote.total.amountRial).toBe(automatic.amountRial); expect(receipt.payload.quote.party).toEqual(recovery.snapshot.query.party); expect(receipt.payload.quote.conditions.outbound.classCode).toBe(recovery.snapshot.query.classCode);
  expect(receipt.payload.itinerary).toEqual(recovery.snapshot.groups.find(group => group.groupId === automatic.groupId)!.itinerary);
  const read = await page.request.get('/api/v1/referrals/' + receipt.referralId); expect(read.status()).toBe(200); expect(ReferralReceiptSchema.parse(await read.json())).toEqual(receipt);
  await popup.close(); await page.bringToFront();
  expect(page.url()).toBe(originalURL); expect(await page.evaluate(() => history.length)).toBe(originalHistory);
  await expect(results(page)).toHaveAttribute('data-search-id', recovery.snapshot.searchId);
  await expect(selected(page)).toHaveAttribute('data-quote-id', automatic.quoteId!);
  await expect(selected(page)).toHaveAttribute('data-quote-version', String(quote.version)); await expect(action(page)).toBeEnabled();
  expect(await page.locator('[data-camera-intent]').getAttribute('data-camera-intent')).toBe(originalCamera);
  const immutable = await page.request.get('/api/v1/searches/' + recovery.snapshot.searchId); expect(immutable.status()).toBe(200); expect(SearchRecoverySchema.parse(await immutable.json()).snapshot).toEqual(recovery.snapshot);
  expect(posts).toEqual(['/api/v1/referrals/prepare', '/api/v1/referrals/confirm']);
  save('explicit-handoff', { automatic, receipt, originalURL, originalHistory, originalComparisonPreserved: true, posts, boundary: 'Only the approved external navigation is intercepted; recheck, confirm and immutable receipt GET are actual local server operations.' });
});
