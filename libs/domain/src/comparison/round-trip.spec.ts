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

describe('supplied cross-stop chronology', () => {
  const technicalStop = (placeId: string, waitMinutes: number, arrivalAt?: string, departureAt?: string) => ({
    placeId,
    kind: 'technical-stop' as const,
    waitMinutes,
    vehicleChange: false,
    ...(arrivalAt ? { arrivalAt } : {}),
    ...(departureAt ? { departureAt } : {}),
  });

  it.each([
    ['combined dwell exceeds leg', '2026-10-24T22:00:00Z', '2026-10-24T23:30:00Z', '2026-10-24T22:30:00Z', '2026-10-25T00:00:00Z', 90],
    ['combined dwell fits leg', '2026-10-24T22:10:00Z', '2026-10-24T22:40:00Z', '2026-10-24T22:30:00Z', '2026-10-24T23:00:00Z', 30],
  ] as const)('rejects simultaneous occupancy at different places when %s', (_label, firstArrival, firstDeparture, secondArrival, secondDeparture, wait) => {
    const c = comparisonCase();
    c.offer.itinerary.outbound.stops = [
      technicalStop('mid', wait, firstArrival, firstDeparture),
      technicalStop('d2', wait, secondArrival, secondDeparture),
    ];
    expect(quoteOffer(c.offer, c.query, caseContext(c)).status).toBe('rejected');
    expect(groupOffers([c.offer], c.query, caseContext(c))).toEqual([]);
  });

  it.each(['2026-10-24T22:40:00Z', '2026-10-24T22:50:00Z'])('accepts sequential technical stops with the second starting at %s', secondArrival => {
    const c = comparisonCase();
    const secondDeparture = secondArrival === '2026-10-24T22:40:00Z' ? '2026-10-24T23:10:00Z' : '2026-10-24T23:20:00Z';
    c.offer.itinerary.outbound.stops = [
      technicalStop('mid', 30, '2026-10-24T22:10:00Z', '2026-10-24T22:40:00Z'),
      technicalStop('d2', 30, secondArrival, secondDeparture),
    ];
    const original = structuredClone(c.offer.itinerary.outbound.stops);
    const groups = groupOffers([c.offer], c.query, caseContext(c));
    expect(groups).toHaveLength(1);
    expect(groups[0]!.durationMinutes).toBe(120);
    expect(groups[0]!.itinerary.outbound.stops).toEqual(original);
  });

  it('rejects a reversed supplied order rather than sorting it into a valid timeline', () => {
    const c = comparisonCase();
    c.offer.itinerary.outbound.stops = [
      technicalStop('d2', 30, '2026-10-24T23:00:00Z', '2026-10-24T23:30:00Z'),
      technicalStop('mid', 30, '2026-10-24T22:10:00Z', '2026-10-24T22:40:00Z'),
    ];
    const original = structuredClone(c.offer.itinerary.outbound.stops);
    expect(quoteOffer(c.offer, c.query, caseContext(c)).status).toBe('rejected');
    expect(c.offer.itinerary.outbound.stops).toEqual(original);
  });

  it('applies the cross-stop guard to the return direction', () => {
    const c = comparisonCase();
    addReturn(c.offer, c.query);
    c.offer.itinerary.return!.stops = [
      technicalStop('mid', 30, '2026-10-25T06:10:00Z', '2026-10-25T06:40:00Z'),
      technicalStop('d2', 30, '2026-10-25T06:30:00Z', '2026-10-25T07:00:00Z'),
    ];
    expect(quoteOffer(c.offer, c.query, caseContext(c)).status).toBe('rejected');
  });

  it('preserves feasible optional and partial timestamps without authoring missing values', () => {
    const c = comparisonCase();
    c.offer.itinerary.outbound.stops = [
      technicalStop('mid', 20, undefined, '2026-10-24T22:30:00Z'),
      technicalStop('d2', 10),
      technicalStop('mid', 20, '2026-10-24T23:00:00Z'),
      technicalStop('d2', 10, undefined, '2026-10-24T23:40:00Z'),
    ];
    const original = structuredClone(c.offer.itinerary.outbound.stops);
    const groups = groupOffers([c.offer], c.query, caseContext(c));
    expect(groups).toHaveLength(1);
    expect(groups[0]!.itinerary.outbound.stops).toEqual(original);
    expect(c.offer.itinerary.outbound.stops).toEqual(original);
    expect(groups[0]!.itinerary.outbound.stops[1]).not.toHaveProperty('arrivalAt');
    expect(groups[0]!.itinerary.outbound.stops[1]).not.toHaveProperty('departureAt');
  });

  it.each([
    ['unknown waits exceed whole leg', [technicalStop('mid', 70), technicalStop('d2', 60)]],
    ['unknown wait cannot fit before a known arrival', [technicalStop('mid', 40), technicalStop('d2', 20, '2026-10-24T22:30:00Z')]],
    ['unknown wait cannot fit before a partial departure', [technicalStop('mid', 30), technicalStop('d2', 20, undefined, '2026-10-24T22:40:00Z')]],
    ['arrival-only wait exceeds remaining leg', [technicalStop('mid', 30, '2026-10-24T23:40:00Z')]],
    ['departure-only wait starts before leg', [technicalStop('mid', 30, undefined, '2026-10-24T22:20:00Z')]],
  ])('rejects known dwell that cannot fit its available bounds: %s', (_label, stops) => {
    const c = comparisonCase();
    c.offer.itinerary.outbound.stops = stops;
    expect(quoteOffer(c.offer, c.query, caseContext(c)).status).toBe('rejected');
  });

  it('uses known segment-junction bounds even when the stop omits its timestamps', () => {
    const c = comparisonCase();
    addAirportTransfer(c.offer);
    const transfer = c.offer.itinerary.outbound.stops[0]!;
    delete transfer.arrivalAt;
    delete transfer.departureAt;
    c.offer.itinerary.outbound.stops.push(technicalStop('mid', 10, '2026-10-24T23:00:00Z', '2026-10-24T23:10:00Z'));
    expect(quoteOffer(c.offer, c.query, caseContext(c)).status).toBe('rejected');
    c.offer.itinerary.outbound.stops.reverse();
    const groups = groupOffers([c.offer], c.query, caseContext(c));
    expect(groups).toHaveLength(1);
    expect(groups[0]!.itinerary.outbound.stops[1]).not.toHaveProperty('arrivalAt');
    expect(groups[0]!.itinerary.outbound.stops[1]).not.toHaveProperty('departureAt');
  });

  it('retains a feasible sequence when a later untimed stop is the matching segment junction', () => {
    const c = comparisonCase();
    const first = c.offer.itinerary.outbound.segments[0]!;
    first.destinationPlaceId = 'mid';
    first.arrivalAt = '2026-10-24T23:00:00Z';
    first.arrivalTimeZone = 'Asia/Tehran';
    c.offer.itinerary.outbound.segments.push({
      ...first,
      segmentId: 'onward',
      originPlaceId: 'mid',
      destinationPlaceId: 'd',
      departureAt: '2026-10-24T23:30:00Z',
      arrivalAt: '2026-10-25T00:00:00Z',
      arrivalTimeZone: 'Asia/Dubai',
    });
    c.offer.itinerary.outbound.stops = [
      technicalStop('mid', 30),
      technicalStop('d2', 10, '2026-10-24T22:40:00Z', '2026-10-24T22:50:00Z'),
      technicalStop('mid', 30),
    ];
    const original = structuredClone(c.offer.itinerary.outbound.stops);
    const groups = groupOffers([c.offer], c.query, caseContext(c));
    expect(groups).toHaveLength(1);
    expect(groups[0]!.itinerary.outbound.stops).toEqual(original);
  });

});
