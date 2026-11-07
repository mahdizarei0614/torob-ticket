import type { APIRequestContext, Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  AdminControlConfigSchema, HotelSearchSnapshotSchema, RecheckResultSchema,
  ReferralReceiptSchema, SearchRecoverySchema, SessionInfoSchema,
  type DemoScenario, type SearchRecovery, type TransportSearchQuery,
} from '@torob-ticket/contracts';
import {
  test as ownedTest, expect, loadQuery, priceCards, readSearch, resultRegion,
  runSearch, type OwnedReviewer,
} from '../fixtures';
import { exactReceipt, expectPlaceholder, interceptPlaceholder, localDate, nextDay, referralList, scenarioQuote } from './acceptance/journey-helpers';

const evidence = resolve(process.env.M6_EVIDENCE_DIR ?? '.local/evidence/M6/browser');
mkdirSync(evidence, { recursive: true });
const query: TransportSearchQuery = { mode: 'flight', scope: 'domestic', tripType: 'one-way', originCityId: 'tehran', destinationCityId: 'mashhad', departureDate: '2026-10-25', party: { adults: 1, children: 0, infants: 0 }, classCode: 'economy', filters: {}, sort: 'cheapest' };
const test = ownedTest.extend<{ owner: OwnedReviewer }>({
  owner: async ({ newReviewer }, use) => { await use(await newReviewer({ seed: 6028, anchorInstant: '2026-10-25T00:00:00Z' })); },
});
const region = resultRegion;
const faNumber = (value: number) => new Intl.NumberFormat('fa-IR').format(value);
function record(name: string, value: unknown) { writeFileSync(resolve(evidence, name + '.json'), JSON.stringify(value, null, 2) + '\n'); }

async function setProfile(api: APIRequestContext, scenario: DemoScenario) {
  const current = await api.get('/api/v1/admin/config'); expect(current.status()).toBe(200);
  const config = AdminControlConfigSchema.parse(await current.json());
  const response = await api.post('/api/v1/admin/scenario', { data: { baseRevision: config.revision, scenario } }); expect(response.status()).toBe(201);
  return AdminControlConfigSchema.parse(await response.json());
}
async function begin(owner: OwnedReviewer, scenario: DemoScenario = 'normal', patch: Partial<TransportSearchQuery> = {}): Promise<SearchRecovery> {
  if (scenario !== 'normal') owner.session = (await setProfile(owner.context.request, scenario)).session;
  await loadQuery(owner, { ...query, ...patch });
  const pending = owner.page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/v1/searches');
  await owner.page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true }).click();
  const response = await pending; expect(response.status()).toBe(201);
  const initial = SearchRecoverySchema.parse(await response.json());
  await expect(region(owner.page)).toHaveAttribute('data-search-id', initial.snapshot.searchId);
  return initial;
}
async function complete(owner: OwnedReviewer, id: string, status = 'complete'): Promise<SearchRecovery> {
  await expect(region(owner.page)).toHaveAttribute('data-status', status, { timeout: 30_000 });
  const result = await readSearch(owner, id); expect(result.snapshot.status).toBe(status); return result;
}
async function chooseScenarioSeller(owner: OwnedReviewer, result: SearchRecovery) {
  const quote = scenarioQuote(result.snapshot);
  const card = priceCards(owner.page).locator(`xpath=self::article[@data-quote-id="${quote.quoteId}"]`);
  await card.locator('[data-card-select]').click(); await expect(card).toHaveAttribute('data-selected', 'true');
  await expect(card).toHaveAttribute('data-amount-rial', String(quote.total.amountRial));
  return { quote, card, action: card.locator(`[data-seller-link-quote-id="${quote.quoteId}"]`) };
}
async function checkCoverage(page: Page, result: SearchRecovery): Promise<void> {
  const successful = new Set(result.snapshot.coverage.successfulProviderIds).size;
  await expect(region(page).getByRole('heading', { name: new RegExp('^مقایسه پروازها.*' + faNumber(successful) + ' فروشنده') })).toBeVisible();
  const failed = new Set(result.snapshot.coverage.failedProviderIds).size;
  if (failed) await expect(region(page).getByRole('status').filter({ hasText: faNumber(failed) + ' فروشنده در دسترس نیست' })).toBeVisible();
  else await expect(region(page).getByRole('status').filter({ hasText: 'فروشنده در دسترس نیست' })).toHaveCount(0);
  expect(result.snapshot.providerStatuses.every(provider => !['pending', 'running'].includes(provider.status))).toBe(true);
}

