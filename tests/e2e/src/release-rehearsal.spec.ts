import { randomUUID } from 'node:crypto';
import type { APIRequestContext, APIResponse, Page, Response as PlaywrightResponse, TestInfo } from '@playwright/test';
import {
  AdminControlConfigSchema, AdminReferralDetailSchema, HotelSearchSnapshotSchema,
  RecheckResultSchema, ReferralReceiptSchema, SearchRecoverySchema,
  type AdminControlConfig, type HotelSearchSnapshot, type SearchRecovery,
} from '@torob-ticket/contracts';
import {
  test, expect, currentDatePrices, dateExplorer, loadQuery, priceCards, queryFor,
  readSearch, resetReviewer, resultRegion, runSearch, startApiSearch, waitForSearch,
  type OwnedReviewer,
} from '../fixtures';
import {
  confirmation, confirm, contractResponse, exactReceipt, hotelOrder, hotelProjection,
  localDate, nextDay, prepare, referralList,
} from './acceptance/journey-helpers';
import {
  blockExternalNetwork, lifecycleCoordinator, lifecycleExplicitlySelected,
  rehearsalEvidence, rehearsalOrigin,
} from './release-rehearsal-support';

test.use({ trace: 'off' });

const selectedCard = (page: Page) => priceCards(page).locator('xpath=self::*[@data-selected="true"]');
const hotelReply = (page: Page) => page.waitForResponse(response => response.request().method() === 'POST'
  && new URL(response.url()).pathname === '/api/v1/hotel-searches');
// Normal reads may extend inactivity expiry; every actual control/identity field stays exact.
const configurationAuthority = (config: AdminControlConfig) => ({ revision: config.revision, providers: config.providers,
  session: Object.fromEntries(Object.entries(config.session).filter(([key]) => key !== 'expiresAt')) });

function firstQuote(run: SearchRecovery) {
  const quote = run.snapshot.groups.flatMap(group => group.eligibleQuotes)[0];
  if (!quote) throw new Error('A normal rehearsal comparison must contain an eligible complete quote');
  return quote;
}

function arrivalStay(run: SearchRecovery) {
  const leg = run.snapshot.groups[0]?.itinerary.outbound, arrival = leg?.segments.at(-1);
  if (!arrival) throw new Error('The rehearsal comparison needs its actual arriving segment');
  const checkIn = localDate(arrival.arrivalAt, arrival.arrivalTimeZone);
  return { destinationCityId: run.snapshot.query.destinationCityId, checkIn, checkOut: nextDay(checkIn),
    party: run.snapshot.query.party, rooms: 1, sort: 'cheapest' as const, arrivalPlaceId: arrival.destinationPlaceId };
}

async function receiptFor(reviewer: OwnedReviewer, run: SearchRecovery) {
  const quote = firstQuote(run), prepared = await prepare(reviewer, { kind: 'transport', quoteId: quote.quoteId, quoteVersion: quote.version });
  expect(prepared.status).toBe('ready');
  if (prepared.status === 'unavailable') throw new Error('The normal rehearsal quote must remain available');
  const receipt = await confirm(reviewer, confirmation(prepared.intent, 't33-' + randomUUID()));
  exactReceipt(receipt, prepared.intent);
  return receipt;
}

async function readyStatus(api: APIRequestContext): Promise<number> {
  try { return (await api.get('/api/health/ready', { timeout: 1500 })).status(); }
  catch { return 0; }
}

async function waitReady(api: APIRequestContext) {
  await expect.poll(() => readyStatus(api), { timeout: 45_000, intervals: [100, 250, 500] }).toBe(200);
  expect(await (await api.get('/api/health/ready')).json()).toMatchObject({ status: 'ready', database: 'ready', migrations: 'ready', seed: 'ready' });
}

async function waitDown(api: APIRequestContext) {
  let status = 200;
  await expect.poll(async () => { status = await readyStatus(api); return [0, 502, 503, 504].includes(status); },
    { timeout: 15_000, intervals: [50, 100, 250] }).toBe(true);
  return status;
}

