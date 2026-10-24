import { describe, expect, it } from 'vitest';
import { ComparisonGroupSchema, QuoteSnapshotSchema } from '@torob-ticket/contracts';
import { comparisonCase, caseContext, comparisonPolicy } from '../testing/comparison-cases';
import { quoteOffer } from './quote-offer';
import { groupOffers } from './group-offers';
import { itineraryKey } from './itinerary-key';


function secondProvider() {
  const c = comparisonCase();
  c.offer.offerId = 'operation-1-offer-b'; c.offer.providerId = 'provider-b'; c.offer.fareId = 'fare-b';
  c.offer.itinerary.itineraryId = 'another-provider-itinerary'; c.offer.itinerary.outbound.segments[0]!.segmentId = 'provider-b-segment';
  c.offer.total!.amountRial = 18000000; c.offer.breakdown = [{ code: 'gross', amount: { amountRial: 18000000, currency: 'IRR' }, mandatory: true }];
  c.offer.provenance[0]!.rawRecordId = 'operation-1-raw-b'; c.offer.provenance[0]!.sourceNamespace = 'provider-b/v1';
  c.source.sourceRawRecordId = 'source-raw-b';
  return c;
}

describe('journey equivalence and representative selection', () => {
  it('groups the same service across sellers and retains both fares in price order', () => {
    const a = comparisonCase(); const b = secondProvider(); const context = caseContext(a, b);
    const groups = groupOffers([a.offer, b.offer], a.query, context);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.eligibleQuotes.map(q => q.providerId)).toEqual(['provider-b', 'provider-a']);
    expect(groups[0]!.representativeQuoteId).toBe(groups[0]!.eligibleQuotes[0]!.quoteId);
    expect(groups[0]!.durationMinutes).toBe(120); expect(groups[0]!.connectionCount).toBe(0);
    expect(ComparisonGroupSchema.safeParse(groups[0]).success).toBe(true);
    expect(groupOffers([b.offer, a.offer], a.query, context)).toEqual(groups);
  });
  it('does not merge a different airport, service, schedule or transfer requirement', () => {
    const { offer } = comparisonCase();
    for (const change of ['airport', 'service', 'schedule', 'transfer'] as const) {
      const other = structuredClone(offer.itinerary);
      if (change === 'airport') { other.originPlaceId = 'o2'; other.outbound.segments[0]!.originPlaceId = 'o2'; }
      if (change === 'service') other.outbound.segments[0]!.serviceId = 'other';
      if (change === 'schedule') other.outbound.segments[0]!.departureAt = '2026-10-24T22:01:00Z';
      if (change === 'transfer') other.outbound.stops.push({ placeId: 'mid', kind: 'technical-stop', waitMinutes: 10, vehicleChange: false });
      expect(itineraryKey(other)).not.toBe(itineraryKey(offer.itinerary));
    }
  });
  it('keeps baggage fare variants visible without splitting their journey', () => {
    const a = comparisonCase(); const b = secondProvider(); b.offer.conditions.outbound.checkedBaggageKg = { status: 'known', value: 30 };
    const groups = groupOffers([a.offer, b.offer], a.query, caseContext(a, b));
    expect(groups).toHaveLength(1);
    expect(groups[0]!.eligibleQuotes.map(q => [q.fareId, q.conditions.outbound.checkedBaggageKg])).toEqual([
      ['fare-b', { status: 'known', value: 30 }], ['fare-a', { status: 'known', value: 20 }],
    ]);
  });
  it('keeps incomplete mandatory totals separate and never picks them as representative', () => {
    const a = comparisonCase(); const b = secondProvider(); b.offer.completeness = { status: 'incomplete', missing: ['tax'] };
    const groups = groupOffers([a.offer, b.offer], a.query, caseContext(a, b));
    expect(groups[0]!.eligibleQuotes.map(q => q.fareId)).toEqual(['fare-a']);
    expect(groups[0]!.incompletePriceOffers.map(o => o.fareId)).toEqual(['fare-b']);
    const only = groupOffers([b.offer], b.query, caseContext(b));
    expect(only[0]!.eligibleQuotes).toEqual([]); expect(only[0]!.representativeQuoteId).toBeUndefined();
  });
});

