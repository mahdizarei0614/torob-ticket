import { FareConditionsSchema, type JourneyLeg, type Mode, type NormalizedOffer, type Party, type TransportSearchQuery } from '@torob-ticket/contracts';
import type { SourceFareEvidence } from '../normalization-types';

export const comparisonPlaces = [
  { id: 'o', cityId: 'origin', timeZone: 'Asia/Tehran' },
  { id: 'o2', cityId: 'origin', timeZone: 'Asia/Tehran' },
  { id: 'mid', cityId: 'middle', timeZone: 'Asia/Tehran' },
  { id: 'd', cityId: 'destination', timeZone: 'Asia/Dubai' },
  { id: 'd2', cityId: 'destination', timeZone: 'Asia/Dubai' },
];

/** Domain-local evidence only: no provider dialects or shared fixture imports. */
export function comparisonCase(mode: Mode = 'flight') {
  const party: Party = { adults: 2, children: 0, infants: 0 };
  const query: TransportSearchQuery = {
    mode, scope: 'international', tripType: 'one-way', originCityId: 'origin', destinationCityId: 'destination',
    departureDate: '2026-10-25', party, classCode: mode === 'flight' ? 'economy' : 'seat', filters: {}, sort: 'cheapest',
  };
  const outbound: JourneyLeg = {
    segments: [{ segmentId: 's1', mode, serviceId: 'service-1', operatorId: 'operator-a', originPlaceId: 'o', destinationPlaceId: 'd', departureAt: '2026-10-24T22:00:00Z', arrivalAt: '2026-10-25T00:00:00Z', departureTimeZone: 'Asia/Tehran', arrivalTimeZone: 'Asia/Dubai' }], stops: [],
  };
  const offer: NormalizedOffer = {
    offerId: 'operation-1-offer-a', providerId: 'provider-a', fareId: 'fare-a',
    itinerary: { itineraryId: 'source-itinerary-a', mode, originPlaceId: 'o', destinationPlaceId: 'd', outbound },
    conditions: { outbound: { classCode: query.classCode, checkedBaggageKg: { status: 'known', value: 20 }, cabinBaggageKg: { status: 'unknown', reason: 'missing' }, refundable: { status: 'known', value: true }, cancellation: { status: 'unknown', reason: 'missing' }, seatOrBerth: { status: 'unknown', reason: 'missing' }, materialTerms: [] } },
    total: { amountRial: 20000000, currency: 'IRR' },
    breakdown: [{ code: 'base', amount: { amountRial: 19800000, currency: 'IRR' }, mandatory: true }, { code: 'tax', amount: { amountRial: 200000, currency: 'IRR' }, mandatory: true }],
    completeness: { status: 'complete' }, eligibility: { status: 'unknown', reasons: ['fare-evaluation-required'] },
    availability: { status: 'known', value: true }, observedAt: '2026-10-24T00:00:00Z',
    provenance: [{ rawRecordId: 'operation-1-raw-a', sourceNamespace: 'provider-a/v1', sourceValue: { opaque: true }, sourceRevision: 'source-v1', mappingRevision: 'mapping-v1', fixtureVersion: 'fixture-v1' }], issues: [],
  };
  const source: SourceFareEvidence = { sourceRawRecordId: 'source-raw-a', sourceRevision: 'source-v1', party: { ...party }, seats: 2, pricingBasis: 'whole-party-gross' };
  return { offer, query, source };
}

export function addReturn(offer: NormalizedOffer, query: TransportSearchQuery, departureAt = '2026-10-25T06:00:00Z', arrivalAt = '2026-10-25T08:00:00Z') {
  query.tripType = 'round-trip'; query.returnDate = '2026-10-25';
  offer.itinerary.return = { segments: [{ ...offer.itinerary.outbound.segments[0]!, segmentId: 'return-1', serviceId: 'return-service', originPlaceId: 'd', destinationPlaceId: 'o', departureAt, arrivalAt, departureTimeZone: 'Asia/Dubai', arrivalTimeZone: 'Asia/Tehran' }], stops: [] };
  offer.conditions.return = FareConditionsSchema.parse(offer.conditions).outbound;
}

export function addAirportTransfer(offer: NormalizedOffer) {
  const leg = offer.itinerary.outbound;
  leg.segments.push({ segmentId: 'transfer', mode: 'bus', serviceId: 'airport-transfer', operatorId: 'transfer-operator', originPlaceId: 'd', destinationPlaceId: 'd2', departureAt: '2026-10-25T00:30:00Z', arrivalAt: '2026-10-25T01:30:00Z', departureTimeZone: 'Asia/Dubai', arrivalTimeZone: 'Asia/Dubai' });
  leg.stops.push({ placeId: 'd', kind: 'ground-transfer', waitMinutes: 30, vehicleChange: true, arrivalAt: '2026-10-25T00:00:00Z', departureAt: '2026-10-25T00:30:00Z' });
  offer.itinerary.destinationPlaceId = 'd2';
}

import type { ComparisonContext, ProviderFarePolicy } from '../comparison/quote-offer';
export const comparisonPolicy: ProviderFarePolicy = {
  revision: 'policy-v1', modes: ['flight', 'train', 'bus'], scopes: ['international', 'domestic'], classCodes: ['economy', 'seat'],
  requiresChildAges: true, requiresInfantAges: true, childAgeRangeYears: { min: 2, max: 11 }, infantAgeRangeMonths: { min: 0, max: 23 },
  seatUnits: { adult: 1, child: 1, infant: 0 }, sourceAgeBasis: 'category-counts',
};
export function caseContext(...cases: ReturnType<typeof comparisonCase>[]): ComparisonContext {
  return {
    realClock: { now: () => new Date('2026-11-01T12:00:00Z') }, places: comparisonPlaces,
    policiesByProviderId: Object.fromEntries(cases.map(c => [c.offer.providerId, comparisonPolicy])),
    sourceByOfferId: Object.fromEntries(cases.map(c => [c.offer.offerId, { rawRecordId: c.offer.provenance[0]!.rawRecordId, source: c.source }])),
  };
}
