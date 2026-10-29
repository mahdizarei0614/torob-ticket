import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NormalizedOffer, TransportSearchQuery } from '@torob-ticket/contracts';
import { groupOffers, quoteOffer, type ComparisonContext } from '@torob-ticket/domain';
import { catalogForIdentity, farePoliciesForFixture } from '@torob-ticket/fixtures';
import { mockRegistry } from './mock-registry';
import type { ProviderContext, ProviderEvidence } from './provider-context';
const catalog=catalogForIdentity('showcase-v1','catalog-v1');
const mockFarePolicies=farePoliciesForFixture('showcase-v1');

const query: TransportSearchQuery = {
  mode: 'flight', scope: 'domestic', tripType: 'one-way', originCityId: 'tehran', destinationCityId: 'mashhad', departureDate: '2026-10-25',
  party: { adults: 1, children: 1, infants: 1, childAges: [7], infantAgesMonths: [12] }, classCode: 'economy', filters: {}, sort: 'cheapest',
};
function providerContext(extra: Partial<ProviderContext> = {}): ProviderContext {
  return {
    operationId: 'comparison-operation', fixtureVersion: 'showcase-v1', seed: 5, scenario: 'normal', scenarioRevision: 'scenario-v1', mappingRevision: 'mapping-v1',
    demoClock: { now: () => new Date('2026-10-24T00:00:00Z') }, realClock: { now: () => new Date('2026-11-01T12:00:00Z') },
    signal: new AbortController().signal, deadline: new Date('2026-11-01T12:00:05Z'), catalog,
    aliases: [{ entityType: 'city', sourceNamespace: 'demo-provider-03/v1', sourceValue: 'Istanbul / استانبول', targetId: 'istanbul' }],
    overrides: {}, traceSink: async () => {}, ...extra,
  };
}
function comparisonContext(records: ProviderEvidence[]): ComparisonContext {
  return {
    realClock: providerContext().realClock, places: catalog.places, policiesByProviderId: mockFarePolicies,
    sourceByOfferId: Object.fromEntries(records.filter(r => r.offer && r.source).map(r => [r.offer!.offerId, { rawRecordId: r.raw.rawRecordId, source: r.source! }])),
  };
}
async function collect(search: TransportSearchQuery, extra: Partial<ProviderContext> = {}) {
  const providers = mockRegistry.filter(p => catalog.providerCapabilities.find(c => c.providerId === p.providerId)?.modes.includes(search.mode));
  const pending = Promise.all(providers.map(p => p.search(search, providerContext(extra))));
  await vi.advanceTimersByTimeAsync(1500);
  return (await pending).flatMap(b => b.records);
}

