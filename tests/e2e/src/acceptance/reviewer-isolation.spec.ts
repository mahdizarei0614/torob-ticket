import { randomUUID } from 'node:crypto';
import {
  AdminControlConfigSchema, DemoAuthStateSchema, HotelSearchSnapshotSchema,
  ReferralReceiptSchema, SavedSearchListSchema, SavedSearchSchema, SearchEventSchema,
  SearchRecoverySchema, type ReferralReceipt,
} from '@torob-ticket/contracts';
import {
  test, expect, loadQuery, priceCards, queryFor, readSearch, resetReviewer,
  resultRegion, runSearch, startApiSearch, waitForSearch, writeEvidence,
} from '../../fixtures';
import {
  confirmation, confirm, contractResponse, exactReceipt, expectPlaceholder,
  interceptPlaceholder, prepare, referralDetail, referralList,
} from './journey-helpers';

test.use({ trace: 'off' });

test.describe('@acceptance @reviewer-isolation hostile timing and actual scoped reviewers', () => {
  test('two reviewers cannot read or mutate guessed search, hotel, referral or saved IDs; one reset preserves the peer', async ({ newReviewer }, info) => {
    test.setTimeout(90_000);
    const a = await newReviewer({ seed: 3041 }), b = await newReviewer({ seed: 3042 });
    const apiA = a.context.request, apiB = b.context.request;
    const configA = await contractResponse(await apiA.get('/api/v1/admin/config'), AdminControlConfigSchema);
    const configB = await contractResponse(await apiB.get('/api/v1/admin/config'), AdminControlConfigSchema);
    const changedA = await contractResponse(await apiA.patch('/api/v1/admin/providers/demo-provider-01', { data: { baseRevision: configA.revision, patch: { paused: true } } }), AdminControlConfigSchema);
    expect(changedA.revision).not.toBe(configA.revision);
    const peerConfig = { revision: configB.revision, providers: configB.providers, session: { seed: configB.session.seed, scenario: configB.session.scenario, mappingRevision: configB.session.mappingRevision } };
    expect(await contractResponse(await apiB.get('/api/v1/admin/config'), AdminControlConfigSchema)).toMatchObject(peerConfig);
    const query = queryFor();
    // Actual independent sessions run on the same application/server, using different cookie jars.
    const [runA, runB] = await Promise.all([startApiSearch(a, query), startApiSearch(b, { ...query, destinationCityId: 'shiraz' })]);
    expect(runA.snapshot.providerStatuses.find(provider => provider.providerId === 'demo-provider-01')?.status).toBe('paused');
    expect(runB.snapshot.providerStatuses.find(provider => provider.providerId === 'demo-provider-01')?.status).toBe('complete');
    const hotelA = await contractResponse(await apiA.post('/api/v1/hotel-searches', { data: { destinationCityId: 'mashhad', checkIn: '2026-11-02', checkOut: '2026-11-03', party: query.party, rooms: 1, sort: 'cheapest' } }), HotelSearchSnapshotSchema, 201);
    const selected = runA.snapshot.groups.flatMap(group => group.eligibleQuotes)[0]!;
    expect((await apiB.post('/api/v1/referrals/prepare', { data: { kind: 'transport', quoteId: selected.quoteId, quoteVersion: selected.version } })).status()).toBe(404);
    const checked = await prepare(a, { kind: 'transport', quoteId: selected.quoteId, quoteVersion: selected.version });
    expect(checked.status).toBe('ready');
    if (checked.status === 'unavailable') throw new Error('A normal scoped quote must recheck');
    const input = confirmation(checked.intent);
    expect((await apiB.post('/api/v1/referrals/confirm', { data: input })).status()).toBe(404);
    expect((await apiB.post('/api/v1/referrals/intents/' + checked.intent.intentId + '/cancel', { data: {} })).status()).toBe(404);
    const receipt = await confirm(a, input);
    exactReceipt(receipt, checked.intent);
    for (const path of [
      '/searches/' + runA.snapshot.searchId,
      '/searches/' + runA.snapshot.searchId + '/events',
      '/admin/searches/' + runA.snapshot.searchId,
      '/hotel-searches/' + hotelA.hotelSearchId,
      '/referrals/' + receipt.referralId,
      '/admin/referrals/' + receipt.referralId,
    ]) expect((await apiB.get('/api/v1' + path)).status(), path).toBe(404);
    expect((await apiB.post('/api/v1/searches/' + runA.snapshot.searchId + '/cancel', { data: {} })).status()).toBe(404);
    expect((await apiB.post('/api/v1/admin/searches/' + runA.snapshot.searchId + '/replay', { data: { clientGeneration: 't30-foreign-' + randomUUID() } })).status()).toBe(404);
    expect((await apiA.get('/api/v1/searches/' + runB.snapshot.searchId)).status()).toBe(404);
    const identityA = await contractResponse(await apiA.post('/api/v1/auth/demo/sign-in', { data: {} }), DemoAuthStateSchema, 201);
    const identityB = await contractResponse(await apiB.post('/api/v1/auth/demo/sign-in', { data: {} }), DemoAuthStateSchema, 201);
    expect(identityA.identity?.identityId).not.toBe(identityB.identity?.identityId);
    const savedA = await contractResponse(await apiA.post('/api/v1/saved-searches', { data: { name: 'سفر مشهد', query } }), SavedSearchSchema, 201);
    const savedB = await contractResponse(await apiB.post('/api/v1/saved-searches', { data: { name: 'سفر مشهد', query } }), SavedSearchSchema, 201);
    expect((await apiB.get('/api/v1/saved-searches/' + savedA.savedSearchId)).status()).toBe(404);
    expect((await apiB.delete('/api/v1/saved-searches/' + savedA.savedSearchId)).status()).toBe(404);
    expect((await contractResponse(await apiB.get('/api/v1/saved-searches'), SavedSearchListSchema)).items).toEqual([savedB]);
    const peerBefore = await readSearch(b, runB.snapshot.searchId);
    await resetReviewer(a);
    expect((await apiA.get('/api/v1/searches/' + runA.snapshot.searchId)).status()).toBe(404);
    expect((await apiA.get('/api/v1/hotel-searches/' + hotelA.hotelSearchId)).status()).toBe(404);
    expect((await apiA.get('/api/v1/referrals/' + receipt.referralId)).status()).toBe(404);
    expect(await readSearch(b, runB.snapshot.searchId)).toEqual(peerBefore);
    expect((await contractResponse(await apiB.get('/api/v1/saved-searches'), SavedSearchListSchema)).items).toEqual([savedB]);
    expect((await referralList(b)).metrics.confirmed).toBe(0);
    expect(await contractResponse(await apiB.get('/api/v1/admin/config'), AdminControlConfigSchema)).toMatchObject(peerConfig);
    writeEvidence(info, 'two-reviewers', { a: { searchId: runA.snapshot.searchId, hotelSearchId: hotelA.hotelSearchId, referralId: receipt.referralId, savedSearchId: savedA.savedSearchId, providerStatus: runA.snapshot.providerStatuses }, b: { searchId: runB.snapshot.searchId, savedSearchId: savedB.savedSearchId, providerStatus: runB.snapshot.providerStatuses }, guessedResourceStatus: 404, ownResetStatus: 201, peerSearchPreserved: true, peerSavedRecordPreserved: true });
  });

  test('simultaneous confirmation and retry return one exact immutable receipt for the same key', async ({ reviewer }, info) => {
    test.setTimeout(60_000);
    const run = await startApiSearch(reviewer, queryFor('flight', 'international', 'round-trip'));
    const original = run.snapshot.groups.flatMap(group => group.eligibleQuotes)[0]!;
    const checked = await prepare(reviewer, { kind: 'transport', quoteId: original.quoteId, quoteVersion: original.version });
    expect(checked.status).toBe('ready');
    if (checked.status === 'unavailable') throw new Error('Expected a ready intent');
    const input = confirmation(checked.intent);
    const [first, second] = await Promise.all([confirm(reviewer, input), confirm(reviewer, input)]);
    expect(second).toEqual(first);
    expect(await confirm(reviewer, input)).toEqual(first);
    exactReceipt(first, checked.intent);
    const badReplay = await reviewer.context.request.post('/api/v1/referrals/confirm', { data: { ...input, acceptedQuoteVersion: input.acceptedQuoteVersion + 1 } });
    expect(badReplay.status()).toBe(409);
    expect(await contractResponse(await reviewer.context.request.get('/api/v1/referrals/' + first.referralId), ReferralReceiptSchema)).toEqual(first);
    const list = await referralList(reviewer);
    expect(list.metrics.confirmed).toBe(1);
    expect(list.referrals.items).toEqual([first]);
    const detail = await referralDetail(reviewer, first.referralId);
    expect(detail.events.filter(event => event.kind === 'referral-confirmed')).toHaveLength(1);
    writeEvidence(info, 'concurrent-confirm', { input, receipt: first, immutableRetryEqual: true, changedPayloadStatus: badReplay.status(), metrics: list.metrics, confirmedEventCount: 1 });
  });

  test('a lost committed native confirmation retries its exact payload without a second recheck or receipt', async ({ reviewer }, info) => {
    test.setTimeout(90_000);
    const { page } = reviewer;
    const attempts = await interceptPlaceholder(reviewer);
    await loadQuery(reviewer, queryFor());
    const run = await runSearch(reviewer);
    const card = priceCards(page).locator('xpath=self::*[@data-selected="true"]');
    const quoteId = (await card.getAttribute('data-quote-id'))!;
    const inputs: unknown[] = [];
    let prepares = 0, committed: ReferralReceipt | undefined;
    page.on('request', request => { if (request.url().endsWith('/api/v1/referrals/prepare')) prepares++; });
    await page.route('**/api/v1/referrals/confirm', async route => {
      inputs.push(route.request().postDataJSON());
      if (!committed) {
        const response = await route.fetch();
        committed = await contractResponse(response, ReferralReceiptSchema, 201);
        await route.abort('connectionfailed');
      } else await route.continue();
    });
    await card.locator(`[data-seller-link-quote-id="${quoteId}"]`).dblclick();
    await expect(page.locator('[data-referral-phase]')).toHaveAttribute('data-referral-phase', 'retry-confirm');
    expect(prepares).toBe(1);
    expect(inputs).toHaveLength(1);
    expect(committed).toBeDefined();
    const popup = await expectPlaceholder(page, () => page.getByRole('button', { name: 'دریافت نتیجه همان انتقال', exact: true }).click());
    expect(inputs).toHaveLength(2);
    expect(inputs[1]).toEqual(inputs[0]);
    expect(prepares).toBe(1);
    expect((await referralList(reviewer)).metrics.confirmed).toBe(1);
    expect(await contractResponse(await reviewer.context.request.get('/api/v1/referrals/' + committed!.referralId), ReferralReceiptSchema)).toEqual(committed);
    await expect(resultRegion(page)).toHaveAttribute('data-search-id', run.snapshot.searchId);
    expect(attempts).toEqual(['https://zarei.xyz/']);
    await popup.close();
    writeEvidence(info, 'lost-confirmation', { inputs, prepareCount: prepares, receipt: committed, attempts, proofLimit: 'The real server committed before the response was aborted. Only the approved placeholder new-tab navigation was intercepted.' });
  });

  test('rapid native query replacement fences delayed old and duplicated current SSE events', async ({ newReviewer }, info) => {
    test.setTimeout(90_000);
    const reviewer = await newReviewer({ scenario: 'slow-provider' });
    const { page } = reviewer;
    let firstId = '', oldBody = '', oldFrames = 0, duplicateFrames = 0, crossGenerationFrames = 0;
    let seenFirst!: () => void, finishOld!: () => void, releaseOld!: () => void;
    const firstSeen = new Promise<void>(resolve => { seenFirst = resolve; });
    const oldFinished = new Promise<void>(resolve => { finishOld = resolve; });
    const oldGate = new Promise<void>(resolve => { releaseOld = resolve; });
    const writes: string[] = [];
    page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/api/v1/searches')) writes.push(request.postDataJSON().query.destinationCityId); });
    await page.route('**/api/v1/searches/*/events', async route => {
      const id = new URL(route.request().url()).pathname.split('/').at(-2)!;
      const first = !firstId || id === firstId;
      if (!firstId) { firstId = id; seenFirst(); }
      if (!first) releaseOld();
      try {
        const response = await route.fetch();
        const body = await response.text();
        const frames = body.trim().split(/\n\n+/).filter(frame => frame.includes('\ndata:'));
        for (const frame of frames) SearchEventSchema.parse(JSON.parse(frame.split('\n').find(line => line.startsWith('data:'))!.slice(5)));
        if (first) {
          oldBody = body; oldFrames = frames.length; finishOld();
          await oldGate;
          // The original fetch may already have been aborted by the new intent.
          await route.fulfill({ response, body });
        } else {
          await oldFinished;
          crossGenerationFrames = oldFrames;
          duplicateFrames = frames.length;
          await route.fulfill({ response, body: oldBody + '\n\n' + frames.flatMap(frame => [frame, frame]).join('\n\n') + '\n\n' });
        }
      } catch (error) {
        if (!first) throw error;
        finishOld();
      }
    });
    await loadQuery(reviewer, queryFor());
    const started = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/api/v1/searches'));
    await page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true }).click();
    const initial = SearchRecoverySchema.parse(await (await started).json());
    await firstSeen;
    const destination = page.getByRole('combobox', { name: 'مقصد', exact: true });
    await destination.fill('شیراز');
    await expect(destination).toHaveValue('شیراز');
    const shiraz = page.getByRole('option').filter({ has: page.getByText('شیراز', { exact: true }) });
    await expect(shiraz).toHaveCount(1);
    await shiraz.click({ timeout: 10_000 });
    await expect(destination).toHaveValue('شیراز');
    const replacement = await runSearch(reviewer);
    expect(replacement.snapshot.searchId).not.toBe(initial.snapshot.searchId);
    expect(replacement.snapshot.query.destinationCityId).toBe('shiraz');
    expect(replacement.snapshot.status).toBe('complete');
    expect(oldFrames).toBeGreaterThan(0);
    expect(duplicateFrames).toBeGreaterThan(0);
    expect(crossGenerationFrames).toBe(oldFrames);
    expect(writes).toEqual(['mashhad', 'shiraz']);
    await expect(resultRegion(page)).toHaveAttribute('data-search-id', replacement.snapshot.searchId);
    await expect(resultRegion(page)).toHaveAttribute('data-generation', replacement.snapshot.clientGeneration);
    await expect(resultRegion(page)).toHaveAttribute('data-sequence', String(replacement.sequence));
    const activeGroups = new Set(replacement.snapshot.groups.map(group => group.groupId));
    const visibleGroups = await priceCards(page).evaluateAll(cards => cards.map(card => card.getAttribute('data-group-id')));
    expect(visibleGroups.length).toBeGreaterThan(0);
    expect(visibleGroups.every(id => activeGroups.has(id!))).toBe(true);
    const selected = priceCards(page).locator('xpath=self::*[@data-selected="true"]');
    await expect(selected).toHaveCount(1);
    const selectedQuote = await selected.getAttribute('data-quote-id');
    const selectedGroup = replacement.snapshot.groups.find(group => group.eligibleQuotes.some(quote => quote.quoteId === selectedQuote))!;
    await expect(page.getByRole('complementary', { name: 'نقشه سفر', exact: true })).toHaveAttribute('data-map-itinerary', selectedGroup.itinerary.itineraryId);
    const old = await waitForSearch(reviewer, initial.snapshot.searchId);
    expect(['cancelled', 'complete']).toContain(old.snapshot.status);
    writeEvidence(info, 'delayed-duplicate-sse', { obsolete: { searchId: old.snapshot.searchId, status: old.snapshot.status, frames: oldFrames }, active: { searchId: replacement.snapshot.searchId, generation: replacement.snapshot.clientGeneration, sequence: replacement.sequence, duplicateFrames, delayedForeignFrames: crossGenerationFrames }, writes, selection: selectedQuote, note: 'Frames came from the actual owned server streams. Old-generation frames were deliberately prepended and each active frame duplicated; real native query input and real server results were retained.' });
  });

  test('reset during a running slow search revokes only that namespace and allows fresh work', async ({ newReviewer }, info) => {
    test.setTimeout(90_000);
    const a = await newReviewer({ scenario: 'slow-provider', seed: 3051 }), b = await newReviewer({ seed: 3052 });
    const peer = await startApiSearch(b, queryFor('bus', 'domestic', 'one-way'));
    const started = await contractResponse(await a.context.request.post('/api/v1/searches', { data: { query: queryFor(), clientGeneration: 't30-reset-running-' + randomUUID() } }), SearchRecoverySchema, 201);
    expect(started.snapshot.status).toBe('collecting');
    const originalId = started.snapshot.searchId;
    await resetReviewer(a);
    const missing = await a.context.request.get('/api/v1/searches/' + originalId);
    expect(missing.status()).toBe(404);
    expect((await a.context.request.get('/api/v1/admin/searches/' + originalId)).status()).toBe(404);
    expect((await a.context.request.get('/api/v1/searches/' + originalId + '/events')).status()).toBe(404);
    expect((await a.context.request.post('/api/v1/searches/' + originalId + '/retry', { data: { clientGeneration: 't30-reset-old-retry' } })).status()).toBe(404);
    expect(await readSearch(b, peer.snapshot.searchId)).toEqual(peer);
    const fresh = await startApiSearch(a, queryFor('train', 'domestic', 'one-way'));
    expect(fresh.snapshot.status).toBe('complete');
    expect(fresh.snapshot.searchId).not.toBe(originalId);
    // Observe again after a complete replacement lifecycle so late old collection cannot resurrect it.
    expect((await a.context.request.get('/api/v1/searches/' + originalId)).status()).toBe(404);
    expect(await readSearch(b, peer.snapshot.searchId)).toEqual(peer);
    expect((await referralList(a)).metrics.confirmed).toBe(0);
    writeEvidence(info, 'reset-running', { revoked: { searchId: originalId, initialStatus: started.snapshot.status, afterResetStatus: missing.status() }, fresh: { searchId: fresh.snapshot.searchId, status: fresh.snapshot.status }, peer: { searchId: peer.snapshot.searchId, retainedExactSnapshot: true }, cleanup: 'Only the two newly owned namespaces are reset by this test/fixture.' });
  });
});
