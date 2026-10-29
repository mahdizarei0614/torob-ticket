import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CatalogSnapshot, ComparisonGroup, DatePriceSnapshot, JourneyLeg, QuoteSnapshot, ReferralReceipt, SearchRecovery, TransportSearchQuery } from '@torob-ticket/contracts';

test.use({ trace: 'off' }); // Receipts contain public evidence; native traces can retain session cookies.
const out = resolve(process.env.RICH_INVENTORY_EVIDENCE_DIR ?? 'docs/evidence/adjustments/rich-inventory-coverage/native/smoke');
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
  await expect(result(page)).toHaveAttribute('data-status', /^(complete|empty)$/, { timeout: 45000 });
  const response = await page.request.get('/api/v1/searches/' + initial.snapshot.searchId);
  expect(response.status()).toBe(200);
  return await response.json() as SearchRecovery;
}
async function submit(page: Page) {
  const pending = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/api/v1/searches'));
  await page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true }).click();
  const response = await pending; expect(response.status()).toBe(201);
  return completed(page, await response.json());
}
async function datePrices(page: Page) {
  await expect(explorer(page)).toHaveAttribute('data-date-price-status', 'complete', { timeout: 45000 });
  const id = await explorer(page).getAttribute('data-date-price-id'); expect(id).toBeTruthy();
  const response = await page.request.get(`/api/v1/date-prices/${id}?clientGeneration=rich-native-proof`);
  expect(response.status()).toBe(200);
  return await response.json() as DatePriceSnapshot;
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
    for (const quote of group.eligibleQuotes) {
      expect(quote.fixtureVersion).toBe('showcase-v3'); expect(quote.sourceRevision).toBe('source-v3-rich-inventory-2026-10-29');
      expect(quote.party).toEqual(party); expect(quote.completeness.status).toBe('complete'); expect(quote.conditions.outbound.classCode).toBe(snapshot.query.classCode);
      expect(quote.breakdown.reduce((sum, item) => sum + item.amount.amountRial, 0)).toBe(quote.total.amountRial);
      expect(Number.isSafeInteger(quote.total.amountRial)).toBe(true); expect(quote.total.amountRial).toBeGreaterThan(0);
      expect(Boolean(group.itinerary.return)).toBe(snapshot.query.tripType === 'round-trip');
      expect(Boolean(quote.conditions.return)).toBe(snapshot.query.tripType === 'round-trip');
      expect(quote.provenance.every(source => source.fixtureVersion === 'showcase-v3' && source.sourceRevision === quote.sourceRevision)).toBe(true);
    }
  }
  // The UI splits each exact total into a card; count12 journeys separately from seller price cards.
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
  await card.getByRole('button', { name: 'انتخاب پیشنهاد', exact: true }).focus();
  await card.getByRole('button', { name: 'انتخاب پیشنهاد', exact: true }).press('Enter');
  await expect(card).toHaveAttribute('data-selected', 'true');
  await expect(card).toHaveAttribute('data-quote-id', quote.quoteId);
  await expect(card.getByRole('group', { name: `مجموع ۱ مسافر: ${fa(quote.total.amountRial / 10)} تومان`, exact: true })).toBeVisible();
  await page.mouse.move(1439, 1);
  await expect(page.locator('[data-graphics-status]')).toHaveAttribute('data-graphics-status', 'ready');
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
  const date = recovery.snapshot.query.returnDate!;
  await explorer(page).getByLabel('بخش سفر برای قیمت روزها', { exact: true }).selectOption('return');
  const prices = await datePrices(page), cell = prices.cells.find(cell => cell.date === date)!;
  expect(prices.query.leg).toBe('return'); expect(cell.status).toBe('priced');
  const minimum = Math.min(...recovery.snapshot.groups.flatMap(group => group.eligibleQuotes.map(quote => quote.total.amountRial)));
  if (cell.status === 'priced') expect(cell.minimum.amountRial).toBe(minimum);
  await page.getByRole('button', { name: 'تقویم جلالی و انتخاب تاریخ', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'انتخاب تاریخ سفر', exact: true });
  await expect(dialog.locator(`[data-date="${date}"] [data-price-band]`)).toContainText(fa(minimum / 10000));
  await dialog.screenshot({ path: resolve(out, slug(test.info().title) + '-calendar.png') });
  await dialog.getByRole('button', { name: 'انصراف', exact: true }).click();
  return { date, minimumRial: minimum, datePriceId: prices.datePriceId, cell };
}
async function handoff(page: Page, quote: QuoteSnapshot, group: ComparisonGroup) {
  const seller = page.locator(`button[role="link"][data-referral-source="transport"][data-seller-link-quote-id="${quote.quoteId}"]`);
  await expect(seller).toBeEnabled();
  const pending = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/api/v1/referrals/confirm'));
  await seller.click(); const response = await pending; expect(response.status()).toBe(201);
  const receipt = await response.json() as ReferralReceipt;
  expect(receipt.payload.kind).toBe('transport');
  if (receipt.payload.kind === 'transport') {
    expect(receipt.payload.quote.quoteId).toBe(quote.quoteId); expect(receipt.payload.quote.providerId).toBe(quote.providerId);
    expect(receipt.payload.quote.total).toEqual(quote.total); expect(receipt.payload.quote.conditions).toEqual(quote.conditions);
    expect(receipt.payload.itinerary).toEqual(group.itinerary);
  }
  await expect(page.getByText('ارجاع به فروشنده ثبت شد', { exact: true })).toBeVisible();
  await page.screenshot({ path: resolve(out, slug(test.info().title) + '-handoff.png') });
  await page.getByRole('button', { name: 'بازگشت به مقایسه سفر', exact: true }).click();
  await expect(result(page).locator('article[data-selected="true"]')).toHaveAttribute('data-quote-id', quote.quoteId);
  return receipt;
}

