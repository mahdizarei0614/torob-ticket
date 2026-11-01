import { randomUUID } from 'node:crypto';
import { ApiErrorSchema, CatalogSnapshotSchema, type ComparisonGroup, type EligibilityFilters, type Party, type QuoteSnapshot, type SearchRecovery } from '@torob-ticket/contracts';
import { expect, queryFor, startApiSearch, test, writeEvidence } from '../../fixtures';
import { allQuotes, assertCompleteFacts, legsOf, localMinute, quoteFact, quoteFacts } from './matrix-assertions';

const parties: Party[] = [
  { adults: 1, children: 0, infants: 0 },
  { adults: 2, children: 0, infants: 0 },
  { adults: 2, children: 1, infants: 1, childAges: [11], infantAgesMonths: [23] },
  { adults: 9, children: 0, infants: 0 },
];
const serviceSellerKey = (group: ComparisonGroup, quote: QuoteSnapshot) => JSON.stringify([group.groupId, quote.providerId]);

for (const mode of ['flight', 'train', 'bus'] as const) {
  for (const scope of ['domestic', 'international'] as const) {
    test(`@t30-party ${mode} ${scope}: actual API preserves adult, family ages and maximum parties for both trip types`, async ({ reviewer, newReviewer }, info) => {
      test.setTimeout(120_000);
      const runs = [];
      for (const tripType of ['one-way', 'round-trip'] as const) {
        // Four starts per owned namespace also respect the real rolling admission limit.
        const owner = tripType === 'one-way' ? reviewer : await newReviewer();
        const catalogResponse = await owner.context.request.get('/api/v1/catalog');
        expect(catalogResponse.status()).toBe(200);
        const catalog = CatalogSnapshotSchema.parse(await catalogResponse.json());
        const completions: SearchRecovery[] = [];
        for (const party of parties) {
          const query = queryFor(mode, scope, tripType, { party });
          const result = await startApiSearch(owner, query);
          assertCompleteFacts(result, catalog);
          expect(result.snapshot.query.party).toEqual(party);
          expect(allQuotes(result).length).toBeGreaterThan(0);
          expect(new Set(allQuotes(result).map(quote => quote.providerId)).size).toBeGreaterThanOrEqual(3);
          expect(allQuotes(result).every(quote => quote.party.adults + quote.party.children + quote.party.infants === party.adults + party.children + party.infants)).toBe(true);
          completions.push(result);
        }
        const original = completions[0]!;
        const baseline = new Map(original.snapshot.groups.flatMap(group => group.eligibleQuotes.map(quote => [serviceSellerKey(group, quote), quote.total.amountRial] as const)));
        for (const [index, result] of completions.entries()) {
          const expectedMultiplier = index === 0 ? 1 : index === 1 ? 2 : index === 3 ? 9 : undefined;
          for (const group of result.snapshot.groups) for (const quote of group.eligibleQuotes) {
            const single = baseline.get(serviceSellerKey(group, quote));
            expect(single, 'Whole-party totals compare the same actual service and seller').toBeDefined();
            if (expectedMultiplier) expect(quote.total.amountRial).toBe(single! * expectedMultiplier);
            else {
              expect(quote.total.amountRial).toBeGreaterThan(single! * 2);
              expect(quote.total.amountRial).toBeLessThan(single! * 4);
            }
          }
        }
        runs.push({ tripType, session: owner.session, queries: completions.map(result => result.snapshot.query), completions });
      }
      writeEvidence(info, 'api-party', { runs, proof: 'Fresh owned same-origin HTTP contexts exercise the public domain/API party contract. The current consumer controls remain normalized to one adult; no removed passenger UI is recreated.' });
    });
  }
}

test('@t30-party API rejects impossible party structures, preserves age-policy exclusion and distinguishes missing evidence from no match', async ({ reviewer, newReviewer }, info) => {
  test.setTimeout(90_000);
  const invalid = [
    { adults: 0, children: 1, infants: 0, childAges: [8] },
    { adults: 1, children: 0, infants: 2, infantAgesMonths: [1, 2] },
    { adults: 9, children: 1, infants: 0, childAges: [8] },
    { adults: 1, children: 2, infants: 0, childAges: [8] },
  ];
  const rejected = [];
  for (const party of invalid) {
    const response = await reviewer.context.request.post('/api/v1/searches', { data: { clientGeneration: 't30-invalid-' + randomUUID(), query: { ...queryFor(), party } } });
    expect(response.status()).toBe(400);
    const error = ApiErrorSchema.parse(await response.json());
    expect(error.code).toBe('INVALID_QUERY');
    expect(error.fieldPaths.some(path => path[0] === 'query' && path[1] === 'party')).toBe(true);
    expect(error.retryable).toBe(false);
    rejected.push({ party, error });
  }
  const excluded = await startApiSearch(reviewer, queryFor('flight', 'domestic', 'one-way', { party: { adults: 1, children: 1, infants: 0, childAges: [12] } }));
  expect(excluded.snapshot.status).toBe('empty');
  expect(allQuotes(excluded)).toEqual([]);
  expect(excluded.snapshot.coverage.complete).toBe(true);
  expect(excluded.snapshot.coverage.failedProviderIds).toEqual([]);
  const missingOwner = await newReviewer();
  const missing = await startApiSearch(missingOwner, queryFor('flight', 'domestic', 'one-way', { party: { adults: 1, children: 1, infants: 0 } }));
  expect(missing.snapshot.status).toBe('failed');
  expect(allQuotes(missing)).toEqual([]);
  expect(missing.snapshot.coverage.failedProviderIds.length).toBeGreaterThan(0);
  writeEvidence(info, 'invalid-parties', { rejected, excluded, missing, proof: 'Structural invalidity is rejected at the real API. A supplied unsupported child category is an adequately completed empty comparison; absent required age evidence fails collection and never becomes no-match evidence.' });
});

