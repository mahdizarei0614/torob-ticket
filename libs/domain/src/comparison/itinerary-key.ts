import type { Itinerary, JourneyLeg } from '@torob-ticket/contracts';

/** Canonical values, independent of object insertion order. Array order is meaningful. */
export function canonicalValue(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalValue).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).filter(key => object[key] !== undefined).sort()
    .map(key => `${JSON.stringify(key)}:${canonicalValue(object[key])}`).join(',')}}`;
}

/** 128-bit FNV-1a content identity; not an authentication or authorization token. */
export function comparisonId(prefix: string, value: unknown): string {
  let hash = 0x6c62272e07bb014262b821756295c58dn;
  const prime = 0x0000000001000000000000000000013bn;
  const mask = (1n << 128n) - 1n;
  const input = canonicalValue(value);
  // Hash both bytes of each UTF-16 code unit for browser/server parity without a runtime dependency.
  for (let index = 0; index < input.length; index++) {
    const code = input.charCodeAt(index);
    hash = ((hash ^ BigInt(code & 255)) * prime) & mask;
    hash = ((hash ^ BigInt(code >>> 8)) * prime) & mask;
  }
  return `${prefix}-${hash.toString(16).padStart(32, '0')}`;
}

function legIdentity(leg: JourneyLeg) {
  return {
    segments: leg.segments.map(segment => ({
      mode: segment.mode,
      serviceId: segment.serviceId,
      operatorId: segment.operatorId,
      origin: segment.originPlaceId,
      destination: segment.destinationPlaceId,
      departure: Date.parse(segment.departureAt),
      arrival: Date.parse(segment.arrivalAt),
      departureZone: segment.departureTimeZone,
      arrivalZone: segment.arrivalTimeZone,
    })),
    stops: leg.stops.map(stop => ({
      place: stop.placeId,
      kind: stop.kind,
      vehicleChange: stop.vehicleChange,
      waitMinutes: stop.waitMinutes,
      arrival: stop.arrivalAt ? Date.parse(stop.arrivalAt) : undefined,
      departure: stop.departureAt ? Date.parse(stop.departureAt) : undefined,
    })),
  };
}

/** Seller-assigned itinerary/segment IDs and fare amounts are deliberately outside journey identity. */
export function itineraryKey(itinerary: Itinerary): string {
  return comparisonId('journey', {
    mode: itinerary.mode,
    origin: itinerary.originPlaceId,
    destination: itinerary.destinationPlaceId,
    outbound: legIdentity(itinerary.outbound),
    return: itinerary.return ? legIdentity(itinerary.return) : undefined,
  });
}