describe('explicit whole-party fare evidence', () => {
  it('uses the gross total exactly once, retains provenance, and expires on real audit time', () => {
    const c = comparisonCase(); const result = quoteOffer(c.offer, c.query, caseContext(c));
    expect(result.status).toBe('eligible');
    if (result.status !== 'eligible') return;
    expect(result.quote.total.amountRial).toBe(20000000);
    expect(result.quote.breakdown.map(p => p.amount.amountRial)).toEqual([19800000, 200000]);
    expect(result.quote.observedAt).toBe('2026-11-01T12:00:00.000Z');
    expect(result.quote.expiresAt).toBe('2026-11-01T12:10:00.000Z');
    expect(c.offer.observedAt).toBe('2026-10-24T00:00:00Z');
    expect(result.quote.provenance).toEqual(c.offer.provenance);
    expect(QuoteSnapshotSchema.safeParse(result.quote).success).toBe(true);
  });
  it.each(['source', 'policy', 'stock', 'party', 'revision', 'raw-binding', 'availability', 'breakdown'] as const)('rejects absent or conflicting %s evidence with an inspectable reason', cause => {
    const c = comparisonCase(); const context = caseContext(c);
    if (cause === 'source') context.sourceByOfferId = {};
    if (cause === 'policy') context.policiesByProviderId = {};
    if (cause === 'stock') c.source.seats = 1;
    if (cause === 'party') c.source.party.adults = 1;
    if (cause === 'revision') c.source.sourceRevision = 'wrong';
    if (cause === 'raw-binding') context.sourceByOfferId[c.offer.offerId]!.rawRecordId = 'wrong';
    if (cause === 'availability') c.offer.availability = { status: 'unknown', reason: 'missing' };
    if (cause === 'breakdown') c.offer.breakdown[0]!.amount.amountRial = 1;
    c.offer.eligibility = { status: 'eligible' };
    const result = quoteOffer(c.offer, c.query, context);
    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') expect(result.reasons.length).toBeGreaterThan(0);
    expect(groupOffers([c.offer], c.query, context)).toEqual([]);
  });
  it('applies explicit category ages and seat demand to the whole party', () => {
    const c = comparisonCase(); c.query.party = { adults: 1, children: 1, infants: 1, childAges: [7], infantAgesMonths: [8] };
    c.source.party = { adults: 1, children: 1, infants: 1 };
    expect(quoteOffer(c.offer, c.query, caseContext(c)).status).toBe('eligible');
    c.query.party.childAges = [12]; expect(quoteOffer(c.offer, c.query, caseContext(c)).status).toBe('rejected');
    c.query.party.childAges = [7]; c.query.party.infantAgesMonths = undefined;
    expect(quoteOffer(c.offer, c.query, caseContext(c)).status).toBe('rejected');
    c.query.party.infantAgesMonths = [8]; const context = caseContext(c);
    context.policiesByProviderId[c.offer.providerId] = { ...comparisonPolicy, seatUnits: { adult: 1, child: 1, infant: 1 } };
    expect(quoteOffer(c.offer, c.query, context).status).toBe('rejected');
  });
  it('requires matching source ages for exact-age policies and treats age order as immaterial', () => {
    const c = comparisonCase(); c.query.party = { adults: 1, children: 2, infants: 0, childAges: [4, 8] };
    c.source.party = { adults: 1, children: 2, infants: 0 }; c.source.seats = 3;
    const context = caseContext(c); context.policiesByProviderId[c.offer.providerId] = { ...comparisonPolicy, sourceAgeBasis: 'exact-ages' };
    expect(quoteOffer(c.offer, c.query, context).status).toBe('rejected');
    c.source.party.childAges = [8, 4]; expect(quoteOffer(c.offer, c.query, context).status).toBe('eligible');
    c.source.party.childAges = [4, 9]; expect(quoteOffer(c.offer, c.query, context).status).toBe('rejected');
  });
  it('applies affirmative unknown-term filters and cannot label an incomplete budget as a match', () => {
    const c = comparisonCase(); c.offer.conditions.outbound.checkedBaggageKg = { status: 'unknown', reason: 'missing' };
    expect(quoteOffer(c.offer, c.query, caseContext(c)).status).toBe('eligible');
    c.query.filters.checkedBaggageMinKg = 0;
    expect(quoteOffer(c.offer, c.query, caseContext(c)).status).toBe('rejected');
    c.query.filters = { budgetMaxRial: 20000000 }; c.offer.completeness = { status: 'incomplete', missing: ['tax'] };
    expect(quoteOffer(c.offer, c.query, caseContext(c)).status).toBe('rejected');
  });
  it('uses deterministic identities while keeping operation and revision namespaces separate', () => {
    const c = comparisonCase(); const context = caseContext(c);
    const first = quoteOffer(c.offer, c.query, context);
    expect(first.status).toBe('eligible'); if (first.status !== 'eligible') return;
    const again = quoteOffer(c.offer, { ...c.query, sort: 'fastest' }, context);
    expect(again.status).toBe('eligible'); if (again.status !== 'eligible') return;
    expect(again.quote.quoteId).toBe(first.quote.quoteId);
    c.offer.offerId = 'operation-2-offer-a'; c.offer.provenance[0]!.rawRecordId = 'operation-2-raw-a';
    const next = quoteOffer(c.offer, c.query, caseContext(c));
    expect(next.status).toBe('eligible'); if (next.status !== 'eligible') return;
    expect(next.quote.quoteId).not.toBe(first.quote.quoteId);
    c.source.sourceRevision = 'source-v2'; c.offer.provenance[0]!.sourceRevision = 'source-v2';
    const revised = quoteOffer(c.offer, c.query, caseContext(c));
    expect(revised.status).toBe('eligible'); if (revised.status !== 'eligible') return;
    expect(revised.quote.quoteId).not.toBe(next.quote.quoteId);
  });
});

it('does not require age evidence for empty passenger categories under an exact-age policy', () => {
  const c = comparisonCase(); c.query.party.childAges = []; c.query.party.infantAgesMonths = [];
  const context = caseContext(c);
  context.policiesByProviderId[c.offer.providerId] = { ...comparisonPolicy, sourceAgeBasis: 'exact-ages' };
  expect(quoteOffer(c.offer, c.query, context).status).toBe('eligible');
});
