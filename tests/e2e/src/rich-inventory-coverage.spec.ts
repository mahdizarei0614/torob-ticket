import type { Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CatalogSnapshotSchema, DatePriceSnapshotSchema, RecheckResultSchema,
  ReferralReceiptSchema, ReferralSelectionSchema, SearchRecoverySchema,
  type ComparisonGroup, type JourneyLeg, type QuoteSnapshot, type SearchRecovery,
  type TransportSearchQuery,
} from '@torob-ticket/contracts';
import { test as ownedTest, expect, type OwnedReviewer } from '../fixtures';
import { exactReceipt, expectPlaceholder, interceptPlaceholder, localDate } from './acceptance/journey-helpers';

const test = ownedTest.extend({
  reviewer: async ({ newReviewer }, use) => {
    await use(await newReviewer({ seed: 49, scenario: 'normal', anchorInstant: '2026-10-29T00:00:00Z', viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' }));
  },
});
test.use({ trace: 'off' });
const out = resolve(process.env.RICH_INVENTORY_EVIDENCE_DIR ?? '.local/evidence/adjustments/rich-inventory-coverage/native/smoke');
const sourceRevision = 'source-v5-schedule-tradeoffs-2026-10-30';
const party = { adults: 1, children: 0, infants: 0 };
const result = (page: Page) => page.getByRole('region', { name: 'نتایج مقایسه سفر', exact: true });
const explorer = (page: Page) => page.getByRole('region', { name: 'کاوش تاریخ سفر', exact: true });
const map = (page: Page) => page.getByRole('complementary', { name: 'نقشه سفر', exact: true });
const fa = (value: number) => new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(value);
const save = (name: string, data: unknown) => writeFileSync(resolve(out, name + '.json'), JSON.stringify(data, null, 2) + '\n');
const slug = (title: string) => title.replace(/[^a-zA-Z0-9]+/g, '-').slice(0, 90);
const errors = new WeakMap<Page, string[]>();
const writes = new WeakMap<Page, string[]>();
const cases = [
  { id: 'domestic-flight', mode: 'flight', scope: 'domestic', originCityId: 'mashhad', destinationCityId: 'shiraz', classCode: 'economy', departureDate: '2026-11-01', expectedReturn: '2026-11-04', handoff: true },
  { id: 'international-flight', mode: 'flight', scope: 'international', originCityId: 'tehran', destinationCityId: 'los-angeles', classCode: 'business', departureDate: '2027-01-23', expectedReturn: '2027-01-25', handoff: false },
  { id: 'domestic-train', mode: 'train', scope: 'domestic', originCityId: 'isfahan', destinationCityId: 'shiraz', classCode: 'sleeper-6', departureDate: '2026-11-01', expectedReturn: '2026-11-04', handoff: false },
  { id: 'international-train', mode: 'train', scope: 'international', originCityId: 'tehran', destinationCityId: 'istanbul', classCode: 'sleeper-4', departureDate: '2026-11-01', expectedReturn: '2026-11-04', handoff: true },
  { id: 'domestic-bus', mode: 'bus', scope: 'domestic', originCityId: 'yazd', destinationCityId: 'kerman', classCode: 'vip', departureDate: '2026-11-01', expectedReturn: '2026-11-04', handoff: true },
  { id: 'international-bus', mode: 'bus', scope: 'international', originCityId: 'tabriz', destinationCityId: 'yerevan', classCode: 'standard', departureDate: '2026-11-01', expectedReturn: '2026-11-04', handoff: false },
] as const;

function serviceFacts(leg: JourneyLeg) {
  return { segments: leg.segments.map(({ mode, operatorId, originPlaceId, destinationPlaceId, departureAt, arrivalAt, departureTimeZone, arrivalTimeZone }) => ({ mode, operatorId, originPlaceId, destinationPlaceId, departureAt, arrivalAt, departureTimeZone, arrivalTimeZone })), stops: leg.stops };
}
function queryFor(value: typeof cases[number]): TransportSearchQuery {
  return { mode: value.mode, scope: value.scope, originCityId: value.originCityId, destinationCityId: value.destinationCityId, classCode: value.classCode, departureDate: value.departureDate, tripType: 'one-way', party, filters: {}, sort: 'cheapest' };
}
async function completed(page: Page, initial: SearchRecovery) {
  await expect(result(page)).toHaveAttribute('data-search-id', initial.snapshot.searchId);
  await expect(result(page)).toHaveAttribute('data-status', /^(complete|empty)$/, { timeout: 45_000 });
  const response = await page.request.get('/api/v1/searches/' + initial.snapshot.searchId);
  expect(response.status()).toBe(200);
  return SearchRecoverySchema.parse(await response.json());
}
async function submit(page: Page) {
  const pending = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/api/v1/searches'));
  await page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true }).click();
  const response = await pending; expect(response.status()).toBe(201);
  return completed(page, SearchRecoverySchema.parse(await response.json()));
}
async function datePrices(page: Page) {
  await expect(explorer(page)).toHaveAttribute('data-date-price-status', 'complete', { timeout: 45_000 });
  const id = await explorer(page).getAttribute('data-date-price-id'); expect(id).toBeTruthy();
  const response = await page.request.get(`/api/v1/date-prices/${id}?clientGeneration=rich-native-proof`);
  expect(response.status()).toBe(200);
  const snapshot = DatePriceSnapshotSchema.parse(await response.json());
  expect(snapshot.datePriceId).toBe(id); expect(snapshot.status).toBe('complete');
  return snapshot;
}
async function inventory(page: Page, recovery: SearchRecovery) {
  const snapshot = recovery.snapshot;
  expect(snapshot.status).toBe('complete'); expect(snapshot.coverage.complete).toBe(true);
  expect(snapshot.coverage.failedProviderIds).toEqual([]); expect(snapshot.coverage.pendingProviderIds).toEqual([]);
  expect(snapshot.groups).toHaveLength(12);
  expect(new Set(snapshot.groups.map(group => JSON.stringify([serviceFacts(group.itinerary.outbound), group.itinerary.return ? serviceFacts(group.itinerary.return) : undefined]))).size).toBe(12);
  expect(new Set(snapshot.groups.map(group => group.itinerary.outbound.segments[0]!.departureAt)).size).toBe(12);
  const quotes = snapshot.groups.flatMap(group => group.eligibleQuotes);
  expect(quotes).toHaveLength(48); expect(new Set(quotes.map(quote => quote.providerId)).size).toBe(4);
  for (const group of snapshot.groups) {
    expect(group.eligibleQuotes).toHaveLength(4); expect(new Set(group.eligibleQuotes.map(quote => quote.providerId)).size).toBe(4);
    const outbound = group.itinerary.outbound;
    expect(localDate(outbound.segments[0]!.departureAt, outbound.segments[0]!.departureTimeZone)).toBe(snapshot.query.departureDate);
    if (snapshot.query.tripType === 'round-trip') {
      const returning = group.itinerary.return!; expect(returning).toBeDefined();
      const arrival = outbound.segments.at(-1)!, departure = returning.segments[0]!;
      expect(localDate(departure.departureAt, departure.departureTimeZone)).toBe(snapshot.query.returnDate);
      expect(Date.parse(departure.departureAt)).toBeGreaterThanOrEqual(Date.parse(arrival.arrivalAt));
      expect(returning.segments[0]!.originPlaceId).toBe(arrival.destinationPlaceId);
      expect(returning.segments.at(-1)!.destinationPlaceId).toBe(outbound.segments[0]!.originPlaceId);
    }
    for (const quote of group.eligibleQuotes) {
      expect(quote.fixtureVersion).toBe('showcase-v3'); expect(quote.sourceRevision).toBe(sourceRevision);
      expect(quote.party).toEqual(party); expect(quote.completeness.status).toBe('complete'); expect(quote.eligibility.status).toBe('eligible');
      expect(quote.conditions.outbound.classCode).toBe(snapshot.query.classCode);
      expect(quote.total.currency).toBe('IRR');
      expect(quote.breakdown.reduce((sum, item) => sum + item.amount.amountRial, 0)).toBe(quote.total.amountRial);
      expect(Number.isSafeInteger(quote.total.amountRial)).toBe(true); expect(quote.total.amountRial).toBeGreaterThan(0);
      expect(Boolean(group.itinerary.return)).toBe(snapshot.query.tripType === 'round-trip');
      expect(Boolean(quote.conditions.return)).toBe(snapshot.query.tripType === 'round-trip');
      if (quote.conditions.return) expect(quote.conditions.return.classCode).toBe(snapshot.query.classCode);
      expect(quote.provenance.length).toBeGreaterThan(0);
      expect(quote.provenance.every(source => source.fixtureVersion === 'showcase-v3' && source.sourceRevision === sourceRevision)).toBe(true);
    }
  }
  // Count twelve factual journeys separately from the exact-price seller buckets.
  const expectedCards = snapshot.groups.flatMap(group => [...new Set(group.eligibleQuotes.map(quote => quote.total.amountRial))].map(amount => ({ groupId: group.groupId, amount })));
  const cards = result(page).locator('article[data-price-card-id]'); await expect(cards).toHaveCount(expectedCards.length);
  const displayed = await cards.evaluateAll(nodes => nodes.map(node => ({ groupId: node.getAttribute('data-group-id')!, amount: Number(node.getAttribute('data-amount-rial')) })));
  expect(displayed.map(row => `${row.groupId}/${row.amount}`).sort()).toEqual(expectedCards.map(row => `${row.groupId}/${row.amount}`).sort());
  expect(new Set(displayed.map(row => row.groupId)).size).toBe(12);
  return { groups: snapshot.groups.length, actualServiceSignatures: 12, sellers: 4, completeQuotes: quotes.length, priceCards: displayed.length, displayed };
}
async function select(page: Page, group: ComparisonGroup) {
  const quote = group.eligibleQuotes.find(quote => quote.quoteId === group.representativeQuoteId)!;
  const card = result(page).locator(`article[data-group-id="${group.groupId}"][data-amount-rial="${quote.total.amountRial}"]`);
  const choice = card.getByRole('button', { name: 'انتخاب پیشنهاد', exact: true });
  await expect(choice).toBeEnabled(); await choice.focus(); await choice.press('Enter');
  await expect(card).toHaveAttribute('data-selected', 'true');
  await expect(card).toHaveAttribute('data-quote-id', quote.quoteId);
  await expect(card.getByRole('group', { name: `مجموع ۱ مسافر: ${fa(quote.total.amountRial / 10)} تومان`, exact: true })).toBeVisible();
  await page.mouse.move(1439, 1);
  await expect(page.locator('[data-graphics-status]')).toHaveAttribute('data-graphics-status', 'ready', { timeout: 45_000 });
  await expect(map(page)).toHaveAttribute('data-map-itinerary', group.itinerary.itineraryId);
  await expect(page.locator('[data-route-presentation]')).toHaveAttribute('data-route-complete', 'true');
  const marker = card.locator('img[data-airline-brand], img[data-ground-operator-brand]'); await expect(marker).toHaveCount(1);
  await expect.poll(() => marker.evaluate(node => (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0)).toBe(true);
  const image = await marker.evaluate(node => { const image = node as HTMLImageElement, box = image.getBoundingClientRect(); return { src: image.currentSrc, naturalWidth: image.naturalWidth, width: box.width, height: box.height }; });
  expect(image.src).toMatch(/\/(airlines|ground-operators)\/.*\.png$/); expect(image.width).toBe(40); expect(image.height).toBe(40);
  await card.getByRole('button', { name: 'جزئیات سفر', exact: true }).click();
  const legs = [group.itinerary.outbound, ...(group.itinerary.return ? [group.itinerary.return] : [])];
  for (const [index, leg] of legs.entries()) {
    const details = card.getByRole('region', { name: 'جزئیات مسیر ' + (index ? 'برگشت' : 'رفت'), exact: true });
    expect(await details.locator('[data-segment-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-segment-id')))).toEqual(leg.segments.map(segment => segment.segmentId));
    expect(await details.locator('[data-stop-place]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-stop-place')))).toEqual(leg.stops.map(stop => stop.placeId));
  }
  const stops = page.locator('[data-route-presentation] [data-route-stop]');
  expect(await stops.evaluateAll(nodes => nodes.map(node => ({ placeId: node.getAttribute('data-route-stop'), waitMinutes: Number(node.getAttribute('data-wait-minutes')), direction: node.getAttribute('data-stop-direction') })))).toEqual(legs.flatMap((leg, index) => leg.stops.map(stop => ({ placeId: stop.placeId, waitMinutes: stop.waitMinutes, direction: group.itinerary.return ? index ? 'return' : 'outbound' : null }))));
  return { card, quote, image };
}
async function calendarPrice(page: Page, recovery: SearchRecovery) {
  const query = recovery.snapshot.query, date = query.returnDate!;
  const previous = await explorer(page).getAttribute('data-date-price-id');
  const returning = page.getByRole('radiogroup', { name: 'جستجو بر اساس', exact: true }).getByRole('radio', { name: 'تاریخ برگشت', exact: true });
  await returning.focus(); await returning.press('Space');
  await expect(explorer(page)).toHaveAttribute('data-date-leg', 'return');
  await expect(explorer(page)).not.toHaveAttribute('data-date-price-id', previous!);
  const prices = await datePrices(page), cell = prices.cells.find(cell => cell.date === date)!;
  expect(prices.query.leg).toBe('return'); expect(prices.query.query.departureDate).toBe(query.departureDate); expect(cell.status).toBe('priced');
  const minimum = Math.min(...recovery.snapshot.groups.flatMap(group => group.eligibleQuotes.map(quote => quote.total.amountRial)));
  if (cell.status === 'priced') expect(cell.minimum).toEqual({ amountRial: minimum, currency: 'IRR' });
  await page.getByRole('button', { name: 'تقویم جلالی و انتخاب تاریخ', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'انتخاب تاریخ سفر', exact: true }); await expect(dialog).toBeVisible();
  // Calendar requests its actual wider month dataset before displaying that cell.
  await expect(explorer(page)).not.toHaveAttribute('data-date-price-id', prices.datePriceId);
  const expanded = await datePrices(page), calendarCell = expanded.cells.find(cell => cell.date === date)!;
  expect(expanded.query.leg).toBe('return'); expect(expanded.query.query.departureDate).toBe(query.departureDate); expect(calendarCell.status).toBe('priced');
  if (calendarCell.status === 'priced') expect(calendarCell.minimum).toEqual({ amountRial: minimum, currency: 'IRR' });
  for (const priced of [cell, calendarCell]) if (priced.status === 'priced') {
    expect(priced.coverage.complete).toBe(true); expect(priced.coverage.expectedProviderIds).toHaveLength(4);
    expect([...priced.coverage.successfulProviderIds].sort()).toEqual([...priced.coverage.expectedProviderIds].sort());
    expect(priced.coverage.failedProviderIds).toEqual([]); expect(priced.coverage.pendingProviderIds).toEqual([]);
  }
  await expect(dialog.locator(`[data-date="${date}"] [data-price-band]`)).toHaveText(fa(minimum / 10000));
  await dialog.screenshot({ path: resolve(out, slug(test.info().title) + '-calendar.png') });
  await dialog.getByRole('button', { name: 'انصراف', exact: true }).click();
  return { date, fixedOutbound: query.departureDate, minimumRial: minimum, datePriceId: prices.datePriceId, cell, calendarDatePriceId: expanded.datePriceId, calendarCell };
}
async function handoff(reviewer: OwnedReviewer, quote: QuoteSnapshot, group: ComparisonGroup) {
  const { page } = reviewer, attempts = await interceptPlaceholder(reviewer);
  const original = { url: page.url(), searchId: await result(page).getAttribute('data-search-id'), itineraryId: await map(page).getAttribute('data-map-itinerary') };
  const seller = page.locator(`button[role="link"][data-referral-source="transport"][data-seller-link-quote-id="${quote.quoteId}"]`);
  await expect(seller).toBeEnabled();
  const prepared = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/api/v1/referrals/prepare'));
  const confirmed = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/api/v1/referrals/confirm'));
  const popup = await expectPlaceholder(page, () => seller.click());
  const prepareResponse = await prepared; expect(prepareResponse.status()).toBe(201);
  expect(ReferralSelectionSchema.parse(prepareResponse.request().postDataJSON())).toEqual({ kind: 'transport', quoteId: quote.quoteId, quoteVersion: quote.version });
  const recheck = RecheckResultSchema.parse(await prepareResponse.json()); expect(recheck.status).toBe('ready');
  if (recheck.status === 'unavailable') throw new Error('Normal rich-inventory quote must recheck');
  const response = await confirmed; expect(response.status()).toBe(201);
  const receipt = ReferralReceiptSchema.parse(await response.json()); exactReceipt(receipt, recheck.intent);
  expect(receipt.payload.kind).toBe('transport');
  if (receipt.payload.kind === 'transport') {
    expect(receipt.payload.quote.quoteId).toBe(quote.quoteId); expect(receipt.payload.quote.providerId).toBe(quote.providerId);
    expect(receipt.payload.quote.total).toEqual(quote.total); expect(receipt.payload.quote.breakdown).toEqual(quote.breakdown);
    expect(receipt.payload.quote.party).toEqual(quote.party); expect(receipt.payload.quote.conditions).toEqual(quote.conditions);
    expect(receipt.payload.itinerary).toEqual(group.itinerary);
  }
  expect(attempts).toEqual(['https://zarei.xyz/']); expect(page.url()).toBe(original.url);
  await expect(result(page)).toHaveAttribute('data-search-id', original.searchId!);
  await expect(map(page)).toHaveAttribute('data-map-itinerary', original.itineraryId!);
  await expect(result(page).locator('article[data-selected="true"]')).toHaveAttribute('data-quote-id', quote.quoteId);
  await popup.close(); await page.bringToFront();
  await page.screenshot({ path: resolve(out, slug(test.info().title) + '-handoff.png') });
  return { recheck, receipt, attempts, original, proofLimit: 'Only the approved external placeholder navigation is intercepted. Real local inventory, SSE, prepare and confirm remain untouched; no live provider, booking or purchase is claimed.' };
}