test('@recovery unsupported URL retains the requested trip and never silently searches a different route', async ({ owner }) => {
  const { page } = owner; let writes = 0;
  page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/api/v1/searches')) writes++; });
  await page.goto('/?q=' + encodeURIComponent(JSON.stringify({ ...query, destinationCityId: 'istanbul', departureDate: '2026-10-29', party: { adults: 3, children: 0, infants: 0 } })));
  await expect(page.getByRole('combobox', { name: 'مقصد', exact: true })).toHaveValue('استانبول');
  await expect(page.getByRole('spinbutton', { name: 'تعداد بزرگسال', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true })).toHaveAttribute('data-invalid', 'true');
  expect(writes).toBe(0);
});

for (const scenario of ['normal', 'slow-provider', 'provider-timeout', 'conflicting-data'] as const) test(`@recovery ${scenario} preserves actual provider coverage and offers explicit recovery`, async ({ owner }) => {
  const { page } = owner, initial = await begin(owner, scenario);
  if (scenario === 'slow-provider') { await expect(priceCards(page).first()).toBeVisible(); await expect(region(page)).toHaveAttribute('data-status', 'collecting'); }
  const result = await complete(owner, initial.snapshot.searchId, scenario === 'provider-timeout' ? 'partial' : 'complete');
  expect(await priceCards(page).count()).toBeGreaterThan(0); await checkCoverage(page, result);
  if (scenario === 'provider-timeout') {
    expect(result.snapshot.providerStatuses.some(provider => provider.status === 'timeout')).toBe(true);
    expect(result.snapshot.coverage.failedProviderIds.length).toBeGreaterThan(0);
  } else expect(result.snapshot.coverage.failedProviderIds).toEqual([]);
  await expect(page.getByRole('combobox', { name: 'مقصد', exact: true })).toHaveValue('مشهد');
  expect(result.snapshot.query.party).toEqual({ adults: 1, children: 0, infants: 0 });
  record('coverage-' + scenario, { session: owner.session, initial, result });
});

test('@recovery price-change requires explicit acceptance and handoff uses the accepted version', async ({ owner }) => {
  const { page } = owner, attempts = await interceptPlaceholder(owner);
  const initial = await begin(owner, 'price-change', { filters: { providerIds: ['demo-provider-04'] } });
  const result = await complete(owner, initial.snapshot.searchId), selected = await chooseScenarioSeller(owner, result);
  const preparedResponse = page.waitForResponse(response => response.url().endsWith('/api/v1/referrals/prepare'));
  await selected.action.click();
  const recheck = RecheckResultSchema.parse(await (await preparedResponse).json()); expect(recheck.status).toBe('changed');
  if (recheck.status !== 'changed') throw new Error('Expected the actual authored service-zero changed fare');
  await expect(page.locator('[data-referral-phase]')).toHaveAttribute('data-referral-phase', 'changed');
  expect((await referralList(owner)).metrics.confirmed).toBe(0);
  const confirmed = page.waitForResponse(response => response.url().endsWith('/api/v1/referrals/confirm'));
  const popup = await expectPlaceholder(page, () => page.getByRole('button', { name: 'پذیرش نسخه تازه و ادامه', exact: true }).click());
  const receipt = ReferralReceiptSchema.parse(await (await confirmed).json()); exactReceipt(receipt, recheck.intent);
  expect(receipt.payload.kind).toBe('transport');
  if (receipt.payload.kind !== 'transport') throw new Error('Expected exact transport handoff evidence');
  expect(receipt.selection.quoteVersion).toBe(selected.quote.version + 1); expect(receipt.payload.quote.total.amountRial).toBeGreaterThan(selected.quote.total.amountRial);
  expect(receipt.payload.quote.party).toEqual(query.party); expect(attempts).toEqual(['https://zarei.xyz/']);
  await expect(region(page)).toHaveAttribute('data-search-id', result.snapshot.searchId);
  expect((await readSearch(owner, result.snapshot.searchId)).snapshot).toEqual(result.snapshot);
  await popup.close(); await page.bringToFront();
  expect((await referralList(owner)).metrics.confirmed).toBe(1);
  record('price-change', { original: selected.quote, recheck, receipt, attempts, proofLimit: 'Only approved placeholder navigation is intercepted; real local recheck, explicit acceptance and immutable receipt are verified. No purchase or live provider is exercised.' });
});

