import type { CatalogSnapshot, Itinerary, TransportSearchQuery } from '@torob-ticket/contracts';
import { displayOperatorName, displayPlaceName } from '@torob-ticket/ui';

interface HeadingPlace { label: string; code?: string; cityId?: string; placeId?: string }
type HeadingQuery = Pick<TransportSearchQuery, 'originCityId' | 'destinationCityId'> & Partial<Pick<TransportSearchQuery, 'tripType' | 'mode' | 'scope' | 'departureDate' | 'classCode' | 'party'>>;

/** Facilities come from the selected service; ambiguous form cities keep city-only labels. */
export function routeHeading({ itinerary, direction, query }: { itinerary?: Itinerary; direction: 'outbound' | 'return'; query: HeadingQuery }, catalog: CatalogSnapshot) {
 const city = (id: string) => catalog.cities.find(item => item.id === id)?.name ?? 'انتخاب نشده';
 const leg = itinerary && (direction === 'return' ? itinerary.return : itinerary.outbound);
 const roundTrip = direction === 'outbound' ? itinerary?.return : undefined;
 const bidirectional = direction === 'outbound' && Boolean(roundTrip || (!itinerary && query.tripType === 'round-trip'));
 // Return-date initialization belongs to a trip-type toggle. Every other
 // meaningful travel condition remains part of the heading's visual owner.
 const identity = { tripType: query.tripType ?? 'one-way', intentKey: JSON.stringify([direction, query.mode, query.scope, query.originCityId, query.destinationCityId, query.departureDate, query.classCode, query.party && [query.party.adults, query.party.children, query.party.infants, query.party.childAges, query.party.infantAgesMonths]]) };
 if (!leg) {
  const ids = direction === 'return' ? [query.destinationCityId, query.originCityId] : [query.originCityId, query.destinationCityId];
  const nodes: HeadingPlace[] = ids.map(id => ({ label: city(id), cityId: id }));
  return { ...identity, key: JSON.stringify(['cities', direction, ...ids]), nodes, labels: nodes.map(node => node.label), bidirectional, service: undefined, codes: undefined, showCodeRoute: false };
 }
 const first = leg.segments[0]!;
 const last = leg.segments.at(-1)!;
 const node = (id: string, fallback: string): HeadingPlace => {
  const place = catalog.places.find(item => item.id === id);
  // Airport identifiers are sourced IATA codes. Ground fixture codes are internal IDs.
  return place ? { label: catalog.cities.find(item => item.id === place.cityId)?.name ?? displayPlaceName(place), code: place.kind === 'airport' ? place.code : undefined, cityId: place.cityId, placeId: id } : { label: fallback, placeId: id };
 };
 const origin = node(first.originPlaceId, city(direction === 'return' ? query.destinationCityId : query.originCityId));
 const destination = node(last.destinationPlaceId, city(direction === 'return' ? query.originCityId : query.destinationCityId));
 // A whole round trip has two ends. Its full, possibly asymmetric airport chain remains below.
 const mergeReturnCode = (endpoint: HeadingPlace, placeId: string | undefined) => {
  if (!placeId) return endpoint;
  const returning = catalog.places.find(item => item.id === placeId);
  const codes = [...new Set([endpoint.code, returning?.kind === 'airport' && returning.cityId === endpoint.cityId ? returning.code : undefined].filter((code): code is string => Boolean(code)))];
  return { ...endpoint, code: codes.length ? codes.join(' / ') : undefined };
 };
 const nodes: HeadingPlace[] = roundTrip ? [mergeReturnCode(origin, roundTrip.segments.at(-1)?.destinationPlaceId), mergeReturnCode(destination, roundTrip.segments[0]?.originPlaceId)] : [origin, ...leg.stops.map(stop => node(stop.placeId, 'نام محل اعلام نشده')), destination].filter((item, index, items) => index === 0 || item.placeId !== items[index - 1]!.placeId);
 const codePlaces = [leg, ...(roundTrip ? [roundTrip] : [])].flatMap(item => item.segments.flatMap(segment => [segment.originPlaceId, segment.destinationPlaceId]));
 const codes = codePlaces.map(id => { const place = catalog.places.find(item => item.id === id); return place?.kind === 'airport' ? place.code : undefined; }).filter((code): code is string => Boolean(code)).filter((code, index, items) => index === 0 || code !== items[index - 1]);
 const departure = new Intl.DateTimeFormat('fa-IR', { timeStyle: 'short', timeZone: first.departureTimeZone }).format(new Date(first.departureAt));
 const returnFirst = roundTrip?.segments[0];
 const localDeparture = (segment: typeof first) => new Intl.DateTimeFormat('fa-IR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: segment.departureTimeZone }).format(new Date(segment.departureAt));
 const service = returnFirst ? `${displayOperatorName(first.operatorId, first.mode)} · رفت ${localDeparture(first)} · برگشت ${returnFirst.operatorId === first.operatorId ? '' : `${displayOperatorName(returnFirst.operatorId, returnFirst.mode)} `}${localDeparture(returnFirst)}` : `${displayOperatorName(first.operatorId, first.mode)} · ${departure}`;
 return { ...identity, key: JSON.stringify([itinerary.itineraryId, direction, nodes.map(item => [item.cityId, item.placeId, item.label, item.code]), service, codes, Boolean(roundTrip)]), nodes, labels: nodes.map(item => item.label), bidirectional, service, codes: codes.length > 1 ? codes.join(' → ') : undefined, showCodeRoute: Boolean(roundTrip) };
}
