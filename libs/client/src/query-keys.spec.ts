import { expect, it } from 'vitest';
import type { DatePriceQuery, HotelSearchQuery } from '@torob-ticket/contracts';
import { datePriceKey, hotelKey, searchKey } from './query-keys';
const request: DatePriceQuery = { query: { mode: 'flight', scope: 'domestic', tripType: 'round-trip', originCityId: 'tehran', destinationCityId: 'mashhad', departureDate: '2026-10-25', returnDate: '2026-10-28', party: { adults: 1, children: 2, infants: 0, childAges: [4, 7] }, classCode: 'economy', filters: {}, sort: 'cheapest' }, leg: 'outbound', dates: ['2026-10-25', '2026-10-26'], clientGeneration: 'g1' };
const identity = { fixtureVersion: 'v1', catalogRevision: 'c1', seed: 5, anchorInstant: '2026-10-24T00:00:00Z', scenario: 'normal', scenarioRevision: 's1', mappingRevision: 'm1', providerOverrides: {}, sourceRevisions: { p: 's1' }, policyRevisions: { p: 'p1' } };
it('date key canonicalizes sort, generation, date order, age multisets and empty restrictions', () => {
  const changed = structuredClone(request); changed.clientGeneration = 'g2'; changed.dates.reverse(); changed.dates.push(changed.dates[0]!); changed.query.sort = 'fastest'; changed.query.departureDate = '2026-10-26'; changed.query.party.childAges?.reverse(); changed.query.filters.providerIds = [];
  expect(datePriceKey(changed, identity)).toEqual(datePriceKey(request, identity));
});
it('date identity changes for every mutable context field and fixed opposite leg', () => {
  for (const key of Object.keys(identity)) expect(datePriceKey(request, { ...identity, [key]: 'changed' })).not.toEqual(datePriceKey(request, identity));
  const changed = structuredClone(request); changed.query.returnDate = '2026-10-29'; expect(datePriceKey(changed, identity)).not.toEqual(datePriceKey(request, identity));
});
it('search keys retain sort and hotel keys retain age-at-check-in and sort reference', () => {
  expect(searchKey(request.query, identity)).not.toEqual(searchKey({ ...request.query, sort: 'fastest' }, identity));
  const hotel: HotelSearchQuery = { destinationCityId: 'mashhad', checkIn: '2026-10-25', checkOut: '2026-10-28', party: request.query.party, childAgesAtCheckIn: [4, 7], rooms: 1, sort: 'location-distance', customPoint: { latitude: 36, longitude: 59 } };
  expect(hotelKey(hotel, identity)).not.toEqual(hotelKey({ ...hotel, childAgesAtCheckIn: [5, 7] }, identity));
  expect(hotelKey(hotel, identity)).not.toEqual(hotelKey({ ...hotel, customPoint: { latitude: 35, longitude: 59 } }, identity));
  expect(hotelKey(hotel, identity)).toEqual(hotelKey({ ...hotel, childAgesAtCheckIn: [7, 4] }, identity));
});
