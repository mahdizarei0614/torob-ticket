import type { CatalogSnapshot, Itinerary, TransportSearchQuery } from '@torob-ticket/contracts';
import { displayOperatorName, displayPlaceName } from '@torob-ticket/ui';

/** The selected service supplies route names and time; the search cities are only a preselection fallback. */
export function routeHeading({ itinerary, direction, query }: { itinerary?: Itinerary; direction: 'outbound' | 'return'; query: Pick<TransportSearchQuery, 'originCityId' | 'destinationCityId'> }, catalog: CatalogSnapshot) {
 const city = (id: string) => catalog.cities.find(item => item.id === id)?.name ?? 'انتخاب نشده';
 const leg = itinerary && (direction === 'return' ? itinerary.return : itinerary.outbound);
 if (!leg) return { key: ['cities', direction, query.originCityId, query.destinationCityId].join(':'), labels: direction === 'return' ? [city(query.destinationCityId), city(query.originCityId)] : [city(query.originCityId), city(query.destinationCityId)], service: undefined, codes: undefined };
 const first = leg.segments[0]!;
 const last = leg.segments.at(-1)!;
 const roundTrip = direction === 'outbound' ? itinerary.return : undefined;
 const placeIds = [first.originPlaceId, ...leg.stops.map(stop => stop.placeId), last.destinationPlaceId,
  ...(roundTrip?.segments.length ? [roundTrip.segments[0]!.originPlaceId, ...roundTrip.stops.map(stop => stop.placeId), roundTrip.segments.at(-1)!.destinationPlaceId] : [])];
 const labels = placeIds.map((id, index) => {
  const place = catalog.places.find(item => item.id === id);
  return place ? catalog.cities.find(item => item.id === place.cityId)?.name ?? displayPlaceName(place) : index > 0 && index < placeIds.length - 1 ? 'نام محل اعلام نشده' : city(index === 0 ? direction === 'return' ? query.destinationCityId : query.originCityId : direction === 'return' || roundTrip ? query.originCityId : query.destinationCityId);
 }).filter((name, index, names) => index === 0 || name !== names[index - 1]);
 const departure = new Intl.DateTimeFormat('fa-IR', { timeStyle: 'short', timeZone: first.departureTimeZone }).format(new Date(first.departureAt));
 const codes = [first.originPlaceId, ...leg.segments.map(segment => segment.destinationPlaceId), ...(roundTrip?.segments.length ? [roundTrip.segments[0]!.originPlaceId, ...roundTrip.segments.map(segment => segment.destinationPlaceId)] : [])].map(id => catalog.places.find(item => item.id === id)?.code).filter((code): code is string => Boolean(code)).filter((code,index,items)=>index===0||code!==items[index-1]);
 const returnFirst = roundTrip?.segments[0];
 const localDeparture = (segment: typeof first) => new Intl.DateTimeFormat('fa-IR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: segment.departureTimeZone }).format(new Date(segment.departureAt));
 const service = returnFirst ? `${displayOperatorName(first.operatorId, first.mode)} · رفت ${localDeparture(first)} · برگشت ${returnFirst.operatorId === first.operatorId ? '' : `${displayOperatorName(returnFirst.operatorId, returnFirst.mode)} `}${localDeparture(returnFirst)}` : `${displayOperatorName(first.operatorId, first.mode)} · ${departure}`;
 return { key: `${itinerary.itineraryId}:${direction}${returnFirst ? ':round-trip' : ''}`, labels, service, codes: codes.length > 1 ? codes.join(' → ') : undefined };
}