async function responseSnapshot(response: APIResponse | PlaywrightResponse) {
  expect(response.status()).toBe(201);
  return SearchRecoverySchema.parse(await response.json());
}

function lifecycleNeedsConfiguration(info: TestInfo) {
  if (!process.env.T33_COORDINATION_DIR && !lifecycleExplicitlySelected(info)) {
    test.skip(true, 'Real lifecycle rehearsal requires the separately owned T33 coordinator');
  }
}

test.describe('@release-rehearsal current packaged application', () => {
  test('@release-core cold external-network block preserves comparison, hotel coordinates and confirmed handoff', async ({ newReviewer, baseURL, browser }, info) => {
    test.setTimeout(120_000);
    const origin = rehearsalOrigin(baseURL), reviewer = await newReviewer({ seed: 3331, reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
    const { page, context } = reviewer, network = await blockExternalNetwork(context, origin);
    const query = queryFor('flight', 'domestic', 'round-trip');
    const snapshots: HotelSearchSnapshot[] = [];
    let receipt: ReturnType<typeof ReferralReceiptSchema.parse> | undefined;
    try {
      await loadQuery(reviewer, query);
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => ({ fonts: document.fonts.status, broken: Array.from(document.images).filter(image => !image.complete || !image.naturalWidth).length,
        controlledByWorker: Boolean(navigator.serviceWorker?.controller) }))).toEqual({ fonts: 'loaded', broken: 0, controlledByWorker: false });
      expect(network.blocked).toEqual([]);
      const calendarTrigger = page.getByRole('button', { name: 'تقویم جلالی و انتخاب تاریخ', exact: true });
      await calendarTrigger.click();
      const calendar = page.getByRole('dialog', { name: 'انتخاب تاریخ سفر', exact: true });
      await expect(calendar.getByRole('grid').first()).toBeVisible();
      await calendar.getByRole('button', { name: 'انصراف', exact: true }).click();
      await expect(calendar).toHaveCount(0); await expect(calendarTrigger).toBeFocused();
      const dates = await currentDatePrices(reviewer);
      expect(dates.status).toBe('complete');
      await expect(dateExplorer(page)).toHaveAttribute('data-date-price-status', 'complete');
      const run = await runSearch(reviewer);
      expect(run.snapshot.status).toBe('complete');
      await expect(selectedCard(page)).toHaveCount(1);
      const transportQuoteId = (await selectedCard(page).getAttribute('data-quote-id'))!;
      const group = run.snapshot.groups.find(item => item.eligibleQuotes.some(quote => quote.quoteId === transportQuoteId))!;
      expect(group.itinerary.return).toBeDefined();
      await expect(page.getByRole('complementary', { name: 'نقشه سفر', exact: true })).toHaveAttribute('data-map-itinerary', group.itinerary.itineraryId);
      await page.evaluate(async () => { await Promise.all(Array.from(document.images).map(image => image.decode().catch(() => undefined))); });
      expect(await page.evaluate(() => Array.from(document.images).filter(image => !image.complete || !image.naturalWidth).length)).toBe(0);
      expect(network.blocked).toEqual([]);

      const opening = hotelReply(page);
      await page.getByRole('button', { name: 'مقایسه اقامتگاه‌های مشهد', exact: true }).click();
      const initial = HotelSearchSnapshotSchema.parse(await (await opening).json()); snapshots.push(initial);
      const arrival = group.itinerary.outbound.segments.at(-1)!;
      expect(initial.query).toMatchObject({ checkIn: localDate(arrival.arrivalAt, arrival.arrivalTimeZone),
        checkOut: nextDay(localDate(arrival.arrivalAt, arrival.arrivalTimeZone)), rooms: 1, arrivalPlaceId: arrival.destinationPlaceId });
      const dialog = page.getByRole('dialog', { name: 'هتل‌های مشهد', exact: true }), map = dialog.locator('[data-hotel-map]');
      await hotelProjection(page, initial);
      await expect(map).toHaveAttribute('data-free-map-status', 'unavailable', { timeout: 30_000 });
      await expect(map.getByText('نقشه شهری در دسترس نیست.', { exact: true })).toBeVisible();
      expect(network.blocked.length).toBeGreaterThan(0);
      const capacityResponse = hotelReply(page);
      await dialog.getByRole('combobox', { name: 'ظرفیت اتاق', exact: true }).selectOption('2');
      const capacity = HotelSearchSnapshotSchema.parse(await (await capacityResponse).json()); snapshots.push(capacity);
      expect(capacity.query).toMatchObject({ checkIn: initial.query.checkIn, checkOut: initial.query.checkOut, rooms: 1, party: { adults: 2, children: 0, infants: 0 } });
      await hotelProjection(page, capacity);
      const coordinate = capacity.hotels[0]!.point;
      await dialog.getByRole('radio', { name: 'نزدیک به نقطه دلخواه', exact: true }).focus(); await page.keyboard.press('Space');
      await dialog.getByText('انتخاب با مختصات', { exact: true }).click();
      await dialog.getByRole('spinbutton', { name: 'عرض جغرافیایی نقطه مرجع', exact: true }).fill(String(coordinate.latitude));
      await dialog.getByRole('spinbutton', { name: 'طول جغرافیایی نقطه مرجع', exact: true }).fill(String(coordinate.longitude));
      const locationResponse = hotelReply(page);
      await dialog.getByRole('button', { name: 'اعمال نقطه مرجع', exact: true }).click();
      const located = HotelSearchSnapshotSchema.parse(await (await locationResponse).json()); snapshots.push(located);
      expect(located.query).toMatchObject({ sort: 'location-distance', customPoint: coordinate, party: { adults: 2, children: 0, infants: 0 }, checkIn: initial.query.checkIn, checkOut: initial.query.checkOut });
      hotelOrder(located); await hotelProjection(page, located);
      await expect(map).toHaveAttribute('data-free-map-status', 'unavailable');
      const hotel = dialog.locator('article[data-hotel-status="priced"]').first();
      const hotelId = (await hotel.getAttribute('data-hotel-id'))!;
      await hotel.locator('[data-hotel-card-select]').focus(); await page.keyboard.press('Enter');
      await expect(dialog.locator('[data-hotel-dialog]')).toHaveAttribute('data-selected-hotel-id', hotelId);
      await page.screenshot({ path: info.outputPath('offline-local-hotels-and-coordinate-fallback.png') });

      const preparedResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/referrals/prepare');
      const confirmedResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/referrals/confirm');
      const popupPending = page.waitForEvent('popup');
      await dialog.locator('[data-referral-source="hotel"]').getByRole('button', { name: /^رفتن به / }).click();
      const prepared = RecheckResultSchema.parse(await (await preparedResponse).json());
      expect(prepared.status).toBe('ready');
      if (prepared.status === 'unavailable') throw new Error('An eligible offline hotel quote must recheck locally');
      receipt = ReferralReceiptSchema.parse(await (await confirmedResponse).json()); exactReceipt(receipt, prepared.intent);
      expect(receipt.payload.kind).toBe('hotel');
      if (receipt.payload.kind !== 'hotel') throw new Error('Expected the exact local hotel receipt');
      expect(receipt.payload.quote.hotelId).toBe(hotelId); expect(receipt.payload.quote.query).toEqual(located.query);
      const popup = await popupPending;
      await expect.poll(() => network.blocked.filter(request => request.origin === 'https://zarei.xyz' && request.resourceType === 'document').length).toBe(1);
      expect(await popup.evaluate(() => window.opener === null)).toBe(true);
      await popup.close(); await page.bringToFront();
      await expect(page.locator('[data-provider-handoff-overlay]')).toHaveCount(0);
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('[data-hotel-dialog]')).toHaveAttribute('data-selected-hotel-id', hotelId);
      const history = await referralList(reviewer); expect(history.metrics.confirmed).toBe(1); expect(history.metrics.conversionReporting).toBe('not-reported');
      const detail = await contractResponse(await context.request.get('/api/v1/admin/referrals/' + receipt.referralId), AdminReferralDetailSchema);
      expect(detail.receipt).toEqual(receipt);
      await dialog.getByRole('button', { name: 'بستن', exact: true }).click();
      await expect(resultRegion(page)).toHaveAttribute('data-search-id', run.snapshot.searchId);
      await page.goto('/admin/referrals/' + receipt.referralId);
      await expect(page.getByRole('heading', { name: 'Referral trail', exact: true })).toBeVisible();
      await expect(page.getByText('Confirmed handoff', { exact: true })).toBeVisible();
      await page.screenshot({ path: info.outputPath('offline-confirmed-admin-trail.png') });
      expect(network.externalResponses).toEqual([]);
      expect(network.localAssetFailures).toEqual([]);
      expect(network.local.filter(request => request.method === 'POST' && request.pathname === '/api/v1/searches')).toHaveLength(1);
      rehearsalEvidence(info, 'offline-current-journey', { origin, browser: browser.version(), seed: reviewer.session.seed,
        fixtureAnchorInstant: reviewer.session.anchorInstant, dates, run, snapshots, receipt, detail, network,
        proofLimit: 'Browser HTTP requests outside the gateway were actually aborted, including hotel services and the authorized external placeholder. No placeholder page was fabricated. Local recheck and confirmation succeeded; external purchase/navigation completion is not claimed. Docker network isolation is separate root-owned evidence.' });
    } catch (error) {
      rehearsalEvidence(info, 'offline-partial', { origin, snapshots, receipt, network });
      throw error;
    }
  });

  test('@release-core resetting one newly owned reviewer preserves the other exact evidence', async ({ newReviewer, baseURL }, info) => {
    test.setTimeout(90_000); const origin = rehearsalOrigin(baseURL);
    const a = await newReviewer({ seed: 3332 }), b = await newReviewer({ seed: 3333 });
    const configA = await contractResponse(await a.context.request.get('/api/v1/admin/config'), AdminControlConfigSchema);
    const configB = await contractResponse(await b.context.request.get('/api/v1/admin/config'), AdminControlConfigSchema);
    await contractResponse(await a.context.request.patch('/api/v1/admin/providers/demo-provider-01', {
      data: { baseRevision: configA.revision, patch: { paused: true } },
    }), AdminControlConfigSchema);
    expect(configurationAuthority(await contractResponse(await b.context.request.get('/api/v1/admin/config'), AdminControlConfigSchema))).toEqual(configurationAuthority(configB));
    const [runA, runB] = await Promise.all([startApiSearch(a, queryFor()), startApiSearch(b, queryFor('flight', 'domestic', 'one-way', { destinationCityId: 'shiraz' }))]);
    expect(runA.snapshot.providerStatuses.find(provider => provider.providerId === 'demo-provider-01')?.status).toBe('paused');
    expect(runB.snapshot.providerStatuses.find(provider => provider.providerId === 'demo-provider-01')?.status).toBe('complete');
    const [hotelA, hotelB] = await Promise.all([
      a.context.request.post('/api/v1/hotel-searches', { data: arrivalStay(runA) }).then(response => contractResponse(response, HotelSearchSnapshotSchema, 201)),
      b.context.request.post('/api/v1/hotel-searches', { data: arrivalStay(runB) }).then(response => contractResponse(response, HotelSearchSnapshotSchema, 201)),
    ]);
    const receiptA = await receiptFor(a, runA), receiptB = await receiptFor(b, runB);
    const peerSearch = await readSearch(b, runB.snapshot.searchId);
    const foreignPaths = ['/searches/' + runA.snapshot.searchId, '/hotel-searches/' + hotelA.hotelSearchId, '/referrals/' + receiptA.referralId];
    for (const path of foreignPaths) expect((await b.context.request.get('/api/v1' + path)).status()).toBe(404);
    await resetReviewer(a);
    for (const path of foreignPaths) expect((await a.context.request.get('/api/v1' + path)).status()).toBe(404);
    expect(await readSearch(b, runB.snapshot.searchId)).toEqual(peerSearch);
    expect(await contractResponse(await b.context.request.get('/api/v1/hotel-searches/' + hotelB.hotelSearchId), HotelSearchSnapshotSchema)).toEqual(hotelB);
    expect(await contractResponse(await b.context.request.get('/api/v1/referrals/' + receiptB.referralId), ReferralReceiptSchema)).toEqual(receiptB);
    expect(configurationAuthority(await contractResponse(await b.context.request.get('/api/v1/admin/config'), AdminControlConfigSchema))).toEqual(configurationAuthority(configB));
    expect((await a.context.request.get('/api/v1/searches/' + runB.snapshot.searchId)).status()).toBe(404);
    await b.page.goto('/admin/searches/' + runB.snapshot.searchId);
    await expect(b.page.getByRole('heading', { name: 'Processing evidence', exact: true })).toBeVisible();
    await b.page.screenshot({ path: info.outputPath('peer-evidence-after-other-reset.png') });
    rehearsalEvidence(info, 'one-of-two-reset', { origin, a: { searchId: runA.snapshot.searchId, hotelSearchId: hotelA.hotelSearchId, receiptId: receiptA.referralId },
      b: { search: peerSearch, hotel: hotelB, receipt: receiptB, config: configB }, foreignReadStatus: 404, resetOwner: 'newly created reviewer A only',
      peerEvidenceStructurallyEqual: true, peerConfigurationExcludesOnlyMutableInactivityExpiry: true });
  });

  test('@release-lifecycle real API and stack restarts preserve evidence and expose explicit retry lineage', async ({ newReviewer, baseURL }, info) => {
    lifecycleNeedsConfiguration(info); test.setTimeout(360_000);
    const origin = rehearsalOrigin(baseURL), coordinator = lifecycleCoordinator(origin, info);
    const stable = await newReviewer({ seed: 3334 }), active = await newReviewer({ seed: 3335, scenario: 'slow-provider' });
    await waitReady(stable.context.request);
    const completed = await startApiSearch(stable, queryFor('flight', 'domestic', 'round-trip'));
    const hotel = await contractResponse(await stable.context.request.post('/api/v1/hotel-searches', { data: arrivalStay(completed) }), HotelSearchSnapshotSchema, 201);
    const receipt = await receiptFor(stable, completed), frozen = await readSearch(stable, completed.snapshot.searchId);
    let apiMayBeStopped = false, stackMayBeDown = false;
    const observations: Record<string, unknown> = {};
    try {
      await loadQuery(active, queryFor());
      const pending = active.page.waitForResponse(response => response.request().method() === 'POST'
        && new URL(response.url()).pathname === '/api/v1/searches');
      await active.page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true }).click();
      const initial = await responseSnapshot(await pending); expect(initial.snapshot.status).toBe('collecting');
      apiMayBeStopped = true;
      await coordinator.request('api-stop', { searchId: initial.snapshot.searchId, status: initial.snapshot.status, completedSearchId: frozen.snapshot.searchId });
      observations.apiDownStatus = await waitDown(active.context.request);
      await expect(resultRegion(active.page)).toHaveAttribute('data-search-id', initial.snapshot.searchId);
      await expect(resultRegion(active.page)).toHaveAttribute('data-connection-state', /recovering|snapshot-only|unavailable/);
      await expect(active.page.getByRole('combobox', { name: 'مقصد', exact: true })).toHaveValue('مشهد');
      await coordinator.request('api-start', { interruptedSearchId: initial.snapshot.searchId });
      await waitReady(active.context.request); apiMayBeStopped = false;
      const interrupted = await waitForSearch(active, initial.snapshot.searchId);
      expect(interrupted.snapshot.status).toBe('interrupted');
      await expect(resultRegion(active.page)).toHaveAttribute('data-status', 'interrupted', { timeout: 30_000 });
      const freshLabel = interrupted.snapshot.groups.length ? 'مقایسه تازه با شرایط فرم' : 'تلاش دوباره';
      const fresh = await runSearch(active, () => resultRegion(active.page).getByRole('button', { name: freshLabel, exact: true }).click());
      expect(fresh.snapshot.searchId).not.toBe(initial.snapshot.searchId); expect(fresh.snapshot.query).toEqual(initial.snapshot.query);
      expect(fresh.snapshot.status).toBe('complete');
      const retryInitial = await responseSnapshot(await active.context.request.post('/api/v1/searches/' + initial.snapshot.searchId + '/retry', { data: { clientGeneration: 't33-retry-' + randomUUID() } }));
      expect(retryInitial.snapshot.predecessorSearchId).toBe(initial.snapshot.searchId);
      expect(retryInitial.snapshot.searchId).not.toBe(initial.snapshot.searchId);
      const retried = await waitForSearch(active, retryInitial.snapshot.searchId);
      expect(retried.snapshot.status).toBe('complete'); expect(retried.snapshot.query).toEqual(interrupted.snapshot.query);
      expect(await readSearch(active, initial.snapshot.searchId)).toEqual(interrupted);

      await active.page.goto('/admin/searches/' + initial.snapshot.searchId);
      await expect(active.page.getByRole('heading', { name: 'Processing evidence', exact: true })).toBeVisible();
      const replayResponse = active.page.waitForResponse(response => response.request().method() === 'POST'
        && new URL(response.url()).pathname === '/api/v1/admin/searches/' + initial.snapshot.searchId + '/replay');
      await active.page.getByRole('button', { name: 'Replay with current settings', exact: true }).click();
      const replayInitial = await responseSnapshot(await replayResponse);
      expect(replayInitial.snapshot.predecessorSearchId).toBe(initial.snapshot.searchId);
      await expect(active.page).toHaveURL(origin + '/admin/searches/' + replayInitial.snapshot.searchId);
      const replayed = await waitForSearch(active, replayInitial.snapshot.searchId); expect(replayed.snapshot.status).toBe('complete');
      expect(await readSearch(stable, frozen.snapshot.searchId)).toEqual(frozen);
      expect(await contractResponse(await stable.context.request.get('/api/v1/referrals/' + receipt.referralId), ReferralReceiptSchema)).toEqual(receipt);

      stackMayBeDown = true;
      await coordinator.request('stack-down', { completedSearchId: frozen.snapshot.searchId, receiptId: receipt.referralId, hotelSearchId: hotel.hotelSearchId });
      observations.stackDownStatus = await waitDown(stable.context.request);
      await coordinator.request('stack-up-no-build', { preserveVolume: true, completedSearchId: frozen.snapshot.searchId });
      await waitReady(stable.context.request); stackMayBeDown = false;
      expect(await readSearch(stable, frozen.snapshot.searchId)).toEqual(frozen);
      expect(await contractResponse(await stable.context.request.get('/api/v1/hotel-searches/' + hotel.hotelSearchId), HotelSearchSnapshotSchema)).toEqual(hotel);
      expect(await contractResponse(await stable.context.request.get('/api/v1/referrals/' + receipt.referralId), ReferralReceiptSchema)).toEqual(receipt);
      expect(await readSearch(active, initial.snapshot.searchId)).toEqual(interrupted);
      expect(await readSearch(active, retried.snapshot.searchId)).toEqual(retried);
      expect(await readSearch(active, replayed.snapshot.searchId)).toEqual(replayed);
      await active.page.reload();
      await expect(active.page.getByRole('heading', { name: 'Processing evidence', exact: true })).toBeVisible();
      await active.page.screenshot({ path: info.outputPath('persisted-admin-evidence-after-stack-restart.png') });
      rehearsalEvidence(info, 'actual-lifecycle', { origin, project: coordinator.project, observations, frozen, hotel, receipt, initial, interrupted,
        travelerFreshComparison: { actionLabel: freshLabel, recovery: fresh }, explicitApiRetry: retried, adminReplay: replayed,
        proofLimit: 'Root executed the actual owned Docker operations; the browser independently observed downtime and persistence. Traveler new-comparison behavior is distinct from the explicit linked API retry/admin replay. The same owned volume and cookie jars were retained.' });
    } finally {
      if (stackMayBeDown) { await coordinator.request('stack-up-no-build', { cleanup: true }); await waitReady(stable.context.request); }
      else if (apiMayBeStopped) { await coordinator.request('api-start', { cleanup: true }); await waitReady(stable.context.request); }
    }
  });
});
