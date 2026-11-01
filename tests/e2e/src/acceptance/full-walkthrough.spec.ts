import {
  AdminSearchInspectionSchema, CatalogSnapshotSchema, DemoAuthStateSchema,
  HotelSearchSnapshotSchema, MappingAppliedSchema, MappingImpactPreviewSchema,
  MappingWorkspaceSchema, RecheckResultSchema, ReferralReceiptSchema,
  SavedSearchSchema, SearchRecoverySchema, type HotelSearchSnapshot, type MappingPatch,
} from '@torob-ticket/contracts';
import {
  test, expect, loadQuery, priceCards, queryFor, readSearch, resultRegion,
  runSearch, startApiSearch, waitForSearch, writeEvidence,
} from '../../fixtures';
import {
  confirmation, confirm, contractResponse, exactReceipt, expectPlaceholder,
  hotelOrder, hotelProjection, interceptPlaceholder, localDate, nextDay, prepare, referralDetail, referralList,
  scenarioQuote,
} from './journey-helpers';

// The acceptance evidence contains public contracts only, never session-bearing traces.
test.use({ trace: 'off' });

test.describe('@acceptance @full-walkthrough current cross-feature journeys', () => {
  test('guest comparison, compact identity, exact handoff and actual admin trail retain one authority', async ({ reviewer }, info) => {
    test.setTimeout(90_000);
    const { page, context } = reviewer;
    const attempts = await interceptPlaceholder(reviewer);
    const query = queryFor('flight', 'domestic', 'round-trip');
    await loadQuery(reviewer, query);
    const run = await runSearch(reviewer);
    expect(run.snapshot.status).toBe('complete');
    // Selection is expressed on the native card, independently of decorative motion.
    const card = priceCards(page).locator('xpath=self::*[@data-selected="true"]');
    await expect(card).toHaveCount(1);
    const quoteId = (await card.getAttribute('data-quote-id'))!;
    const original = run.snapshot.groups.flatMap(group => group.eligibleQuotes).find(quote => quote.quoteId === quoteId)!;
    expect(original).toBeDefined();
    const map = page.getByRole('complementary', { name: 'نقشه سفر', exact: true });
    const itineraryId = (await map.getAttribute('data-map-itinerary'))!;
    expect(itineraryId).toBeTruthy();
    const posts: string[] = [], savedReads: string[] = [];
    page.on('request', request => {
      const path = new URL(request.url()).pathname;
      if (request.method() === 'POST') posts.push(path);
      if (request.method() === 'GET' && path === '/api/v1/saved-searches') savedReads.push(path);
    });
    const account = page.getByRole('dialog', { name: 'حساب کاربری', exact: true });
    const trigger = page.getByRole('button', { name: 'حساب کاربری', exact: true });
    async function openProfile() {
      await trigger.scrollIntoViewIfNeeded();
      await trigger.click({ timeout: 10_000 });
      try { await expect(account).toBeVisible({ timeout: 8_000 }); }
      catch (error) {
        writeEvidence(info, 'profile-open-public-state', await page.evaluate(() => {
          const trigger = document.querySelector<HTMLElement>('[data-profile-trigger]');
          return { visibility: document.visibilityState, triggerExpanded: trigger?.getAttribute('aria-expanded'), triggerDisabled: trigger?.getAttribute('aria-disabled'), activeLabel: document.activeElement?.getAttribute('aria-label'), popoverCount: document.querySelectorAll('[data-profile-popover]').length, dialogNames: Array.from(document.querySelectorAll('[role="dialog"]')).map(dialog => ({ label: dialog.getAttribute('aria-label'), text: dialog.textContent?.slice(0, 600) })) };
        }));
        await page.screenshot({ path: info.outputPath('profile-open-public-state.png') });
        throw error;
      }
    }
    await openProfile();
    await account.getByRole('button', { name: 'ادامه با ترب', exact: true }).click();
    await expect(account.getByRole('button', { name: 'خروج از حساب', exact: true })).toBeEnabled();
    const legacy = await contractResponse(await context.request.post('/api/v1/saved-searches', { data: { name: 'سفر مشهد', query } }), SavedSearchSchema, 201);
    await account.getByRole('button', { name: 'بستن حساب کاربری', exact: true }).click();
    await expect(account).toHaveCount(0);
    await openProfile();
    await expect(account.getByRole('button')).toHaveCount(2);
    await expect(account.locator('[data-saved-search-id]')).toHaveCount(0);
    await expect(account.getByRole('button', { name: /ذخیره/ })).toHaveCount(0);
    await account.getByRole('button', { name: 'خروج از حساب', exact: true }).click();
    await expect(account.getByRole('button', { name: 'ادامه با ترب', exact: true })).toBeEnabled();
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
    expect((await contractResponse(await context.request.get('/api/v1/auth/demo'), DemoAuthStateSchema)).identity).toBeNull();
    expect(savedReads).toEqual([]);
    expect(posts.filter(path => /searches$/.test(path))).toEqual([]);
    await expect(resultRegion(page)).toHaveAttribute('data-search-id', run.snapshot.searchId);
    await expect(map).toHaveAttribute('data-map-itinerary', itineraryId);

    const prepared = page.waitForResponse(response => response.url().endsWith('/api/v1/referrals/prepare'));
    const confirmed = page.waitForResponse(response => response.url().endsWith('/api/v1/referrals/confirm'));
    const popup = await expectPlaceholder(page, () => card.locator(`[data-seller-link-quote-id="${quoteId}"]`).click());
    const recheck = RecheckResultSchema.parse(await (await prepared).json());
    expect(recheck.status).toBe('ready');
    if (recheck.status === 'unavailable') throw new Error('A normal guest quote must recheck');
    const receipt = ReferralReceiptSchema.parse(await (await confirmed).json());
    exactReceipt(receipt, recheck.intent);
    expect(receipt.payload.quote.total).toEqual(original.total);
    expect(receipt.payload.quote.breakdown).toEqual(original.breakdown);
    expect(receipt.payload.kind).toBe('transport');
    if (receipt.payload.kind === 'transport') {
      expect(receipt.payload.quote.party).toEqual(query.party);
      expect(receipt.payload.quote.conditions).toEqual(original.conditions);
      expect(receipt.payload.itinerary.return).toBeDefined();
    }
    expect(attempts).toEqual(['https://zarei.xyz/']);
    await expect(resultRegion(page)).toHaveAttribute('data-search-id', run.snapshot.searchId);
    await expect(card).toHaveAttribute('data-selected', 'true');
    await popup.close();
    await page.bringToFront();
    const detail = await referralDetail(reviewer, receipt.referralId);
    expect(detail.receipt).toEqual(receipt);
    expect(detail.originSearchId).toBe(run.snapshot.searchId);
    expect(detail.sourceSearch).toEqual(run.snapshot);
    expect(detail.sourceQuote).toEqual(original);
    expect(detail.rawTotal).toBeGreaterThan(0);
    expect(detail.events.some(event => event.kind === 'referral-confirmed')).toBe(true);

    // Explicit legacy receipt navigation verifies its retained read-only route.
    const beforeReads = posts.length;
    await page.goto(receipt.handoffPath);
    await expect(page.getByText('ارجاع به فروشنده ثبت شد', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText('ارجاع به فروشنده ثبت شد', { exact: true })).toBeVisible();
    expect(posts.slice(beforeReads)).toEqual([]);
    await page.getByRole('button', { name: 'بازگشت به مقایسه سفر', exact: true }).click();
    await expect(page.getByText('زمینه این مقایسه در دسترس نیست. از یک مقایسه تازه شروع کنید.', { exact: true })).toBeVisible();
    expect(posts.slice(beforeReads).filter(path => /searches|referrals/.test(path))).toEqual([]);
    await page.goto('/admin/referrals/' + receipt.referralId);
    await expect(page.getByRole('heading', { name: 'Referral trail', exact: true })).toBeVisible();
    await expect(page.getByText('Confirmed handoff', { exact: true })).toBeVisible();
    await page.getByText('Exact immutable handoff payload', { exact: true }).click();
    await expect(page.locator('details').filter({ has: page.getByText('Exact immutable handoff payload', { exact: true }) }).locator('pre')).toContainText(receipt.referralId);
    const list = await referralList(reviewer);
    expect(list.metrics.confirmed).toBe(1);
    expect(list.metrics.conversionReporting).toBe('not-reported');
    await page.screenshot({ path: info.outputPath('admin-referral-trail.png') });
    writeEvidence(info, 'guest-identity-referral', { searchId: run.snapshot.searchId, legacySavedSearchId: legacy.savedSearchId, receipt, detail, attempts, proofLimit: 'Placeholder navigation was intercepted. No live provider, booking, payment or purchase completion was exercised.', savedReads, posts });
  });

  test('automatic overnight arrival drives one-night hotels, capacities 1–4, four orders and reference transactions', async ({ reviewer }, info) => {
    test.setTimeout(120_000);
    const { page, context } = reviewer;
    const attempts = await interceptPlaceholder(reviewer);
    await loadQuery(reviewer, queryFor('train', 'domestic', 'one-way'));
    const run = await runSearch(reviewer);
    const group = run.snapshot.groups.find(candidate => {
      const segment = candidate.itinerary.outbound.segments.at(-1)!;
      return localDate(segment.arrivalAt, segment.arrivalTimeZone) > run.snapshot.query.departureDate;
    });
    expect(group, 'The authored train inventory must provide an actual overnight arrival').toBeDefined();
    const quoteId = group!.eligibleQuotes[0]!.quoteId;
    const nativeChoice = resultRegion(page).locator(`article[data-quote-id="${quoteId}"]`).getByRole('button', { name: 'انتخاب پیشنهاد', exact: true });
    await nativeChoice.focus(); await nativeChoice.press('Space');
    const arrival = group!.itinerary.outbound.segments.at(-1)!;
    expect(localDate(arrival.arrivalAt, arrival.arrivalTimeZone)).not.toBe(run.snapshot.query.departureDate);
    const catalog = await contractResponse(await context.request.get('/api/v1/catalog'), CatalogSnapshotSchema);
    const place = catalog.places.find(candidate => candidate.id === arrival.destinationPlaceId)!;
    expect(place.kind).toBe('station');
    const hotelResponse = (phase: string) => page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/api/v1/hotel-searches'), { timeout: 15_000 }).catch(async error => {
      writeEvidence(info, 'hotel-response-public-state', { phase, state: await page.locator('[data-hotel-dialog]').evaluateAll(dialogs => dialogs.map(dialog => ({ selected: dialog.getAttribute('data-selected-hotel-id'), checkIn: dialog.getAttribute('data-hotel-check-in'), checkOut: dialog.getAttribute('data-hotel-check-out'), radios: Array.from(dialog.querySelectorAll<HTMLInputElement>('input[type="radio"]')).map(radio => ({ value: radio.value, checked: radio.checked, disabled: radio.disabled })), resultId: dialog.querySelector('[data-hotel-search-id]')?.getAttribute('data-hotel-search-id'), mapStatus: dialog.querySelector('[data-free-map-status]')?.getAttribute('data-free-map-status') }))) });
      await page.screenshot({ path: info.outputPath('hotel-response-public-state.png') });
      throw error;
    });
    const opening = hotelResponse('open');
    await page.getByRole('button', { name: 'مقایسه اقامتگاه‌های مشهد', exact: true }).click();
    const initial = HotelSearchSnapshotSchema.parse(await (await opening).json());
    hotelOrder(initial);
    expect(initial.query).toMatchObject({ checkIn: localDate(arrival.arrivalAt, place.timeZone), checkOut: nextDay(localDate(arrival.arrivalAt, place.timeZone)), rooms: 1, arrivalPlaceId: place.id, party: { adults: 1, children: 0, infants: 0 }, sort: 'cheapest' });
    const dialog = page.getByRole('dialog', { name: 'هتل‌های مشهد', exact: true });
    const results = dialog.getByRole('region', { name: 'نتایج مقایسه اقامتگاه‌ها', exact: true });
    const map = dialog.locator('[data-hotel-map]');
    await expect(results).toHaveAttribute('data-hotel-search-id', initial.hotelSearchId);
    await hotelProjection(page, initial);
    expect(initial.hotels.every(hotel => hotel.provenance.some(provenance => provenance.sourceNamespace === 'openstreetmap/hotel-directory'))).toBe(true);
    await expect(dialog.locator('input:not([type=radio])')).toHaveCount(0);
    const capacity = dialog.getByRole('combobox', { name: 'ظرفیت اتاق', exact: true });
    await expect(capacity.locator('option')).toHaveCount(4);
    const variants: HotelSearchSnapshot[] = [initial];
    for (const adults of [2, 3, 4, 1]) {
      const pending = hotelResponse('capacity-' + adults);
      await capacity.selectOption(String(adults));
      const snapshot = HotelSearchSnapshotSchema.parse(await (await pending).json());
      variants.push(snapshot);
      hotelOrder(snapshot);
      expect(snapshot.query).toMatchObject({ rooms: 1, party: { adults, children: 0, infants: 0 }, checkIn: initial.query.checkIn, checkOut: initial.query.checkOut });
      expect(snapshot.quotes.length).toBeGreaterThan(0);
      for (const quote of snapshot.quotes) {
        expect(quote.roomAllocation).toHaveLength(1);
        expect(quote.roomAllocation[0]!.adults).toBe(adults);
        expect(quote.roomDetails![0]!.maxAdults).toBeGreaterThanOrEqual(adults);
        expect(quote.completeness.status).toBe('complete');
      }
      await expect(results).toHaveAttribute('data-hotel-search-id', snapshot.hotelSearchId);
      await hotelProjection(page, snapshot);
    }
    for (const [name, sort] of [['ستاره بیشتر', 'stars'], ['نزدیک به ایستگاه راه‌آهن', 'arrival-distance'], ['ارزان‌ترین', 'cheapest']] as const) {
      const pending = hotelResponse('sort-' + sort);
      await dialog.getByRole('radio', { name, exact: true }).focus();
      await page.keyboard.press('Space');
      const snapshot = HotelSearchSnapshotSchema.parse(await (await pending).json());
      variants.push(snapshot);
      hotelOrder(snapshot);
      expect(snapshot.query.sort).toBe(sort);
      await expect(results).toHaveAttribute('data-hotel-search-id', snapshot.hotelSearchId);
      await hotelProjection(page, snapshot);
    }
    // Map availability is observable. Both ready pins and the truthful local list fallback can commit a reference.
    await expect(map).toHaveAttribute('data-free-map-status', /^(ready|unavailable)$/, { timeout: 30_000 });
    const mapStatus = await map.getAttribute('data-free-map-status');
    const chosenId = variants.at(-1)!.results!.find(result => result.status === 'priced')!.hotelId;
    await dialog.locator(`[data-hotel-id="${chosenId}"] [data-hotel-card-select]`).click();
    await expect(dialog.locator('aside[data-selected-hotel-quote]')).toHaveAttribute('data-selected-hotel-id', chosenId);
    if (mapStatus === 'ready') {
      const pin = map.locator(`[data-map-hotel-id="${chosenId}"]`);
      await expect(pin).toBeVisible();
      await expect(pin).toHaveAttribute('aria-pressed', 'true');
      await pin.click();
      await expect(dialog.locator(`[data-hotel-id="${chosenId}"]`)).toHaveAttribute('data-selected', 'true');
    } else await expect(map.getByText('نقشه شهری در دسترس نیست.', { exact: true })).toBeVisible();
    await dialog.getByRole('radio', { name: 'نزدیک به نقطه دلخواه', exact: true }).focus();
    await page.keyboard.press('Space');
    await expect(map).toHaveAttribute('data-picking-point', 'true');
    await dialog.getByRole('button', { name: 'انصراف', exact: true }).click();
    await expect(map).toHaveAttribute('data-picking-point', 'false');
    const beforePoint = await results.getAttribute('data-hotel-search-id');
    await dialog.getByRole('radio', { name: 'نزدیک به نقطه دلخواه', exact: true }).focus();
    await page.keyboard.press('Space');
    const pointRequest = hotelResponse('custom-reference');
    if (mapStatus === 'ready') await map.locator(`[data-map-hotel-id="${chosenId}"]`).click();
    else await map.getByRole('button', { name: initial.hotels.find(hotel => hotel.hotelId === chosenId)!.name, exact: true }).click();
    const pointSnapshot = HotelSearchSnapshotSchema.parse(await (await pointRequest).json());
    hotelOrder(pointSnapshot);
    expect(pointSnapshot.hotelSearchId).not.toBe(beforePoint);
    expect(pointSnapshot.query.customPoint).toEqual(initial.hotels.find(hotel => hotel.hotelId === chosenId)!.point);
    expect(pointSnapshot.query.sort).toBe('location-distance');
    await expect(results).toHaveAttribute('data-hotel-search-id', pointSnapshot.hotelSearchId);
    await hotelProjection(page, pointSnapshot);
    await dialog.getByRole('button', { name: 'تغییر نقطه مرجع', exact: true }).click();
    await expect(map).toHaveAttribute('data-picking-point', 'true');
    await dialog.getByRole('button', { name: 'انصراف', exact: true }).click();
    await expect(results).toHaveAttribute('data-hotel-search-id', pointSnapshot.hotelSearchId);
    await dialog.getByRole('button', { name: 'بستن', exact: true }).click();
    await page.getByRole('button', { name: 'مقایسه اقامتگاه‌های مشهد', exact: true }).click();
    await expect(results).toHaveAttribute('data-hotel-search-id', pointSnapshot.hotelSearchId);
    await expect(dialog.getByRole('radio', { name: 'نزدیک به نقطه دلخواه', exact: true })).toBeChecked();
    // Decision0070: reactivating the already checked fourth option reopens the transaction without replacing the saved point.
    await dialog.getByRole('radio', { name: 'نزدیک به نقطه دلخواه', exact: true }).focus();
    await page.keyboard.press('Space');
    await expect(map).toHaveAttribute('data-picking-point', 'true');
    await dialog.getByRole('radio', { name: 'نزدیک به نقطه دلخواه', exact: true }).focus();
    await page.keyboard.press('Space');
    await expect(map).toHaveAttribute('data-picking-point', 'true');
    await dialog.getByRole('button', { name: 'انصراف', exact: true }).click();
    await expect(results).toHaveAttribute('data-hotel-search-id', pointSnapshot.hotelSearchId);
    await expect(dialog.getByRole('radio', { name: 'نزدیک به نقطه دلخواه', exact: true })).toBeChecked();
    await dialog.locator(`[data-hotel-id="${chosenId}"] [data-hotel-card-select]`).click();
    const prepared = page.waitForResponse(response => response.url().endsWith('/api/v1/referrals/prepare'));
    const confirmed = page.waitForResponse(response => response.url().endsWith('/api/v1/referrals/confirm'));
    const popup = await expectPlaceholder(page, () => dialog.locator('[data-referral-source="hotel"]').getByRole('button', { name: /^رفتن به / }).click());
    const checked = RecheckResultSchema.parse(await (await prepared).json());
    expect(checked.status).toBe('ready');
    if (checked.status === 'unavailable') throw new Error('A normal selected hotel must recheck');
    const receipt = ReferralReceiptSchema.parse(await (await confirmed).json());
    exactReceipt(receipt, checked.intent);
    expect(receipt.payload.kind).toBe('hotel');
    if (receipt.payload.kind === 'hotel') {
      expect(receipt.payload.quote.query).toEqual(pointSnapshot.query);
      expect(receipt.payload.quote.hotelId).toBe(chosenId);
    }
    await expect(results).toHaveAttribute('data-hotel-search-id', pointSnapshot.hotelSearchId);
    await expect(dialog.locator(`[data-hotel-id="${chosenId}"]`)).toHaveAttribute('data-selected', 'true');
    await popup.close();
    await page.bringToFront();
    await page.screenshot({ path: info.outputPath('arrival-hotels-reference.png') });
    writeEvidence(info, 'automatic-hotel-journey', { transportSearchId: run.snapshot.searchId, arrival, place, initialQuery: initial.query, capacitiesAndOrders: variants.map(snapshot => ({ id: snapshot.hotelSearchId, query: snapshot.query, quoteCount: snapshot.quotes.length })), mapStatus, pointQuery: pointSnapshot.query, receipt, attempts, proofLimit: mapStatus === 'ready' ? 'Actual hotel pins were selectable; public street-map readiness is specific to this run. Approved placeholder navigation was intercepted.' : 'Public street map unavailable; actual local hotel reference choices remained usable. No ready-map claim. Approved placeholder navigation was intercepted.' });
  });

  test('changed fare requires the exact new version; sold-out recovery rechecks an actual same-query alternative', async ({ newReviewer }, info) => {
    test.setTimeout(90_000);
    const changedReviewer = await newReviewer({ scenario: 'price-change' });
    const changedRun = await startApiSearch(changedReviewer, queryFor('flight', 'domestic', 'round-trip', { filters: { providerIds: ['demo-provider-04'] } }));
    const old = scenarioQuote(changedRun.snapshot);
    const changed = await prepare(changedReviewer, { kind: 'transport', quoteId: old.quoteId, quoteVersion: old.version });
    expect(changed.status).toBe('changed');
    if (changed.status !== 'changed') throw new Error('Expected the authored changed fare');
    expect(changed.previousQuoteVersion).toBe(old.version);
    expect(changed.previousQuote.quote).toEqual(old);
    expect(changed.intent.selection.quoteVersion).toBeGreaterThan(old.version);
    expect(changed.materialChanges.length).toBeGreaterThan(0);
    const input = confirmation(changed.intent);
    const rejected = await changedReviewer.context.request.post('/api/v1/referrals/confirm', { data: { ...input, acceptedQuoteVersion: old.version } });
    expect(rejected.status()).toBe(409);
    expect((await referralList(changedReviewer)).metrics.confirmed).toBe(0);
    const receipt = await confirm(changedReviewer, input);
    exactReceipt(receipt, changed.intent);
    expect((await readSearch(changedReviewer, changedRun.snapshot.searchId)).snapshot).toEqual(changedRun.snapshot);

    const soldReviewer = await newReviewer({ scenario: 'sold-out' });
    const soldRun = await startApiSearch(soldReviewer, queryFor('flight', 'domestic', 'one-way'));
    const soldQuote = scenarioQuote(soldRun.snapshot);
    const unavailable = await prepare(soldReviewer, { kind: 'transport', quoteId: soldQuote.quoteId, quoteVersion: soldQuote.version });
    expect(unavailable.status).toBe('unavailable');
    if (unavailable.status !== 'unavailable') throw new Error('Expected the authored sold-out fare');
    expect(unavailable.alternativeQuoteIds.length).toBeGreaterThan(0);
    expect((await referralList(soldReviewer)).metrics.confirmed).toBe(0);
    const alternatives = soldRun.snapshot.groups.flatMap(group => group.eligibleQuotes).filter(quote => unavailable.alternativeQuoteIds.includes(quote.quoteId));
    expect(alternatives).toHaveLength(unavailable.alternativeQuoteIds.length);
    let replacement;
    for (const quote of alternatives) {
      const checked = await prepare(soldReviewer, { kind: 'transport', quoteId: quote.quoteId, quoteVersion: quote.version });
      if (checked.status === 'ready') { replacement = checked; break; }
    }
    expect(replacement, 'At least one actual same-query alternative must survive its own fresh recheck').toBeDefined();
    const replacementReceipt = await confirm(soldReviewer, confirmation(replacement!.intent));
    exactReceipt(replacementReceipt, replacement!.intent);
    expect(replacementReceipt.selection.quoteId).not.toBe(soldQuote.quoteId);
    writeEvidence(info, 'changed-and-unavailable', { changed: { old, recheck: changed, rejectedOldVersionStatus: rejected.status(), receipt }, soldOut: { selected: soldQuote, recheck: unavailable, replacement: replacementReceipt } });
  });

  test('admin correction previews rejected source data then explicitly replays without rewriting historical evidence', async ({ newReviewer }, info) => {
    test.setTimeout(90_000);
    const reviewer = await newReviewer({ scenario: 'conflicting-data' });
    const old = await startApiSearch(reviewer, queryFor('flight', 'domestic', 'one-way', { filters: { providerIds: ['demo-provider-04'] } }));
    const api = reviewer.context.request;
    const workspace = await contractResponse(await api.get('/api/v1/admin/mappings?outcome=rejected&limit=100'), MappingWorkspaceSchema);
    const rejected = workspace.records.find(record => record.searchId === old.snapshot.searchId && record.raw.sourceNamespace === 'demo-provider-04/v1');
    expect(rejected).toBeDefined();
    const before = await contractResponse(await api.get('/api/v1/admin/searches/' + old.snapshot.searchId + '?section=normalizations&limit=100'), AdminSearchInspectionSchema);
    const patch: MappingPatch = { entityType: 'city', sourceNamespace: 'demo-provider-04/v1', sourceValue: 'تهران مرکزی', targetId: 'tehran', baseRevision: workspace.mappingRevision };
    const { page } = reviewer;
    await page.goto('/admin/quality');
    await page.getByLabel('Source namespace').selectOption(patch.sourceNamespace);
    await page.getByLabel('Source alias').fill(patch.sourceValue);
    await page.getByLabel('Canonical city').selectOption(patch.targetId);
    const previewResponse = page.waitForResponse(response => response.url().endsWith('/api/v1/admin/mappings/preview'));
    await page.getByRole('button', { name: 'Preview impact', exact: true }).click();
    const preview = MappingImpactPreviewSchema.parse(await (await previewResponse).json());
    expect(preview.valid).toBe(true);
    expect(preview.impacts.some(impact => impact.rawRecordId === rejected!.raw.rawRecordId && impact.before.outcome === 'rejected' && impact.after.outcome === 'accepted')).toBe(true);
    await expect(page.getByText('Before · rejected', { exact: true })).toBeVisible();
    await expect(page.getByText('After · accepted', { exact: true })).toBeVisible();
    const appliedResponse = page.waitForResponse(response => response.url().endsWith('/api/v1/admin/mappings/apply'));
    await page.getByRole('button', { name: 'Apply correction', exact: true }).click();
    const applied = MappingAppliedSchema.parse(await (await appliedResponse).json());
    expect(applied.parentRevision).toBe(patch.baseRevision);
    expect(applied.revision).not.toBe(patch.baseRevision);
    expect((await readSearch(reviewer, old.snapshot.searchId)).snapshot).toEqual(old.snapshot);
    expect((await contractResponse(await api.get('/api/v1/admin/searches/' + old.snapshot.searchId + '?section=normalizations&limit=100'), AdminSearchInspectionSchema)).evidence).toEqual(before.evidence);
    await page.goto('/admin/searches/' + old.snapshot.searchId);
    const replayResponse = page.waitForResponse(response => response.url().endsWith('/replay') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Replay with current settings', exact: true }).click();
    const replay = SearchRecoverySchema.parse(await (await replayResponse).json());
    const completed = await waitForSearch(reviewer, replay.snapshot.searchId);
    expect(completed.snapshot.predecessorSearchId).toBe(old.snapshot.searchId);
    const after = await contractResponse(await api.get('/api/v1/admin/searches/' + replay.snapshot.searchId + '?section=normalizations&limit=100'), AdminSearchInspectionSchema);
    expect(after.summary.mappingRevision).toBe(applied.revision);
    expect(after.evidence.section).toBe('normalizations');
    if (after.evidence.section === 'normalizations') expect(after.evidence.items.every(trace => trace.outcome === 'accepted' && trace.mappingRevision === applied.revision)).toBe(true);
    expect(completed.snapshot.groups.length).toBeGreaterThan(old.snapshot.groups.length);
    await expect(page.getByRole('link', { name: 'View predecessor search', exact: true })).toHaveAttribute('href', '/admin/searches/' + old.snapshot.searchId);
    writeEvidence(info, 'normalization-replay', { originalSearchId: old.snapshot.searchId, preview, applied, replaySearchId: replay.snapshot.searchId, before, after });
  });
});