describe('seeded fixture → adapter → normalization → eligible comparison', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-01T12:00:00Z')); });
  afterEach(() => { expect(vi.getTimerCount()).toBe(0); vi.useRealTimers(); });
  const routes = [
    ['flight', 'domestic', 'mashhad', 'economy'], ['flight', 'international', 'istanbul', 'economy'],
    ['train', 'domestic', 'mashhad', 'seat'], ['train', 'international', 'van', 'seat'],
    ['bus', 'domestic', 'isfahan', 'standard'], ['bus', 'international', 'yerevan', 'standard'],
  ] as const;
  for (const [mode, scope, destinationCityId, classCode] of routes) {
    for (const tripType of ['one-way', 'round-trip'] as const) {
      it(`${mode}/${scope}/${tripType} retains complete whole-party choices from at least three sellers`, async () => {
        const search = { ...query, mode, scope, destinationCityId, classCode, tripType, ...(tripType === 'round-trip' ? { returnDate: '2026-10-29' } : {}) };
        const records = await collect(search); const offers = records.flatMap(r => r.offer ? [r.offer] : []);
        expect(offers.length).toBeGreaterThan(0);
        expect(offers.every(o => o.eligibility.status === 'unknown')).toBe(true);
        const groups = groupOffers(offers, search, comparisonContext(records));
        expect(groups.length).toBeGreaterThanOrEqual(2);
        expect(groups.every(g => g.eligibleQuotes.length >= 3)).toBe(true);
        expect(groups.every(g => Boolean(g.itinerary.return) === (tripType === 'round-trip'))).toBe(true);
        expect(groups.every(g => g.eligibleQuotes.every(q => q.party.children === 1 && q.party.infants === 1))).toBe(true);
        expect(groups.every(g => g.eligibleQuotes.every(q => q.observedAt === '2026-11-01T12:00:00.000Z'))).toBe(true);
        expect(groupOffers([...offers].reverse(), search, comparisonContext(records))).toEqual(groups);
      });
    }
  }
  it('keeps mixed source money units and incomplete totals visible without winning representative price', async () => {
    const search = { ...query, party: { adults: 1, children: 0, infants: 0 } };
    const records = await collect(search); const offers = records.flatMap(r => r.offer ? [r.offer] : []);
    const groups = groupOffers(offers, search, comparisonContext(records));
    expect(groups.flatMap(g => g.incompletePriceOffers).map(o => o.providerId)).toEqual(['demo-provider-03']);
    expect(groups.flatMap(g => g.eligibleQuotes).every(q => q.total.amountRial > 10000000)).toBe(true);
    const direct = groups.find(g => g.durationMinutes === 90)!;
    expect(direct.eligibleQuotes.map(q => q.total.amountRial)).toEqual([15660000, 16200000, 16740000, 17280000]);
  });
  it('rejects missing source age applicability and sold-out/insufficient stock from the real pipeline', async () => {
    const records = await collect(query); const context = comparisonContext(records);
    const limited = records.find(r => r.source?.seats === 1 && r.offer?.completeness.status === 'complete')!;
    expect(quoteOffer(limited.offer!, query, context).status).toBe('rejected');
    const complete = records.find(r => r.source?.seats === 9)!;
    expect(quoteOffer(complete.offer!, { ...query, party: { ...query.party, childAges: [12] } }, context).status).toBe('rejected');
    const strictContext = { ...context, policiesByProviderId: { ...context.policiesByProviderId,
      [complete.offer!.providerId]: { ...mockFarePolicies[complete.offer!.providerId]!, sourceAgeBasis: 'exact-ages' as const } } };
    expect(quoteOffer(complete.offer!, query, strictContext).status).toBe('rejected');
    context.policiesByProviderId = {};
    expect(quoteOffer(complete.offer!, query, context).status).toBe('rejected');
    const soldRecords = await collect({ ...query, mode: 'bus', destinationCityId: 'isfahan', classCode: 'standard' });
    const sold = soldRecords.find(r => r.offer?.availability.status === 'known' && !r.offer.availability.value);
    const busRecords = sold!;
    expect(quoteOffer(busRecords.offer!, { ...query, mode: 'bus', destinationCityId: 'isfahan', classCode: 'standard' }, comparisonContext([busRecords])).status).toBe('rejected');
  });
  it('accepts the actual supplied airport-transfer fixture and rejects incomplete round-trip input', async () => {
    const search = { ...query, scope: 'international' as const, destinationCityId: 'istanbul' };
    const records = await collect(search, { caseId: 'airport-change' });
    const groups = groupOffers(records.flatMap(r => r.offer ? [r.offer] : []), search, comparisonContext(records));
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.every(g => g.itinerary.outbound.segments.at(-1)?.destinationPlaceId === 'saw')).toBe(true);
    const round = { ...search, tripType: 'round-trip' as const, returnDate: '2026-10-29' };
    const incomplete = await collect(round, { caseId: 'incomplete-round-trip' });
    expect(incomplete.every(r => !r.offer && r.trace.outcome === 'rejected')).toBe(true);
    expect(groupOffers(incomplete.flatMap(r => r.offer ? [r.offer] : []) as NormalizedOffer[], round, comparisonContext(incomplete))).toEqual([]);
  });
});
