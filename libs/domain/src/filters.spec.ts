import { describe, expect, it } from 'vitest';
import type { EligibilityFilters, JourneyLeg, Mode, NormalizedOffer, TransportSearchQuery } from '@torob-ticket/contracts';
import { matchesEligibility } from './filters';

function example(mode: Mode = 'flight'): { offer: NormalizedOffer; query: TransportSearchQuery } {
  const outbound: JourneyLeg = {
    segments: [{ segmentId: 's1', mode, serviceId: 'F1', operatorId: 'operator-a', originPlaceId: 'o', destinationPlaceId: 'd', departureAt: '2026-10-24T22:00:00Z', arrivalAt: '2026-10-25T00:00:00Z', departureTimeZone: 'Asia/Tehran', arrivalTimeZone: 'Asia/Dubai' }], stops: [],
  };
  return {
    query: { mode, scope: 'international', tripType: 'one-way', originCityId: 'origin', destinationCityId: 'destination', departureDate: '2026-10-25', party: { adults: 2, children: 0, infants: 0 }, classCode: 'economy', filters: {}, sort: 'cheapest' },
    offer: {
      offerId: 'offer', providerId: 'provider-a', fareId: 'fare', itinerary: { itineraryId: 'itinerary', mode, originPlaceId: 'o', destinationPlaceId: 'd', outbound },
      conditions: { outbound: { classCode: 'economy', checkedBaggageKg: { status: 'known', value: 20 }, cabinBaggageKg: { status: 'unknown', reason: 'missing' }, refundable: { status: 'known', value: true }, cancellation: { status: 'unknown', reason: 'missing' }, seatOrBerth: { status: 'unknown', reason: 'missing' }, materialTerms: [] } },
      total: { amountRial: 20000000, currency: 'IRR' }, breakdown: [{ code: 'whole-party', amount: { amountRial: 20000000, currency: 'IRR' }, mandatory: true }],
      completeness: { status: 'complete' }, eligibility: { status: 'eligible' }, availability: { status: 'known', value: true },
      observedAt: '2026-10-24T00:00:00Z', provenance: [{ rawRecordId: 'raw', sourceNamespace: 'demo', sourceValue: '20000000', sourceRevision: '1', mappingRevision: '1', fixtureVersion: '1' }], issues: [],
    },
  };
}