test('@recovery sold-out offers actual same-trip alternatives without changing the trip', async ({ owner }) => {
  const { page } = owner, attempts = await interceptPlaceholder(owner);
  const initial = await begin(owner, 'sold-out', { filters: { providerIds: ['demo-provider-04'] } });
  const result = await complete(owner, initial.snapshot.searchId), selected = await chooseScenarioSeller(owner, result);
  const prepared = page.waitForResponse(response => response.url().endsWith('/api/v1/referrals/prepare'));
  await selected.action.click(); const unavailable = RecheckResultSchema.parse(await (await prepared).json()); expect(unavailable.status).toBe('unavailable');
  if (unavailable.status !== 'unavailable') throw new Error('Expected the authored service-zero sold-out response');
  await expect(page.locator('[data-referral-phase]')).toHaveAttribute('data-referral-phase', 'unavailable');
  expect(unavailable.alternativeQuoteIds.length).toBeGreaterThan(0); expect((await referralList(owner)).metrics.confirmed).toBe(0);
  const alternative = page.getByRole('dialog', { name: 'ادامه با فروشنده', exact: true }).getByRole('button', { name: /تومان/ }).first(); await expect(alternative).toBeEnabled();
  const alternativePrepare = page.waitForResponse(response => response.url().endsWith('/api/v1/referrals/prepare'));
  const confirmed = page.waitForResponse(response => response.url().endsWith('/api/v1/referrals/confirm'));
  const popup = await expectPlaceholder(page, () => alternative.click());
  const recheck = RecheckResultSchema.parse(await (await alternativePrepare).json()); expect(recheck.status).toBe('ready');
  if (recheck.status !== 'ready') throw new Error('The chosen actual alternative must pass its own fresh recheck');
  const receipt = ReferralReceiptSchema.parse(await (await confirmed).json()); exactReceipt(receipt, recheck.intent);
  expect(receipt.payload.kind).toBe('transport');
  if (receipt.payload.kind !== 'transport') throw new Error('Expected exact transport alternative evidence');
  expect(unavailable.alternativeQuoteIds).toContain(receipt.selection.quoteId); expect(receipt.selection.quoteId).not.toBe(selected.quote.quoteId);
  expect(receipt.payload.quote.party).toEqual(query.party); expect(attempts).toEqual(['https://zarei.xyz/']);
  await expect(region(page)).toHaveAttribute('data-search-id', result.snapshot.searchId); expect((await readSearch(owner, result.snapshot.searchId)).snapshot.query).toEqual(result.snapshot.query);
  await popup.close(); await page.bringToFront();
  record('sold-out', { original: selected.quote, unavailable, recheck, receipt, attempts, proofLimit: 'Placeholder navigation is intercepted; the unavailable result, offered alternative IDs and fresh local alternative recheck/receipt are real.' });
});