function satisfies(group: ComparisonGroup, quote: QuoteSnapshot, filters: EligibilityFilters): boolean {
  const terms = [quote.conditions.outbound, ...(quote.conditions.return ? [quote.conditions.return] : [])];
  const segments = legsOf(group).flatMap(leg => leg.segments);
  const first = group.itinerary.outbound.segments[0]!;
  const minute = localMinute(first.departureAt, first.departureTimeZone);
  const window = filters.departureWindow;
  return (filters.budgetMaxRial === undefined || quote.total.amountRial <= filters.budgetMaxRial)
    && (!filters.providerIds || filters.providerIds.includes(quote.providerId))
    && (!filters.operatorIds || segments.filter(segment => segment.mode === group.itinerary.mode).every(segment => filters.operatorIds!.includes(segment.operatorId)))
    && (filters.maxStopsOrTransfers === undefined || group.connectionCount <= filters.maxStopsOrTransfers)
    && (!filters.refundableOnly || terms.every(terms => terms.refundable.status === 'known' && terms.refundable.value))
    && (filters.checkedBaggageMinKg === undefined || terms.every(terms => terms.checkedBaggageKg.status === 'known' && terms.checkedBaggageKg.value >= filters.checkedBaggageMinKg!))
    && (!window || (window.startMinute <= window.endMinute ? minute >= window.startMinute && minute <= window.endMinute : minute >= window.startMinute || minute <= window.endMinute));
}

test('@t30-eligibility actual complete-trip filters enforce amount, local outbound time, sellers, all operators, stops, refundability, baggage and class', async ({ reviewer, newReviewer }, info) => {
  test.setTimeout(150_000);
  const query = queryFor('flight', 'domestic', 'round-trip');
  const baseline = await startApiSearch(reviewer, query);
  const quotes = allQuotes(baseline);
  expect(quotes.length).toBeGreaterThan(12);
  expect(quotes.some(quote => quote.conditions.outbound.refundable.status === 'unknown')).toBe(true);
  expect(quotes.some(quote => quote.conditions.outbound.checkedBaggageKg.status === 'unknown')).toBe(true);
  const totals = quotes.map(quote => quote.total.amountRial).sort((a, b) => a - b);
  const direct = baseline.snapshot.groups.find(group => group.connectionCount === 0)!;
  expect(direct).toBeDefined();
  const first = direct.itinerary.outbound.segments[0]!;
  const filters: { name: string; filters: EligibilityFilters }[] = [
    { name: 'budget includes mandatory charges for the complete party and both legs', filters: { budgetMaxRial: totals[Math.floor(totals.length / 2)]! } },
    { name: 'outbound origin-local one-minute time window excludes return departure', filters: { departureWindow: { startMinute: localMinute(first.departureAt, first.departureTimeZone), endMinute: localMinute(first.departureAt, first.departureTimeZone) } } },
    { name: 'named provider', filters: { providerIds: [quotes[0]!.providerId] } },
    { name: 'all main-mode operators across both supplied directions', filters: { operatorIds: [...new Set(legsOf(direct).flatMap(leg => leg.segments).map(segment => segment.operatorId))] } },
    { name: 'complete-trip stop maximum', filters: { maxStopsOrTransfers: 0 } },
    { name: 'affirmative refundable-only excludes false and unknown on either leg', filters: { refundableOnly: true } },
    { name: 'affirmative checked baggage excludes unknown on either leg', filters: { checkedBaggageMinKg: 20 } },
  ];
  const checks = [];
  for (const filter of filters) {
    const expected = baseline.snapshot.groups.flatMap(group => group.eligibleQuotes.filter(quote => satisfies(group, quote, filter.filters)).map(quote => quoteFact(group, quote))).sort();
    expect(expected.length, filter.name).toBeGreaterThan(0);
    expect(expected.length, filter.name).toBeLessThan(quotes.length);
    const owner = await newReviewer();
    const result = await startApiSearch(owner, { ...query, filters: filter.filters });
    expect(result.snapshot.status).toBe('complete');
    expect(quoteFacts(result), filter.name).toEqual(expected);
    expect(allQuotes(result).every(quote => quote.party.adults === 1 && quote.total.currency === 'IRR')).toBe(true);
    checks.push({ ...filter, expectedCount: expected.length, result });
  }
  const classOwner = await newReviewer();
  const business = await startApiSearch(classOwner, { ...query, classCode: 'business' });
  expect(business.snapshot.status).toBe('complete');
  expect(allQuotes(business).every(quote => quote.conditions.outbound.classCode === 'business' && quote.conditions.return?.classCode === 'business')).toBe(true);
  expect(Math.min(...allQuotes(business).map(quote => quote.total.amountRial))).toBeGreaterThan(Math.min(...quotes.map(quote => quote.total.amountRial)));
  writeEvidence(info, 'eligibility', { query, baseline, checks, business, proof: 'Actual public HTTP searches are compared with independent predicates over the full completed baseline; every named filter returns a nonempty strict subset and affirmative requirements preserve unknown exclusion.' });
});
