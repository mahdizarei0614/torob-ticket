import { describe, expect, it } from 'vitest';
import { addAirportTransfer, addReturn, comparisonCase, caseContext } from '../testing/comparison-cases';
import { quoteOffer } from './quote-offer';
import { groupOffers } from './group-offers';
import { itineraryKey } from './itinerary-key';

describe('complete supplied journeys', () => {
  it('never constructs a round-trip from unrelated outbound and return sellers', () => {
    const a = comparisonCase(); const b = comparisonCase();
    b.offer.offerId = 'other'; b.offer.providerId = 'other-provider';
    b.offer.itinerary.outbound.segments[0]!.originPlaceId = 'd'; b.offer.itinerary.outbound.segments[0]!.destinationPlaceId = 'o';
    a.query.tripType = 'round-trip'; a.query.returnDate = '2026-10-25';
    expect(groupOffers([a.offer, b.offer], a.query, caseContext(a, b))).toEqual([]);
    expect(quoteOffer(a.offer, a.query, caseContext(a)).status).toBe('rejected');
  });
  it.each([
    ['2026-10-25T00:00:00Z', 'eligible'],
    ['2026-10-25T06:00:00Z', 'eligible'],
    ['2026-10-24T23:59:00Z', 'rejected'],
  ])('validates a same-day return at %s by actual timing (%s)', (departure, status) => {
    const c = comparisonCase(); addReturn(c.offer, c.query, departure);
    expect(quoteOffer(c.offer, c.query, caseContext(c)).status).toBe(status);
  });
  it('sums per-direction elapsed travel and excludes destination stay', () => {
    const c = comparisonCase(); addReturn(c.offer, c.query);
    const groups = groupOffers([c.offer], c.query, caseContext(c));
    expect(groups[0]!.durationMinutes).toBe(240);
    expect(groups[0]!.eligibleQuotes[0]!.total.amountRial).toBe(20000000);
    expect(groups[0]!.eligibleQuotes[0]!.conditions.return).toEqual(c.offer.conditions.return);
  });
  it.each(['missing-terms', 'wrong-city', 'wrong-date', 'wrong-zone', 'negative-duration', 'overlap', 'disconnected', 'missing-stop'] as const)('rejects %s before producing a complete quote', cause => {
    const c = comparisonCase(); addReturn(c.offer, c.query);
    const inbound = c.offer.itinerary.return!.segments[0]!;
    if (cause === 'missing-terms') delete c.offer.conditions.return;
    if (cause === 'wrong-city') inbound.destinationPlaceId = 'mid';
    if (cause === 'wrong-date') c.query.returnDate = '2026-10-26';
    if (cause === 'wrong-zone') inbound.departureTimeZone = 'UTC';
    if (cause === 'negative-duration') inbound.arrivalAt = '2026-10-25T05:00:00Z';
    if (['overlap', 'disconnected', 'missing-stop'].includes(cause)) {
      addAirportTransfer(c.offer);
      if (cause === 'overlap') c.offer.itinerary.outbound.segments[1]!.departureAt = '2026-10-24T23:59:00Z';
      if (cause === 'disconnected') c.offer.itinerary.outbound.segments[1]!.originPlaceId = 'mid';
      if (cause === 'missing-stop') c.offer.itinerary.outbound.stops = [];
    }
    expect(quoteOffer(c.offer, c.query, caseContext(c)).status).toBe('rejected');
  });
  it('preserves supplied airport transfers and includes their travel and wait', () => {
    const c = comparisonCase(); addAirportTransfer(c.offer);
    const groups = groupOffers([c.offer], c.query, caseContext(c));
    expect(groups).toHaveLength(1); expect(groups[0]!.durationMinutes).toBe(210);
    expect(groups[0]!.itinerary.outbound.segments.at(-1)?.mode).toBe('bus');
    expect(groups[0]!.connectionCount).toBe(1);
  });
  it.each(['flight', 'train', 'bus'] as const)('counts %s stops separately from vehicle changes and includes dwell', mode => {
    const c = comparisonCase(mode); const leg = c.offer.itinerary.outbound;
    const first = leg.segments[0]!; first.destinationPlaceId = 'mid'; first.arrivalAt = '2026-10-24T23:00:00Z'; first.arrivalTimeZone = 'Asia/Tehran';
    leg.segments.push({ ...first, segmentId: 'second', originPlaceId: 'mid', destinationPlaceId: 'd', departureAt: '2026-10-24T23:30:00Z', arrivalAt: '2026-10-25T01:00:00Z', arrivalTimeZone: 'Asia/Dubai' });
    leg.stops = [{ placeId: 'mid', kind: mode === 'flight' ? 'technical-stop' : 'dwell', waitMinutes: 30, vehicleChange: false, arrivalAt: first.arrivalAt, departureAt: leg.segments[1]!.departureAt }];
    const groups = groupOffers([c.offer], c.query, caseContext(c));
    expect(groups[0]!.durationMinutes).toBe(180); expect(groups[0]!.connectionCount).toBe(mode === 'flight' ? 1 : 0);
    const before = itineraryKey(c.offer.itinerary);
    leg.stops[0]!.vehicleChange = true;
    expect(itineraryKey(c.offer.itinerary)).not.toBe(before);
    expect(groupOffers([c.offer], c.query, caseContext(c))[0]!.connectionCount).toBe(1);
  });
  it('applies return baggage, class, outbound window and complete-trip connection filters', () => {
    const c = comparisonCase(); addReturn(c.offer, c.query);
    c.query.filters.departureWindow = { startMinute: 0, endMinute: 120 };
    expect(quoteOffer(c.offer, c.query, caseContext(c)).status).toBe('eligible');
    c.offer.conditions.return!.checkedBaggageKg = { status: 'unknown', reason: 'missing' }; c.query.filters.checkedBaggageMinKg = 1;
    expect(quoteOffer(c.offer, c.query, caseContext(c)).status).toBe('rejected');
    c.query.filters = {}; c.offer.conditions.return!.classCode = 'business';
    expect(quoteOffer(c.offer, c.query, caseContext(c)).status).toBe('rejected');
  });
});