test('@recovery no-eligible-results exposes explicit intent-preserving actions', async ({ owner }) => {
  const { page } = owner, initial = await begin(owner, 'no-eligible-results'), result = await complete(owner, initial.snapshot.searchId, 'empty');
  expect(result.snapshot.coverage.complete).toBe(true); expect(result.snapshot.coverage.failedProviderIds).toEqual([]);
  await expect(region(page).locator('[data-results-empty="no-match"]')).toBeVisible();
  await expect(region(page).getByRole('button', { name: 'بررسی تاریخ دیگر', exact: true })).toBeVisible();
  const before = page.url(); await region(page).getByRole('button', { name: 'تغییر شرایط سفر', exact: true }).click();
  expect(page.url()).toBe(before); await expect(page.getByRole('combobox', { name: 'مقصد', exact: true })).toHaveValue('مشهد');
  expect(result.snapshot.query.party).toEqual(query.party); await expect(page.getByRole('spinbutton', { name: 'تعداد بزرگسال', exact: true })).toHaveCount(0);
});

test('@recovery chosen filter relaxation removes only that filter', async ({ owner }) => {
  const { page } = owner, initial = await begin(owner, 'normal', { filters: { refundableOnly: true, budgetMaxRial: 1 }, party: { adults: 3, children: 0, infants: 0 } });
  await complete(owner, initial.snapshot.searchId, 'empty');
  const relaxed = await runSearch(owner, () => region(page).getByRole('button', { name: 'حذف استرداد', exact: true }).click());
  expect(relaxed.snapshot.query).toEqual({ ...query, filters: { budgetMaxRial: 1 } });
  expect(JSON.parse(new URL(page.url()).searchParams.get('q')!)).toEqual(relaxed.snapshot.query);
  expect(relaxed.snapshot.status).toBe('empty');
  record('filter-relaxation', { initial, relaxed, normalizedParty: query.party, retainedOtherFilter: 'budgetMaxRial' });
});

test('@recovery broken SSE with working REST never claims the connection is live', async ({ owner }) => {
  const { page } = owner; let streams = 0, reads = 0;
  await page.route('**/api/v1/searches/*/events', async route => { streams++; await route.abort('failed'); });
  page.on('request', request => { if (request.method() === 'GET' && /\/api\/v1\/searches\/[^/?]+$/.test(request.url())) reads++; });
  const initial = await begin(owner, 'slow-provider'), result = await complete(owner, initial.snapshot.searchId);
  expect(streams).toBeGreaterThan(0); expect(reads).toBeGreaterThan(0); expect(await region(page).getAttribute('data-connection-state')).not.toBe('live');
  expect(result.snapshot.coverage.failedProviderIds).toEqual([]); await checkCoverage(page, result);
  record('sse-rest-recovery', { streams, reads, result, connection: await region(page).getAttribute('data-connection-state'), fault: 'Only actual SSE HTTP transport connections are aborted; REST and provider inventory remain real.' });
});

