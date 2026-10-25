import type { Hotel, HotelQuoteSnapshot, HotelSearchQuery, RoomAllocation, RoomRate } from '@torob-ticket/contracts';
export type { HotelRoomPolicy } from '@torob-ticket/contracts';
export interface HotelPriceContext {
    quoteId: string;
    observedAt: string;
    sourceRevision: string;
    mappingRevision: string;
    fixtureVersion: string;
    version?: number;
}
export interface AllocationEvaluation {
    status: 'eligible' | 'ineligible' | 'unknown';
    allocations: RoomAllocation[][];
    reasons: string[];
}
export type StayPriceResult = {
    status: 'priced';
    quote: HotelQuoteSnapshot;
} | {
    status: 'ineligible' | 'unknown' | 'incomplete';
    reasons: string[];
    knownSubtotal?: {
        amountRial: number;
        currency: 'IRR';
    };
};
export interface HotelRankInput {
    hotel: Hotel;
    quote?: HotelQuoteSnapshot;
    arrivalDistanceKm: number | null;
    locationDistanceKm: number | null;
    status?: string;
    reasons?: string[];
}
export type HotelTerms = RoomRate['terms'];
export type HotelRates = readonly RoomRate[];
export type HotelQuery = HotelSearchQuery;