it('rejects a vehicle change mislabeled as ground dwell', () => {
  const c = comparisonCase('train'); const first = c.offer.itinerary.outbound.segments[0]!;
  first.destinationPlaceId = 'mid'; first.arrivalAt = '2026-10-24T23:00:00Z'; first.arrivalTimeZone = 'Asia/Tehran';
  c.offer.itinerary.outbound.segments.push({ ...first, segmentId: 'change', serviceId: 'different-train', originPlaceId: 'mid', destinationPlaceId: 'd', departureAt: '2026-10-24T23:30:00Z', arrivalAt: '2026-10-25T01:00:00Z', arrivalTimeZone: 'Asia/Dubai' });
  c.offer.itinerary.outbound.stops = [{ placeId: 'mid', kind: 'dwell', waitMinutes: 30, vehicleChange: false }];
  expect(quoteOffer(c.offer, c.query, caseContext(c)).status).toBe('rejected');
  c.offer.itinerary.outbound.stops[0]!.vehicleChange = true;
  expect(quoteOffer(c.offer, c.query, caseContext(c)).status).toBe('eligible');
});
it('rejects partial stop timing outside the journey and impossible dwell duration', () => {
  const c = comparisonCase();
  c.offer.itinerary.outbound.stops = [{ placeId: 'mid', kind: 'technical-stop', waitMinutes: 10, vehicleChange: false, arrivalAt: '2026-10-26T00:00:00Z' }];
  expect(quoteOffer(c.offer, c.query, caseContext(c)).status).toBe('rejected');
  c.offer.itinerary.outbound.stops[0]!.arrivalAt = undefined;
  c.offer.itinerary.outbound.stops[0]!.waitMinutes = 121;
  expect(quoteOffer(c.offer, c.query, caseContext(c)).status).toBe('rejected');
});

it('rounds fractional comparison minutes once after summing both directions', () => {
  const c = comparisonCase();
  c.offer.itinerary.outbound.segments[0]!.arrivalAt = '2026-10-25T00:00:30Z';
  addReturn(c.offer, c.query, '2026-10-25T06:00:00Z', '2026-10-25T08:00:30Z');
  expect(groupOffers([c.offer], c.query, caseContext(c))[0]!.durationMinutes).toBe(241);
});