test.beforeEach(async ({ page, context }, info) => {
  mkdirSync(out, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('torobticket.appearance', 'dark'));
  const failures: string[] = [], posts: string[] = []; errors.set(page, failures); writes.set(page, posts);
  page.on('pageerror', error => failures.push(error.message));
  page.on('request', request => { if (request.method() === 'POST') posts.push(new URL(request.url()).pathname); });
  const response = await context.request.post('/api/v1/demo/session', { data: { seed: 49, scenario: 'normal', anchorInstant: '2026-10-29T00:00:00Z' } });
  expect(response.status()).toBe(201); const session = await response.json();
  expect(session.fixtureVersion).toBe('showcase-v3'); expect(session.catalogRevision).toBe('catalog-v3');
  save(slug(info.title) + '-session', session);
});
test.afterEach(async ({ page, context }, info) => {
  if (info.status !== info.expectedStatus && !page.isClosed()) {
    const searchId = await result(page).count() ? await result(page).getAttribute('data-search-id') : undefined;
    const datePriceId = await explorer(page).count() ? await explorer(page).getAttribute('data-date-price-id') : undefined;
    const read = async (path: string) => { const response = await context.request.get(path); return { status: response.status(), body: await response.json() }; };
    const search = searchId ? await read('/api/v1/searches/' + searchId) : undefined;
    const dates = datePriceId ? await read(`/api/v1/date-prices/${datePriceId}?clientGeneration=rich-native-failure`) : undefined;
    save(slug(info.title) + '-failure', { url: page.url(), errors: info.errors, body: await page.locator('body').innerText(), search, dates });
    await page.screenshot({ path: resolve(out, slug(info.title) + '-failure.png') });
  }
  const response = await context.request.post('/api/v1/admin/reset', { data: {} });
  save(slug(info.title) + '-cleanup', { status: response.status(), errors: errors.get(page), writes: writes.get(page) });
  expect(response.status()).toBe(201); expect(errors.get(page)).toEqual([]);
});