test.beforeEach(async ({ reviewer }, info) => {
  mkdirSync(out, { recursive: true }); const { page, session } = reviewer;
  await page.addInitScript(() => localStorage.setItem('torobticket.appearance', 'dark'));
  const failures: string[] = [], posts: string[] = []; errors.set(page, failures); writes.set(page, posts);
  page.on('pageerror', () => failures.push('uncaught-page-error'));
  page.on('request', request => { if (request.method() === 'POST') posts.push(new URL(request.url()).pathname); });
  expect(session.fixtureVersion).toBe('showcase-v3'); expect(session.catalogRevision).toBe('catalog-v3');
  save(slug(info.title) + '-session', session);
});
test.afterEach(async ({ reviewer }, info) => {
  // Shared owned fixture captures public failure DOM/screenshots and resets its
  // own namespace with a separate in-memory jar, including after a test timeout.
  save(slug(info.title) + '-public-status', { status: info.status, expectedStatus: info.expectedStatus, pageErrorKinds: errors.get(reviewer.page), postPaths: writes.get(reviewer.page) });
  expect(errors.get(reviewer.page)).toEqual([]);
});

for (const value of cases) test(`@rich-inventory ${value.id} has twelve distinct service choices in OW and complete RT`, async ({ reviewer, browser }) => {
  test.setTimeout(180_000); const { page } = reviewer;
  const input = queryFor(value);
  await page.goto('/?q=' + encodeURIComponent(JSON.stringify(input)));
  await expect(page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true })).toBeEnabled(); await page.evaluate(() => document.fonts.ready);
  const initialDates = await datePrices(page);
  if (value.departureDate === '2026-11-01') expect(initialDates.cells.find(cell => cell.date === '2026-11-04')?.status).toBe('priced');
  const oneWay = await submit(page), oneWayDOM = await inventory(page, oneWay); expect(oneWay.snapshot.query).toEqual(input);
  const beforePosts = writes.get(page)!.filter(path => path === '/api/v1/searches').length;
  const trip = page.getByRole('radiogroup', { name: 'نوع سفر', exact: true }).getByRole('radio', { name: 'رفت‌وبرگشت', exact: true });
  await trip.focus(); await trip.press('Space');
  // Keep the current +3-day/default-horizon rule, including LAX's Jan25 clamp.
  // Every returned RT choice must still depart after its actual outbound arrival.
  await expect(explorer(page)).toHaveAttribute('data-selected-return', value.expectedReturn); await datePrices(page);
  const roundTrip = await submit(page), roundTripDOM = await inventory(page, roundTrip);
  expect(roundTrip.snapshot.query).toEqual({ ...input, tripType: 'round-trip', returnDate: value.expectedReturn });
  expect(writes.get(page)!.filter(path => path === '/api/v1/searches').length).toBe(beforePosts + 1);
  const catalogResponse = await page.request.get('/api/v1/catalog'); expect(catalogResponse.status()).toBe(200);
  const catalog = CatalogSnapshotSchema.parse(await catalogResponse.json()); expect(catalog.fixtureVersion).toBe('showcase-v3'); expect(catalog.catalogRevision).toBe('catalog-v3');
  const group = roundTrip.snapshot.groups.find(group => group.itinerary.outbound.segments[0]!.serviceId.includes(value.id === 'international-flight' ? '-los-angeles-11-' : '-0-'))!;
  expect(group).toBeTruthy();
  const calendar = await calendarPrice(page, roundTrip), selected = await select(page, group);
  if (value.id === 'international-train') {
    for (const leg of [group.itinerary.outbound, group.itinerary.return!]) {
      const road = leg.segments.findIndex(segment => segment.mode === 'bus'); expect(road).toBeGreaterThan(0);
      expect([leg.segments[road]!.originPlaceId, leg.segments[road]!.destinationPlaceId].sort()).toEqual(['tatvan-station', 'van-station']);
      expect(leg.segments[road - 1]!.mode).toBe('train'); expect(leg.segments[road + 1]!.mode).toBe('train');
      expect(leg.stops.filter(stop => stop.kind === 'ground-transfer')).toHaveLength(2);
    }
    expect(selected.quote.conditions.outbound.checkedBaggageKg.status).toBe('unknown');
    await expect(selected.card).toContainText('حفاظت اتصال، انتقال بار، پذیرایی و جریمه لغو اعلام نشده است.');
    await expect(selected.card.locator('[data-transfer="true"]')).toHaveCount(2);
  }
  if (value.id === 'international-flight') {
    expect(group.itinerary.outbound.segments).toHaveLength(4); expect(group.itinerary.return!.segments).toHaveLength(2);
    expect(group.itinerary.outbound.segments.map(segment => segment.destinationPlaceId)).toEqual(['dxb', 'sin', 'hnd', 'lax']);
    expect(group.itinerary.return!.segments.map(segment => segment.destinationPlaceId)).toEqual(['doh', 'ika']);
    for (const [direction, leg] of [['outbound', group.itinerary.outbound], ['return', group.itinerary.return!]] as const) {
      const ids = [leg.segments[0]!.originPlaceId, ...leg.segments.map(segment => segment.destinationPlaceId)];
      const codes = ids.map(id => catalog.places.find(place => place.id === id)!.code).join(' → ');
      const route = map(page).locator(`[data-map-heading-key]:not([aria-hidden="true"]) [data-map-leg-route="${direction}"] bdi`);
      await expect(route).toHaveAttribute('dir', 'ltr'); await expect(route).toHaveText(codes);
    }
  }
  await selected.card.scrollIntoViewIfNeeded(); await selected.card.screenshot({ path: resolve(out, value.id + '-selected-card.png') });
  await map(page).screenshot({ path: resolve(out, value.id + '-route.png') }); await page.screenshot({ path: resolve(out, value.id + '-results.png') });
  const referral = value.handoff ? await handoff(reviewer, selected.quote, group) : undefined;
  let refinement: unknown;
  if (value.id === 'domestic-flight') {
    const count = writes.get(page)!.filter(path => path === '/api/v1/searches').length;
    const fastestChoice = result(page).getByRole('radiogroup', { name: 'مرتب‌سازی پیشنهادها', exact: true }).getByRole('radio', { name: 'سریع‌ترین', exact: true });
    await fastestChoice.focus(); await fastestChoice.press('Space'); await expect(result(page)).toHaveAttribute('data-search-id', roundTrip.snapshot.searchId);
    expect(writes.get(page)!.filter(path => path === '/api/v1/searches').length).toBe(count);
    const fastest = Math.min(...roundTrip.snapshot.groups.map(group => group.durationMinutes));
    const firstGroupId = await result(page).locator('article[data-price-card-id]').first().getAttribute('data-group-id');
    expect(roundTrip.snapshot.groups.find(group => group.groupId === firstGroupId)!.durationMinutes).toBe(fastest);
    await result(page).getByRole('button', { name: 'فیلتر نتایج', exact: true }).click();
    const filters = page.getByRole('form', { name: 'فیلتر پیشنهادهای سفر', exact: true }); await filters.getByLabel('سقف مبلغ کل (تومان)', { exact: true }).fill('0.1');
    const pending = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/api/v1/searches'));
    await filters.getByRole('button', { name: 'اعمال فیلترها', exact: true }).click(); const response = await pending; expect(response.status()).toBe(201);
    const filtered = await completed(page, SearchRecoverySchema.parse(await response.json()));
    expect(filtered.snapshot.groups).toEqual([]); expect(filtered.snapshot.coverage.complete).toBe(true); expect(filtered.snapshot.query.filters.budgetMaxRial).toBe(1);
    await expect(page.locator('[data-results-empty="filter-empty"]')).toBeVisible(); refinement = { localSort: 'fastest', newSearchesForSort: 0, filtered };
  }
  save(value.id, { browser: browser.version(), networkInterception: referral ? { scope: 'Only https://zarei.xyz/ destination navigation', attempts: referral.attempts } : false, fixtureIdentity: { fixtureVersion: catalog.fixtureVersion, catalogRevision: catalog.catalogRevision, sourceRevision }, session: reviewer.session, query: input, initialDatePrices: initialDates, oneWay: { snapshot: oneWay.snapshot, dom: oneWayDOM }, roundTrip: { snapshot: roundTrip.snapshot, dom: roundTripDOM }, calendar, selected: { group, quote: selected.quote, image: selected.image }, referral, refinement });
});
