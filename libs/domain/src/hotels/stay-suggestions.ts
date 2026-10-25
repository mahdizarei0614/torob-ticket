import { TimeZoneSchema, type Itinerary } from '@torob-ticket/contracts';
import { localDateAt } from '../time';
import { fromAbsolute } from '@internationalized/date';
export function suggestHotelStay(itinerary: Itinerary | undefined, destinationTimeZone: string, checkInLocalTime?: string) {
    TimeZoneSchema.parse(destinationTimeZone);
    const arrival = itinerary?.outbound.segments.at(-1), departure = itinerary?.return?.segments[0];
    const checkIn = arrival ? localDateAt(arrival.arrivalAt, destinationTimeZone) : undefined, checkOut = departure ? localDateAt(departure.departureAt, destinationTimeZone) : undefined;
    const local = arrival ? fromAbsolute(Date.parse(arrival.arrivalAt), destinationTimeZone) : undefined;
    const standard = checkInLocalTime && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(checkInLocalTime) ? checkInLocalTime : undefined;
    return { checkIn, checkOut, arrivalPlaceId: arrival?.destinationPlaceId, needsArrivalConfirmation: !arrival, needsCheckOut: !checkOut || Boolean(checkIn && checkOut <= checkIn), earlyArrival: Boolean(local && standard && local.hour * 60 + local.minute < Number(standard.slice(0, 2)) * 60 + Number(standard.slice(3))), earlyAccessPromised: false as const };
}
