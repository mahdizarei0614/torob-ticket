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

interface StopBoundary {
  placeId: string;
  arrival: number;
  departure: number;
  requiresVehicleChange: boolean;
  requiresGroundTransfer: boolean;
}

/** Return an earliest feasible bound without filling in omitted source timestamps. */
function stopCompletion(stop: JourneyLeg['stops'][number], previousDeparture: number, legEnd: number, boundary?: StopBoundary): number | undefined {
  const arrival = boundary?.arrival ?? (stop.arrivalAt ? Date.parse(stop.arrivalAt) : undefined);
  const departure = boundary?.departure ?? (stop.departureAt ? Date.parse(stop.departureAt) : undefined);
  const waitMilliseconds = stop.waitMinutes * 60000;
  const earliestArrival = arrival ?? (departure === undefined ? previousDeparture : departure - waitMilliseconds);
  const earliestDeparture = departure ?? earliestArrival + waitMilliseconds;
  const fitsSourceOrder = earliestArrival >= previousDeparture;
  const fitsKnownWait = earliestDeparture - earliestArrival === waitMilliseconds;
  return fitsSourceOrder && fitsKnownWait && earliestDeparture <= legEnd ? earliestDeparture : undefined;
}

function matchesStopBoundary(stop: JourneyLeg['stops'][number], boundary: StopBoundary): boolean {
  return stop.placeId === boundary.placeId &&
    (!stop.arrivalAt || Date.parse(stop.arrivalAt) === boundary.arrival) &&
    (!stop.departureAt || Date.parse(stop.departureAt) === boundary.departure) &&
    (!boundary.requiresVehicleChange || stop.vehicleChange) &&
    (!boundary.requiresGroundTransfer || stop.kind === 'ground-transfer' && stop.vehicleChange);
}

/** Match distinct junctions in source order, allowing genuinely optional stop times. */
function validateStopSequence(leg: JourneyLeg, junctions: StopBoundary[], knownPlaceIds: ReadonlySet<string>): string[] {
  const legStart = Date.parse(leg.segments[0]!.departureAt);
  const legEnd = Date.parse(leg.segments.at(-1)!.arrivalAt);
  let earliestByMatchedCount = new Map([[0, legStart]]);
  for (const stop of leg.stops) {
    if (!knownPlaceIds.has(stop.placeId)) return ['UNKNOWN_STOP_PLACE'];
    if (stop.waitMinutes > (legEnd - legStart) / 60000) return ['INVALID_STOP_TIMING'];
    const next = new Map<number, number>();
    const retainEarliest = (matchedCount: number, completion: number | undefined) => {
      if (completion !== undefined) next.set(matchedCount, Math.min(next.get(matchedCount) ?? completion, completion));
    };
    for (const [matchedCount, previousDeparture] of earliestByMatchedCount) {
      retainEarliest(matchedCount, stopCompletion(stop, previousDeparture, legEnd));
      const boundary = junctions[matchedCount];
      if (boundary && matchesStopBoundary(stop, boundary)) {
        retainEarliest(matchedCount + 1, stopCompletion(stop, previousDeparture, legEnd, boundary));
      }
    }
    if (!next.size) return ['INVALID_STOP_TIMING'];
    // For the same number of matched junctions, an earlier completion dominates a later one.
    // At most junctions.length + 1 states survive; no sorting, recursion, or source mutation.
    earliestByMatchedCount = next;
  }
  return earliestByMatchedCount.has(junctions.length) ? [] : ['MISSING_CONNECTION_EVIDENCE'];
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
    const junctions: StopBoundary[] = [];
    for (const [index, segment] of leg.segments.entries()) {
      const origin = placeById.get(segment.originPlaceId);
      const destination = placeById.get(segment.destinationPlaceId);
      const matchingZones = origin?.timeZone === segment.departureTimeZone && destination?.timeZone === segment.arrivalTimeZone;
      if (!matchingZones) return ['UNKNOWN_PLACE_OR_ZONE'];
      const previous = leg.segments[index - 1];
      if (!previous) continue;
      const continuous = previous.destinationPlaceId === segment.originPlaceId && Date.parse(previous.arrivalAt) <= Date.parse(segment.departureAt);
      if (!continuous) return ['DISCONTINUOUS_JOURNEY'];
      junctions.push({
        placeId: segment.originPlaceId,
        arrival: Date.parse(previous.arrivalAt),
        departure: Date.parse(segment.departureAt),
        requiresVehicleChange: previous.serviceId !== segment.serviceId || previous.operatorId !== segment.operatorId,
        requiresGroundTransfer: segment.mode !== query.mode,
      });
    }
    const stopReasons = validateStopSequence(leg, junctions, new Set(placeById.keys()));
    if (stopReasons.length) return stopReasons;
  }
  const returnDeparture = itinerary.return?.segments[0];
  const outboundArrival = itinerary.outbound.segments.at(-1)!;
  if (returnDeparture && Date.parse(returnDeparture.departureAt) < Date.parse(outboundArrival.arrivalAt)) return ['RETURN_BEFORE_OUTBOUND_ARRIVAL'];
  return [];
}
