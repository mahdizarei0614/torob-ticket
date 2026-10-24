import type { Itinerary, JourneyLeg, Mode, NormalizedOffer, Place, TransportSearchQuery } from '@torob-ticket/contracts';
import { elapsedMinutes, localDateAt } from '../time';

/** Ancillary ground travel must be supplied with an explicit transfer marker. */
export function hasSupportedSegmentModes(leg: JourneyLeg, mode: Mode): boolean {
  return leg.segments.some(segment => segment.mode === mode) && leg.segments.every((segment, index) => {
    if (segment.mode === mode) return true;
    return mode === 'flight' && segment.mode === 'bus' && index > 0 &&
      leg.stops.some(stop => stop.kind === 'ground-transfer' && stop.vehicleChange && stop.placeId === segment.originPlaceId);
  });
}

export function journeyConnectionCount(itinerary: Itinerary): number {
  const legs = [itinerary.outbound, ...(itinerary.return ? [itinerary.return] : [])];
  return legs.reduce((count, leg) => count + leg.stops.filter(stop => itinerary.mode === 'flight' || stop.vehicleChange).length, 0);
}

export function journeyDurationMinutes(itinerary: Itinerary): number {
  const legs = [itinerary.outbound, ...(itinerary.return ? [itinerary.return] : [])];
  const minutes = legs.reduce((total, leg) => total + elapsedMinutes(leg.segments[0]!.departureAt, leg.segments.at(-1)!.arrivalAt), 0);
  // DTO durations use whole minutes; round once after summing, never include destination stay.
  return Math.ceil(minutes);
}

/** Validate a single supplied provider itinerary. No outbound/return combination is performed. */
export function validateCompleteJourney(
  offer: NormalizedOffer,
  query: TransportSearchQuery,
  places: readonly Pick<Place, 'id' | 'cityId' | 'timeZone'>[],
): string[] {
  const itinerary = offer.itinerary;
  const roundTrip = query.tripType === 'round-trip';
  if (itinerary.mode !== query.mode) return ['MODE_MISMATCH'];
  if (Boolean(itinerary.return) !== roundTrip || Boolean(offer.conditions.return) !== roundTrip) return ['INCOMPLETE_ITINERARY'];
  const placeById = new Map(places.map(place => [place.id, place]));
  if (placeById.size !== places.length) return ['AMBIGUOUS_PLACE'];
  const legs = [itinerary.outbound, ...(itinerary.return ? [itinerary.return] : [])];
  for (const [direction, leg] of legs.entries()) {
    const first = leg.segments[0];
    const last = leg.segments.at(-1);
    if (!first || !last) return ['INCOMPLETE_ITINERARY'];
    if (!hasSupportedSegmentModes(leg, query.mode)) return ['UNSUPPORTED_SEGMENT_MODE'];
    const originCityId = direction === 0 ? query.originCityId : query.destinationCityId;
    const destinationCityId = direction === 0 ? query.destinationCityId : query.originCityId;
    const matchingCities = placeById.get(first.originPlaceId)?.cityId === originCityId && placeById.get(last.destinationPlaceId)?.cityId === destinationCityId;
    if (!matchingCities) return ['ENDPOINT_MISMATCH'];
    const matchingPlaces = first.originPlaceId === itinerary.originPlaceId && last.destinationPlaceId === itinerary.destinationPlaceId;
    if (direction === 0 && !matchingPlaces) return ['ENDPOINT_MISMATCH'];
    const requestedDate = direction === 0 ? query.departureDate : query.returnDate;
    if (localDateAt(first.departureAt, first.departureTimeZone) !== requestedDate) return ['DATE_MISMATCH'];
    for (const [index, segment] of leg.segments.entries()) {
      const origin = placeById.get(segment.originPlaceId);
      const destination = placeById.get(segment.destinationPlaceId);
      const matchingZones = origin?.timeZone === segment.departureTimeZone && destination?.timeZone === segment.arrivalTimeZone;
      if (!matchingZones) return ['UNKNOWN_PLACE_OR_ZONE'];
      const previous = leg.segments[index - 1];
      if (!previous) continue;
      const continuous = previous.destinationPlaceId === segment.originPlaceId && Date.parse(previous.arrivalAt) <= Date.parse(segment.departureAt);
      if (!continuous) return ['DISCONTINUOUS_JOURNEY'];
      const waitMinutes = elapsedMinutes(previous.arrivalAt, segment.departureAt);
      const junction = leg.stops.find(stop => stop.placeId === segment.originPlaceId &&
        stop.waitMinutes === waitMinutes && (!stop.arrivalAt || Date.parse(stop.arrivalAt) === Date.parse(previous.arrivalAt)) &&
        (!stop.departureAt || Date.parse(stop.departureAt) === Date.parse(segment.departureAt)));
      if (!junction) return ['MISSING_CONNECTION_EVIDENCE'];
      const serviceChanges = previous.serviceId !== segment.serviceId || previous.operatorId !== segment.operatorId;
      if (serviceChanges && !junction.vehicleChange) return ['MISSING_VEHICLE_CHANGE'];
      if (segment.mode !== query.mode && (junction.kind !== 'ground-transfer' || !junction.vehicleChange)) return ['MISSING_TRANSFER_EVIDENCE'];
    }
    const legStart = Date.parse(first.departureAt);
    const legEnd = Date.parse(last.arrivalAt);
    for (const stop of leg.stops) {
      if (!placeById.has(stop.placeId)) return ['UNKNOWN_STOP_PLACE'];
      const suppliedTimes = [stop.arrivalAt, stop.departureAt].filter((instant): instant is string => Boolean(instant));
      const timeOutsideLeg = suppliedTimes.some(instant => Date.parse(instant) < legStart || Date.parse(instant) > legEnd);
      if (stop.waitMinutes > (legEnd - legStart) / 60000 || timeOutsideLeg) return ['INVALID_STOP_TIMING'];
      if (stop.arrivalAt && stop.departureAt) {
        const ordered = Date.parse(stop.departureAt) >= Date.parse(stop.arrivalAt);
        if (!ordered || elapsedMinutes(stop.arrivalAt, stop.departureAt) !== stop.waitMinutes) return ['INVALID_STOP_TIMING'];
      }
    }
  }
  const returnDeparture = itinerary.return?.segments[0];
  const outboundArrival = itinerary.outbound.segments.at(-1)!;
  if (returnDeparture && Date.parse(returnDeparture.departureAt) < Date.parse(outboundArrival.arrivalAt)) return ['RETURN_BEFORE_OUTBOUND_ARRIVAL'];
  return [];
}
