import { compareHotelKeys } from './canonical-order';
import type { HotelSearchQuery } from '@torob-ticket/contracts';
import type { HotelRankInput } from './types';
const unknownLast = (a: number | null, b: number | null, descending = false) => a === null ? (b === null ? 0 : 1) : b === null ? -1 : descending ? b - a : a - b;
export function rankHotels(entries: HotelRankInput[], sort: HotelSearchQuery['sort']) {
    return entries.slice().sort((a, b) => {
        const actionable = (e: HotelRankInput) => Boolean(e.quote && e.quote.eligibility.status === 'eligible' && e.quote.completeness.status === 'complete');
        const aReady = actionable(a), bReady = actionable(b);
        if (aReady !== bReady)
            return aReady ? -1 : 1;
        const metric = sort === 'stars' ? unknownLast(a.hotel.stars, b.hotel.stars, true) : sort === 'arrival-distance' ? unknownLast(a.arrivalDistanceKm, b.arrivalDistanceKm) : sort === 'location-distance' ? unknownLast(a.locationDistanceKm, b.locationDistanceKm) : 0;
        return metric || unknownLast(a.quote?.total.amountRial ?? null, b.quote?.total.amountRial ?? null) || compareHotelKeys(a.hotel.hotelId, b.hotel.hotelId);
    });
}