for (const value of cases) test(`@rich-inventory ${value.id} has twelve distinct service choices in OW and complete RT`, async ({ page, browser }) => {
  test.setTimeout(180000);
  const input = queryFor(value);
  await page.goto('/?q=' + encodeURIComponent(JSON.stringify(input)));
  await expect(page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true })).toBeEnabled();
  await page.evaluate(() => document.fonts.ready);
  const initialDates = await datePrices(page);
  if (value.departureDate === '2026-11-01') expect(initialDates.cells.find(cell => cell.date === '2026-11-04')?.status).toBe('priced');
  const oneWay = await submit(page), oneWayDOM = await inventory(page, oneWay);
  expect(oneWay.snapshot.query).toEqual(input);
  const beforePosts = writes.get(page)!.filter(path => path === '/api/v1/searches').length;
  await page.getByRole('radiogroup', { name: 'نوع سفر', exact: true }).getByText('رفت‌وبرگشت', { exact: true }).click();
  await expect(explorer(page)).toHaveAttribute('data-selected-return', value.expectedReturn);
  await datePrices(page);
  const roundTrip = await submit(page), roundTripDOM = await inventory(page, roundTrip);
  expect(roundTrip.snapshot.query).toEqual({ ...input, tripType: 'round-trip', returnDate: value.expectedReturn });
  expect(writes.get(page)!.filter(path => path === '/api/v1/searches').length).toBe(beforePosts + 1);
  const catalogResponse = await page.request.get('/api/v1/catalog'); expect(catalogResponse.status()).toBe(200);
  const catalog = await catalogResponse.json() as CatalogSnapshot; expect(catalog.fixtureVersion).toBe('showcase-v3');
  const group = roundTrip.snapshot.groups.find(group => group.itinerary.outbound.segments[0]!.serviceId.includes(value.id === 'international-flight' ? '-los-angeles-11-' : '-0-'))!;
  expect(group).toBeTruthy();
  const calendar = await calendarPrice(page, roundTrip);
  const selected = await select(page, group);
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
    expect(group.itinerary.outbound.segments).toHaveLength(4); expect(group.itinerary.return?.segments).toHaveLength(4);
    expect(group.itinerary.outbound.segments.map(segment => segment.destinationPlaceId)).toEqual(['dxb', 'sin', 'hnd', 'lax']);
    await expect(page.locator('[data-map-heading-key]:not([aria-hidden="true"]) p')).toContainText('IKA → DXB → SIN → HND → LAX → HND → SIN → DXB → IKA');
  }
  await selected.card.scrollIntoViewIfNeeded();
  await selected.card.screenshot({ path: resolve(out, value.id + '-selected-card.png') });
  await map(page).screenshot({ path: resolve(out, value.id + '-route.png') });
  await page.screenshot({ path: resolve(out, value.id + '-results.png') });
  const receipt = value.handoff ? await handoff(page, selected.quote, group) : undefined;
  let refinement: unknown;
  if (value.id === 'domestic-flight') {
    const count = writes.get(page)!.filter(path => path === '/api/v1/searches').length;
    await result(page).getByRole('radiogroup', { name: 'مرتب‌سازی پیشنهادها', exact: true }).getByText('سریع‌ترین', { exact: true }).click();
    await expect(result(page)).toHaveAttribute('data-search-id', roundTrip.snapshot.searchId);
    expect(writes.get(page)!.filter(path => path === '/api/v1/searches').length).toBe(count);
    const fastest = Math.min(...roundTrip.snapshot.groups.map(group => group.durationMinutes));
    const firstGroupId = await result(page).locator('article[data-price-card-id]').first().getAttribute('data-group-id');
    expect(roundTrip.snapshot.groups.find(group => group.groupId === firstGroupId)!.durationMinutes).toBe(fastest);
    await result(page).getByRole('button', { name: 'فیلتر نتایج', exact: true }).click();
    const filters = page.getByRole('form', { name: 'فیلتر پیشنهادهای سفر', exact: true });
    await filters.getByLabel('سقف مبلغ کل (تومان)', { exact: true }).fill('0.1');
    const pending = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/api/v1/searches'));
    await filters.getByRole('button', { name: 'اعمال فیلترها', exact: true }).click();
    const response = await pending; expect(response.status()).toBe(201);
    const filtered = await completed(page, await response.json());
    expect(filtered.snapshot.groups).toEqual([]); expect(filtered.snapshot.coverage.complete).toBe(true);
    expect(filtered.snapshot.query.filters.budgetMaxRial).toBe(1);
    await expect(page.locator('[data-results-empty="filter-empty"]')).toBeVisible();
    refinement = { localSort: 'fastest', newSearchesForSort: 0, filtered };
  }
  save(value.id, { browser: browser.version(), networkInterception: false, fixtureIdentity: { fixtureVersion: catalog.fixtureVersion, catalogRevision: catalog.catalogRevision }, query: input, initialDatePrices: initialDates, oneWay: { snapshot: oneWay.snapshot, dom: oneWayDOM }, roundTrip: { snapshot: roundTrip.snapshot, dom: roundTripDOM }, calendar, selected: { group, quote: selected.quote, image: selected.image }, receipt, refinement });
});
