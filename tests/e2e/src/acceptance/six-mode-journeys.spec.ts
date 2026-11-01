import { CatalogSnapshotSchema, type SortOrder } from '@torob-ticket/contracts';
import { currentDatePrices, dateExplorer, expect, loadQuery, priceCards, queryFor, readSearch, resultRegion, runSearch, SINGLE_ADULT, test, writeEvidence } from '../../fixtures';
import { allQuotes, assertCalendarMinimum, assertCardEvidence, assertCompleteFacts, assertDateSurfaces, assertTimeline, expectedCards, quoteFact, quoteFacts } from './matrix-assertions';

const sortLabels = { cheapest: 'ارزان‌ترین', fastest: 'سریع‌ترین', 'fewest-connections': 'کم‌توقف‌ترین' };

for (const mode of ['flight', 'train', 'bus'] as const) {
  for (const scope of ['domestic', 'international'] as const) {
    for (const tripType of ['one-way', 'round-trip'] as const) {
      test(`@t30-matrix ${mode} ${scope} ${tripType}: complete fares, all rankings, named filters, dates and directional facts`, async ({ reviewer }, info) => {
        test.setTimeout(120_000);
        const { page, context } = reviewer;
        const query = queryFor(mode, scope, tripType);
        const requests: { method: string; path: string }[] = [];
        page.on('request', request => { if (request.method() === 'POST') requests.push({ method: request.method(), path: new URL(request.url()).pathname }); });
        await loadQuery(reviewer, query);
        await expect(page.getByLabel('تعداد بزرگسال', { exact: true })).toHaveCount(0);
        const initial = await runSearch(reviewer);
        expect(initial.snapshot.query).toEqual(query);
        expect(initial.snapshot.query.party).toEqual(SINGLE_ADULT);
        const catalogResponse = await context.request.get('/api/v1/catalog');
        expect(catalogResponse.status()).toBe(200);
        const catalog = CatalogSnapshotSchema.parse(await catalogResponse.json());
        assertCompleteFacts(initial, catalog);
        expect(initial.snapshot.coverage.successfulProviderIds.length).toBeGreaterThanOrEqual(3);
        expect(new Set(allQuotes(initial).map(quote => quote.providerId)).size).toBeGreaterThanOrEqual(3);
        expect(initial.snapshot.groups.length).toBeGreaterThanOrEqual(12);
        const firstOrder = await assertCardEvidence(page, initial, 'cheapest');
        const selected = resultRegion(page).locator('article[data-selected="true"]');
        const selectedQuote = await selected.getAttribute('data-quote-id');
        expect(selectedQuote).toBeTruthy();
        expect(allQuotes(initial).find(quote => quote.quoteId === selectedQuote)!.total.amountRial).toBe(firstOrder[0]!.amountRial);
        const map = page.getByRole('complementary', { name: 'نقشه سفر', exact: true });
        const pinned = await map.getAttribute('data-map-itinerary');
        expect(pinned).toBeTruthy();
        const outboundPrices = await assertDateSurfaces(reviewer, initial);
        const immutableBeforeSort = await readSearch(reviewer, initial.snapshot.searchId);
        const postsBeforeSort = requests.length, dateIdBeforeSort = await dateExplorer(page).getAttribute('data-date-price-id'), urlBeforeSort = page.url();
        const rankings: Partial<Record<SortOrder, ReturnType<typeof expectedCards>>> = { cheapest: firstOrder };
        for (const sort of ['fastest', 'fewest-connections', 'cheapest'] as const) {
          const name = sort === 'fewest-connections' && mode !== 'flight' ? 'کمترین تعویض' : sortLabels[sort];
          const control = resultRegion(page).getByRole('radiogroup', { name: 'مرتب‌سازی پیشنهادها', exact: true }).getByRole('radio', { name, exact: true });
          await control.focus();
          await page.keyboard.press('Space');
          await expect(control).toBeChecked();
          rankings[sort] = await assertCardEvidence(page, initial, sort);
          await expect(control).toBeFocused();
          await expect(selected).toHaveAttribute('data-quote-id', selectedQuote!);
          await expect(map).toHaveAttribute('data-map-itinerary', pinned!);
          await expect(dateExplorer(page)).toHaveAttribute('data-date-price-id', dateIdBeforeSort!);
          expect(page.url()).toBe(urlBeforeSort);
        }
        expect(requests.length).toBe(postsBeforeSort);
        expect(await readSearch(reviewer, initial.snapshot.searchId)).toEqual(immutableBeforeSort);

        // Distinct sellers' fares for one supplied service stay distinct price cards.
        const fareGroup = initial.snapshot.groups.find(group => new Set(group.eligibleQuotes.map(quote => quote.providerId)).size >= 3 && new Set(group.eligibleQuotes.map(quote => quote.total.amountRial)).size >= 2);
        expect(fareGroup).toBeDefined();
        if (!fareGroup) throw new Error('The showcase requires distinct supplied seller fares');
        const farePrices = [...new Set(fareGroup.eligibleQuotes.map(quote => quote.total.amountRial))].sort((a, b) => a - b).slice(0, 2);
        const fareSelections = [];
        for (const amount of farePrices) {
          const fact = expectedCards(initial, 'cheapest').find(card => card.groupId === fareGroup.groupId && card.amountRial === amount)!;
          const card = priceCards(page).locator(`xpath=self::article[@data-quote-id="${fact.quoteId}"]`);
          // Route-code tooltip buttons sit above the stretched card button; select its native keyboard control.
          const select = card.getByRole('button', { name: 'انتخاب پیشنهاد', exact: true });
          await expect(select).toBeEnabled(); await select.focus(); await page.keyboard.press('Space');
          await expect(card).toHaveAttribute('data-selected', 'true');
          await expect(card).toHaveAttribute('data-amount-rial', String(amount));
          const sellers = fareGroup.eligibleQuotes.filter(quote => quote.total.amountRial === amount);
          await expect(card.locator('[data-seller-quote-id]')).toHaveCount(sellers.length);
          expect(await card.locator('[data-seller-quote-id]').evaluateAll(nodes => nodes.map(node => ({ id: node.getAttribute('data-seller-quote-id'), amount: Number(node.getAttribute('data-seller-amount-rial')) })))).toEqual(sellers.map(quote => ({ id: quote.quoteId, amount: quote.total.amountRial })));
          await expect(map).toHaveAttribute('data-map-itinerary', fareGroup.itinerary.itineraryId);
          fareSelections.push({ quoteId: fact.quoteId, amount, sellers: sellers.map(quote => quote.providerId) });
        }

        // Inspect the richest actual timeline instead of assuming every intermediate ground stop is a transfer.
        const timelineGroup = [...initial.snapshot.groups].sort((a, b) => b.itinerary.outbound.stops.length + (b.itinerary.return?.stops.length ?? 0) - a.itinerary.outbound.stops.length - (a.itinerary.return?.stops.length ?? 0))[0]!;
        const timelineFact = expectedCards(initial, 'cheapest').find(card => card.groupId === timelineGroup.groupId)!;
        const timelineCard = priceCards(page).locator(`xpath=self::article[@data-quote-id="${timelineFact.quoteId}"]`);
        const timelineSelect = timelineCard.getByRole('button', { name: 'انتخاب پیشنهاد', exact: true });
        await expect(timelineSelect).toBeEnabled(); await timelineSelect.focus(); await page.keyboard.press('Space');
        await assertTimeline(timelineCard, timelineGroup);
        const returnPrices = tripType === 'round-trip' ? await (async () => {
          const before = await dateExplorer(page).getAttribute('data-date-price-id');
          const leg = page.getByRole('radiogroup', { name: 'جستجو بر اساس', exact: true }).getByRole('radio', { name: 'تاریخ برگشت', exact: true });
          await leg.focus(); await page.keyboard.press('Space');
          await expect(dateExplorer(page)).toHaveAttribute('data-date-leg', 'return');
          await expect(dateExplorer(page)).not.toHaveAttribute('data-date-price-id', before!);
          return assertDateSurfaces(reviewer, initial);
        })() : undefined;
        const calendarPrices = await assertCalendarMinimum(reviewer, initial);

        // A nonempty strict subset proves both budget and named provider controls have effect.
        const providerId = [...new Set(allQuotes(initial).map(quote => quote.providerId))].sort()[0]!;
        const providerAmounts = allQuotes(initial).filter(quote => quote.providerId === providerId).map(quote => quote.total.amountRial).sort((a, b) => a - b);
        const budgetMaxRial = providerAmounts[Math.floor(providerAmounts.length / 2)]!;
        await resultRegion(page).getByRole('button', { name: /^فیلتر نتایج/ }).click();
        const form = page.getByRole('form', { name: 'فیلتر پیشنهادهای سفر', exact: true });
        await form.getByLabel('سقف مبلغ کل (تومان)', { exact: true }).fill(String(budgetMaxRial / 10));
        const providers = catalog.providerCapabilities.filter(provider => provider.modes.includes(mode) && provider.scopes.includes(scope));
        const providerControl = form.locator('fieldset').filter({ has: page.getByText('فروشنده · انتخاب نکردن یعنی همه', { exact: true }) }).getByRole('checkbox').nth(providers.findIndex(provider => provider.providerId === providerId));
        const providerLabel = await providerControl.evaluate(node => node.closest('label')?.textContent?.trim());
        expect(providerLabel).toBeTruthy();
        await providerControl.check();
        const filtered = await runSearch(reviewer, () => form.getByRole('button', { name: 'اعمال فیلترها', exact: true }).click());
        expect(filtered.snapshot.status).toBe('complete');
        expect(filtered.snapshot.query.filters).toEqual({ budgetMaxRial, providerIds: [providerId] });
        expect(allQuotes(filtered).length).toBeGreaterThan(0);
        expect(allQuotes(filtered).length).toBeLessThan(allQuotes(initial).length);
        expect(allQuotes(filtered).every(quote => quote.providerId === providerId && quote.total.amountRial <= budgetMaxRial)).toBe(true);
        const expectedFiltered = initial.snapshot.groups.flatMap(group => group.eligibleQuotes.filter(quote => quote.providerId === providerId && quote.total.amountRial <= budgetMaxRial).map(quote => quoteFact(group, quote))).sort();
        expect(quoteFacts(filtered)).toEqual(expectedFiltered);
        await assertCardEvidence(page, filtered, 'cheapest');
        await assertDateSurfaces(reviewer, filtered);
        const historicalAfterFilter = await readSearch(reviewer, initial.snapshot.searchId);
        expect(historicalAfterFilter).toEqual(immutableBeforeSort);
        writeEvidence(info, 'matrix', {
          mode, scope, tripType, session: reviewer.session, query, initial, rankings,
          fareSelections, timeline: timelineGroup.itinerary, outboundPrices, returnPrices, calendarPrices,
          filters: { providerId, providerLabel, budgetMaxRial, expectedCount: expectedFiltered.length }, filtered,
          currentPrices: await currentDatePrices(reviewer), requests,
          cardSelectionInput: 'Native keyboard Space on the enabled named card-selection button; separate route-code tooltip buttons keep their pointer behavior.',
          proof: 'Actual Compose UI/input/SSE and same-context HTTP evidence; consumer party is one adult. Ranking is local and the historical search remains immutable.',
        });
      });
    }
  }
}