test('@recovery another-tab configuration change preserves arrival-derived one-night stay and chosen capacity but revokes quote authority', async ({ owner }) => {
  const { page } = owner, initial = await begin(owner, 'normal', { party: { adults: 3, children: 2, infants: 0, childAges: [5, 8] } });
  const result = await complete(owner, initial.snapshot.searchId); expect(result.snapshot.query.party).toEqual(query.party);
  const card = priceCards(page).first(); await card.locator('[data-card-select]').click();
  const selectedQuote = await card.getAttribute('data-quote-id'), group = result.snapshot.groups.find(group => group.eligibleQuotes.some(quote => quote.quoteId === selectedQuote))!;
  const arrival = group.itinerary.outbound.segments.at(-1)!;
  const opening = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/api/v1/hotel-searches'));
  await page.getByRole('button', { name: 'مقایسه اقامتگاه‌های مشهد', exact: true }).click();
  const firstStay = HotelSearchSnapshotSchema.parse(await (await opening).json()), dialog = page.getByRole('dialog', { name: 'هتل‌های مشهد', exact: true });
  expect(firstStay.query).toMatchObject({ checkIn: localDate(arrival.arrivalAt, arrival.arrivalTimeZone), checkOut: nextDay(localDate(arrival.arrivalAt, arrival.arrivalTimeZone)), rooms: 1, party: query.party, arrivalPlaceId: arrival.destinationPlaceId });
  const capacity = dialog.getByRole('combobox', { name: 'ظرفیت اتاق', exact: true });
  const changedStay = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/api/v1/hotel-searches'));
  await capacity.selectOption('3'); const stay = HotelSearchSnapshotSchema.parse(await (await changedStay).json());
  expect(stay.query).toMatchObject({ checkIn: firstStay.query.checkIn, checkOut: firstStay.query.checkOut, rooms: 1, party: { adults: 3, children: 0, infants: 0 } });
  await expect(dialog.getByRole('region', { name: 'نتایج مقایسه اقامتگاه‌ها', exact: true })).toHaveAttribute('data-hotel-search-id', stay.hotelSearchId);
  await expect(dialog.locator('input:not([type=radio])')).toHaveCount(0);
  await setProfile(owner.context.request, 'provider-timeout'); await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('main[data-authority-current]')).toHaveAttribute('data-authority-current', 'false');
  const model = dialog.locator('[data-hotel-dialog]'); await expect(model).toHaveAttribute('data-hotel-stale', 'true');
  await expect(model).toHaveAttribute('data-hotel-check-in', stay.query.checkIn); await expect(model).toHaveAttribute('data-hotel-check-out', stay.query.checkOut);
  await expect(capacity).toHaveValue('3'); await expect(capacity).toBeDisabled();
  await page.screenshot({ path: resolve(evidence, 'retained-hotel-edits.png'), fullPage: false });
  await dialog.getByRole('button', { name: 'بستن', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'مقصد', exact: true })).toHaveValue('مشهد'); await expect(region(page)).toHaveAttribute('data-historical', 'true');
  await expect(priceCards(page).first().locator('[data-card-select]')).toBeDisabled();
  record('retained-hotel-edits', { result, firstStay, stay, preservedCapacity: 3, arrival: { placeId: arrival.destinationPlaceId, at: arrival.arrivalAt, timeZone: arrival.arrivalTimeZone }, replacement: 'Manual stay/room/child fields are replaced by actual arrival-local one-night evidence and the supported capacity selector.' });
});

function ownedApi() {
  const project = process.env.M6_STACK_PROJECT; if (project !== 'torobticket-m6') throw new Error('Requires exact root-owned M6 stack');
  const args = ['compose', '-p', project, '-f', 'compose.yaml', '-f', 'tests/e2e/fixtures/compose.m6-owned.yaml'];
  const id = execFileSync('docker', [...args, 'ps', '-q', 'api'], { encoding: 'utf8' }).trim();
  const rows = JSON.parse(execFileSync('docker', ['inspect', id], { encoding: 'utf8' }));
  if (rows[0]?.Config.Labels['torobticket.owner'] !== 'm6' || rows[0]?.Config.Labels['com.docker.compose.project'] !== project) throw new Error('Owned API identity mismatch');
  return args;
}

test('@recovery genuine expired session preserves intent and resumes only through explicit action', async ({ owner }) => {
  test.skip(process.env.M6_STACK_PROJECT !== 'torobticket-m6', 'Requires root-owned isolated database');
  const { page, context } = owner, initial = await begin(owner, 'normal', { party: { adults: 3, children: 0, infants: 0 } });
  const result = await complete(owner, initial.snapshot.searchId), args = ownedApi(); expect(result.snapshot.query.party).toEqual(query.party);
  const token = (await context.cookies()).find(cookie => cookie.name === 'torob_demo')?.value; if (!token) throw new Error('Expected owned session cookie');
  const hash = createHash('sha256').update(token).digest('hex');
  const sql = `WITH changed AS (UPDATE "DemoSession" SET "expiresAt"='2000-01-01T00:00:00Z' WHERE "credentialHash"='${hash}' RETURNING id) SELECT count(*) FROM changed;`;
  const affected = execFileSync('docker', [...args, 'exec', '-T', 'database', 'psql', '-U', 'torobticket', '-d', 'torobticket', '-Atc', sql], { encoding: 'utf8' }).trim(); expect(affected).toBe('1');
  await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await expect(page.locator('main[data-session-expired]')).toHaveAttribute('data-session-expired', 'true');
  await expect(page.getByRole('combobox', { name: 'مقصد', exact: true })).toHaveValue('مشهد');
  await page.getByRole('button', { name: 'بازیابی نشست و حفظ فرم', exact: true }).first().click();
  await expect(page.locator('main[data-session-expired]')).toHaveAttribute('data-session-expired', 'false'); await expect(page.getByRole('combobox', { name: 'مقصد', exact: true })).toHaveValue('مشهد');
  expect(JSON.parse(new URL(page.url()).searchParams.get('q')!).party).toEqual(query.party);
});