describe('eligible whole-party offer predicates', () => {
  it('uses an inclusive whole-party budget rather than per-person amounts', () => {
    const { offer, query } = example();
    expect(matchesEligibility(offer, { ...query, filters: { budgetMaxRial: 20000000 } })).toBe(true);
    expect(matchesEligibility(offer, { ...query, filters: { budgetMaxRial: 19999999 } })).toBe(false);
    offer.total = { amountRial: 0, currency: 'IRR' };
    expect(matchesEligibility(offer, { ...query, filters: { budgetMaxRial: 0 } })).toBe(true);
  });
  it('excludes incomplete, missing, unavailable, or ineligible offers even without filters', () => {
    const { offer, query } = example();
    expect(matchesEligibility({ ...offer, completeness: { status: 'incomplete', missing: ['tax'] } }, query)).toBe(false);
    expect(matchesEligibility({ ...offer, total: undefined }, query)).toBe(false);
    expect(matchesEligibility({ ...offer, eligibility: { status: 'unknown', reasons: ['AGE_REQUIRED'] } }, query)).toBe(false);
    expect(matchesEligibility({ ...offer, eligibility: { status: 'ineligible', reasons: ['age'] } }, query)).toBe(false);
    expect(matchesEligibility({ ...offer, availability: { status: 'unknown', reason: 'missing' } }, query)).toBe(false);
    expect(matchesEligibility({ ...offer, availability: { status: 'known', value: false } }, query)).toBe(false);
  });
  it.each([
    [{ providerIds: [] }, true], [{ operatorIds: [] }, true],
    [{ providerIds: ['provider-a'] }, true], [{ providerIds: ['other'] }, false],
    [{ operatorIds: ['operator-a'] }, true], [{ operatorIds: ['other'] }, false],
    [{ departureWindow: { startMinute: 0, endMinute: 120 } }, true],
    [{ departureWindow: { startMinute: 1200, endMinute: 1439 } }, false],
    [{ checkedBaggageMinKg: 20 }, true], [{ checkedBaggageMinKg: 21 }, false],
    [{ refundableOnly: true }, true],
  ] satisfies [EligibilityFilters, boolean][])('applies filter %j', (filters, expected) => {
    const { offer, query } = example();
    expect(matchesEligibility(offer, { ...query, filters })).toBe(expected);
  });
  it('requires affirmative known baggage/refundability while preserving unrestricted unknowns', () => {
    const { offer, query } = example();
    offer.conditions.outbound.checkedBaggageKg = { status: 'unknown', reason: 'not supplied' };
    offer.conditions.outbound.refundable = { status: 'unknown', reason: 'not supplied' };
    expect(matchesEligibility(offer, query)).toBe(true);
    expect(matchesEligibility(offer, { ...query, filters: { checkedBaggageMinKg: 0 } })).toBe(false);
    expect(matchesEligibility(offer, { ...query, filters: { refundableOnly: true } })).toBe(false);
    expect(matchesEligibility(offer, { ...query, filters: { refundableOnly: false } })).toBe(true);
  });
  it('requires the requested class and matching mode', () => {
    const { offer, query } = example();
    expect(matchesEligibility(offer, { ...query, classCode: 'business' })).toBe(false);
    expect(matchesEligibility(offer, { ...query, mode: 'bus' })).toBe(false);
  });
  it('uses actual local departure dates rather than the UTC date', () => {
    const { offer, query } = example();
    expect(matchesEligibility(offer, query)).toBe(true);
    expect(matchesEligibility(offer, { ...query, departureDate: '2026-10-24' })).toBe(false);
  });
  it('counts flight technical stops but only vehicle changes for ground journeys', () => {
    for (const mode of ['flight', 'train', 'bus'] as const) {
      const { offer, query } = example(mode);
      offer.itinerary.outbound.stops = [{ placeId: 'mid', kind: 'technical-stop', waitMinutes: 10, vehicleChange: false }];
      expect(matchesEligibility(offer, { ...query, filters: { maxStopsOrTransfers: 0 } })).toBe(mode !== 'flight');
      offer.itinerary.outbound.stops[0]!.vehicleChange = true;
      expect(matchesEligibility(offer, { ...query, filters: { maxStopsOrTransfers: 0 } })).toBe(false);
    }
  });
  it('checks all operators in a connection', () => {
    const { offer, query } = example();
    offer.itinerary.outbound.segments.push({ ...offer.itinerary.outbound.segments[0]!, segmentId: 's2', operatorId: 'operator-b' });
    expect(matchesEligibility(offer, { ...query, filters: { operatorIds: ['operator-a'] } })).toBe(false);
    expect(matchesEligibility(offer, { ...query, filters: { operatorIds: ['operator-a', 'operator-b'] } })).toBe(true);
  });
  it('requires complete round-trip legs and terms and applies terms to both directions', () => {
    const { offer, query } = example();
    query.tripType = 'round-trip'; query.returnDate = '2026-10-26';
    expect(matchesEligibility(offer, query)).toBe(false);
    offer.itinerary.return = { segments: [{ ...offer.itinerary.outbound.segments[0]!, segmentId: 'return', originPlaceId: 'd', destinationPlaceId: 'o', departureAt: '2026-10-26T10:00:00Z', arrivalAt: '2026-10-26T12:00:00Z', departureTimeZone: 'Asia/Dubai', arrivalTimeZone: 'Asia/Tehran' }], stops: [] };
    expect(matchesEligibility(offer, query)).toBe(false);
    offer.conditions.return = { ...offer.conditions.outbound };
    expect(matchesEligibility(offer, query)).toBe(true);
    expect(matchesEligibility(offer, { ...query, returnDate: '2026-10-25' })).toBe(false);
    offer.conditions.return.refundable = { status: 'known', value: false };
    expect(matchesEligibility(offer, { ...query, filters: { refundableOnly: true } })).toBe(false);
    offer.conditions.return.checkedBaggageKg = { status: 'unknown', reason: 'missing' };
    expect(matchesEligibility(offer, { ...query, filters: { checkedBaggageMinKg: 1 } })).toBe(false);
    offer.conditions.return.classCode = 'business';
    expect(matchesEligibility(offer, query)).toBe(false);
  });
  it('sums both directions for stop limits and rejects a round-trip against one-way intent', () => {
    const { offer, query } = example();
    const stop = { placeId: 'mid', kind: 'connection' as const, waitMinutes: 60, vehicleChange: true };
    offer.itinerary.outbound.stops = [stop];
    offer.itinerary.return = { segments: [{ ...offer.itinerary.outbound.segments[0]!, departureAt: '2026-10-26T10:00:00Z', arrivalAt: '2026-10-26T12:00:00Z' }], stops: [stop] };
    offer.conditions.return = { ...offer.conditions.outbound };
    expect(matchesEligibility(offer, query)).toBe(false);
    expect(matchesEligibility(offer, { ...query, tripType: 'round-trip', returnDate: '2026-10-26', filters: { maxStopsOrTransfers: 1 } })).toBe(false);
    expect(matchesEligibility(offer, { ...query, tripType: 'round-trip', returnDate: '2026-10-26', filters: { maxStopsOrTransfers: 2 } })).toBe(true);
  });
  it('applies the single departure window only to outbound travel', () => {
    const { offer, query } = example();
    offer.itinerary.return = { segments: [{ ...offer.itinerary.outbound.segments[0]!, departureAt: '2026-10-26T10:00:00Z', arrivalAt: '2026-10-26T12:00:00Z' }], stops: [] };
    offer.conditions.return = { ...offer.conditions.outbound };
    expect(matchesEligibility(offer, { ...query, tripType: 'round-trip', returnDate: '2026-10-26', filters: { departureWindow: { startMinute: 0, endMinute: 120 } } })).toBe(true);
  });
  it('allows feasible same-day returns but rejects return departure before outbound arrival', () => {
    const { offer, query } = example();
    const roundTrip = { ...query, tripType: 'round-trip' as const, returnDate: '2026-10-25' };
    offer.itinerary.return = { segments: [{ ...offer.itinerary.outbound.segments[0]!, departureAt: '2026-10-25T00:30:00Z', arrivalAt: '2026-10-25T02:30:00Z', departureTimeZone: 'Asia/Dubai' }], stops: [] };
    offer.conditions.return = { ...offer.conditions.outbound };
    expect(matchesEligibility(offer, roundTrip)).toBe(true);
    offer.itinerary.return.segments[0]!.departureAt = '2026-10-24T23:30:00Z';
    expect(matchesEligibility(offer, roundTrip)).toBe(false);
  });
});