test('@recovery actual owned API crash/restart preserves the trip and exposes interrupted recovery', async ({ owner }) => {
  test.skip(process.env.M6_STACK_PROJECT !== 'torobticket-m6', 'Requires root-owned isolated API'); test.setTimeout(90_000);
  const { page } = owner, initial = await begin(owner, 'slow-provider'), args = ownedApi();
  try {
    execFileSync('docker', [...args, 'kill', '-s', 'SIGKILL', 'api'], { stdio: 'pipe' });
    await expect(region(page)).toHaveAttribute('data-connection-state', /recovering|snapshot-only|unavailable/, { timeout: 15_000 }); await expect(page.getByRole('combobox', { name: 'مقصد', exact: true })).toHaveValue('مشهد');
  } finally { execFileSync('docker', [...args, 'start', 'api'], { stdio: 'pipe' }); }
  await expect.poll(async () => { try { return (await owner.context.request.get('/api/health/ready', { timeout: 5000 })).status(); } catch { return 0; } }, { timeout: 30_000 }).toBe(200);
  const old = await complete(owner, initial.snapshot.searchId, 'interrupted');
  const fresh = await runSearch(owner, () => region(page).getByRole('button', { name: 'مقایسه تازه با شرایط فرم', exact: true }).click());
  expect(fresh.snapshot.searchId).not.toBe(initial.snapshot.searchId); expect(fresh.snapshot.status).toBe('complete');
  expect((await readSearch(owner, initial.snapshot.searchId)).snapshot).toEqual(old.snapshot);
  record('owned-api-restart', { searchId: initial.snapshot.searchId, status: old.snapshot.status, freshSearchId: fresh.snapshot.searchId, project: 'torobticket-m6' });
});

test('@recovery same-stamp legacy reset revokes retained quotes while preserving unsaved edits', async ({ owner }) => {
  const { page, context } = owner, initial = await begin(owner, 'normal', { party: { adults: 3, children: 0, infants: 0 } });
  const result = await complete(owner, initial.snapshot.searchId); expect(result.snapshot.query.party).toEqual(query.party);
  const destination = page.getByRole('combobox', { name: 'مقصد', exact: true }); await destination.fill('شیراز'); await page.getByRole('option', { name: 'شیراز', exact: true }).click(); await expect(destination).toHaveValue('شیراز');
  let starts = 0; page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/api/v1/searches')) starts++; });
  const response = await context.request.post('/api/v1/demo/reset', { data: {} }); expect(response.status()).toBe(201); owner.session = SessionInfoSchema.parse(await response.json());
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('main[data-authority-current]')).toHaveAttribute('data-authority-current', 'false'); await expect(region(page)).toHaveAttribute('data-historical', 'true');
  await expect(region(page)).toHaveAttribute('data-search-id', result.snapshot.searchId); await expect(destination).toHaveValue('شیراز');
  await expect(priceCards(page).first().locator('[data-card-select]')).toBeDisabled();
  expect((await context.request.get('/api/v1/searches/' + result.snapshot.searchId)).status()).toBe(404); expect(starts).toBe(0);
  record('same-stamp-reset', { retainedSearchId: result.snapshot.searchId, unsavedDestination: 'shiraz', oldEvidenceStatus: 404, starts, normalizedCommittedParty: result.snapshot.query.party });
});
