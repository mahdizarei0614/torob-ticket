import { z } from 'zod';
import { GeoPointSchema, IdSchema, ISOInstantSchema, KnownBooleanSchema, LocalDateSchema, MoneySchema, NonnegativeIntegerSchema, PartySchema, PositiveIntegerSchema, ProvenanceSchema } from './common';
import { EligibilitySchema, PriceBreakdownSchema, PriceCompletenessSchema } from './offer';
export const HotelSearchQuerySchema = z.strictObject({
    destinationCityId: IdSchema, checkIn: LocalDateSchema, checkOut: LocalDateSchema, party: PartySchema,
    childAgesAtCheckIn: z.array(NonnegativeIntegerSchema).optional(), rooms: PositiveIntegerSchema.max(9),
    sort: z.enum(['cheapest', 'stars', 'arrival-distance', 'location-distance']), arrivalPlaceId: IdSchema.optional(), customPoint: GeoPointSchema.optional(),
}).superRefine((query, ctx) => {
    if (query.checkOut <= query.checkIn)
        ctx.addIssue({ code: 'custom', path: ['checkOut'], message: 'checkout-must-follow-checkin' });
    if (query.rooms > query.party.adults)
        ctx.addIssue({ code: 'custom', path: ['rooms'], message: 'each-room-requires-adult' });
    if (query.childAgesAtCheckIn && query.childAgesAtCheckIn.length !== query.party.children)
        ctx.addIssue({ code: 'custom', path: ['childAgesAtCheckIn'], message: 'stay-child-ages-required' });
    if (query.sort === 'arrival-distance' && !query.arrivalPlaceId)
        ctx.addIssue({ code: 'custom', path: ['arrivalPlaceId'], message: 'arrival-reference-required' });
    if (query.sort === 'location-distance' && !query.customPoint)
        ctx.addIssue({ code: 'custom', path: ['customPoint'], message: 'location-reference-required' });
});
export type HotelSearchQuery = z.infer<typeof HotelSearchQuerySchema>;
export const HotelSchema = z.strictObject({ hotelId: IdSchema, destinationCityId: IdSchema, name: IdSchema, point: GeoPointSchema, stars: NonnegativeIntegerSchema.max(5).nullable(), address: IdSchema, provenance: z.array(ProvenanceSchema).min(1) });
export type Hotel = z.infer<typeof HotelSchema>;
export const HotelTermsSchema = z.strictObject({ breakfast: KnownBooleanSchema, refundable: KnownBooleanSchema, cancellation: z.discriminatedUnion('status', [z.strictObject({ status: z.literal('known'), policyCode: IdSchema }), z.strictObject({ status: z.literal('unknown'), reason: IdSchema })]), fees: PriceCompletenessSchema, materialTerms: z.array(IdSchema) });
export const RoomRateSchema = z.strictObject({ roomRateId: IdSchema, hotelId: IdSchema, providerId: IdSchema, roomType: IdSchema, maxAdults: PositiveIntegerSchema, maxChildren: NonnegativeIntegerSchema, maxInfants: NonnegativeIntegerSchema, infantCountsTowardOccupancy: KnownBooleanSchema, nightlyPrices: z.array(z.strictObject({ date: LocalDateSchema, total: MoneySchema, availableRooms: NonnegativeIntegerSchema })), terms: HotelTermsSchema, provenance: z.array(ProvenanceSchema).min(1) });
export type RoomRate = z.infer<typeof RoomRateSchema>;
export const RoomAllocationSchema = z.strictObject({
    roomNumber: PositiveIntegerSchema, roomRateId: IdSchema,
    adults: PositiveIntegerSchema.max(9), children: NonnegativeIntegerSchema.max(8), infants: NonnegativeIntegerSchema.max(9),
    childAgesAtCheckIn: z.array(NonnegativeIntegerSchema).optional(), infantAgesMonths: z.array(NonnegativeIntegerSchema).optional(),
}).superRefine((room, ctx) => {
    if (room.adults + room.children + room.infants > 9)
        ctx.addIssue({ code: 'custom', path: ['adults'], message: 'party-total-exceeds-nine' });
    if (room.childAgesAtCheckIn && room.childAgesAtCheckIn.length !== room.children)
        ctx.addIssue({ code: 'custom', path: ['childAgesAtCheckIn'], message: 'age-count-mismatch' });
    if (room.infantAgesMonths && room.infantAgesMonths.length !== room.infants)
        ctx.addIssue({ code: 'custom', path: ['infantAgesMonths'], message: 'age-count-mismatch' });
});
export type RoomAllocation = z.infer<typeof RoomAllocationSchema>;
/** Published authored policy; an absent combined limit is never inferred. */
export const HotelRoomPolicySchema = z.strictObject({ revision: IdSchema, eachRoomRequiresAdult: z.literal(true), childAgeRequired: z.boolean(), maxChildAge: NonnegativeIntegerSchema, checkInLocalTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/), earlyAccessPromised: z.literal(false), maxOccupants: PositiveIntegerSchema.optional() });
export type HotelRoomPolicy = z.infer<typeof HotelRoomPolicySchema>;
export const HotelRoomDetailSchema = z.strictObject({ roomNumber: PositiveIntegerSchema, roomRateId: IdSchema, roomType: IdSchema, maxAdults: PositiveIntegerSchema, maxChildren: NonnegativeIntegerSchema, maxInfants: NonnegativeIntegerSchema, infantCountsTowardOccupancy: KnownBooleanSchema, terms: HotelTermsSchema, policy: HotelRoomPolicySchema, provenance: z.array(ProvenanceSchema).min(1) });
export const HotelComparisonResultSchema = z.strictObject({ hotelId: IdSchema, status: z.enum(['priced', 'ineligible', 'unknown', 'incomplete', 'unavailable', 'failed']), reasons: z.array(IdSchema), representativeQuoteId: IdSchema.nullable(), quoteIds: z.array(IdSchema), arrivalDistanceKm: z.number().nonnegative().nullable(), locationDistanceKm: z.number().nonnegative().nullable(), distanceKind: z.literal('straight-line'), knownSubtotal: MoneySchema.optional() });
export type HotelComparisonResult = z.infer<typeof HotelComparisonResultSchema>;
export const HotelQuoteSnapshotSchema = z.strictObject({
    quoteId: IdSchema, version: PositiveIntegerSchema, hotelId: IdSchema, providerId: IdSchema, query: HotelSearchQuerySchema,
    roomDetails: z.array(HotelRoomDetailSchema).max(9).optional(),
    roomAllocation: z.array(RoomAllocationSchema).min(1).max(9), total: MoneySchema, breakdown: PriceBreakdownSchema, completeness: PriceCompletenessSchema,
    eligibility: EligibilitySchema, terms: HotelTermsSchema, observedAt: ISOInstantSchema, expiresAt: ISOInstantSchema,
    sourceRevision: IdSchema, mappingRevision: IdSchema, fixtureVersion: IdSchema, provenance: z.array(ProvenanceSchema).min(1),
}).superRefine((quote, ctx) => {
    const issue = (message: string, path: (string | number)[] = []) => ctx.addIssue({ code: 'custom', path, message });
    if (Date.parse(quote.expiresAt) <= Date.parse(quote.observedAt))
        issue('expiry-must-follow-observation', ['expiresAt']);
    if (quote.roomAllocation.length !== quote.query.rooms)
        issue('exact-room-count-required', ['roomAllocation']);
    for (const key of ['adults', 'children', 'infants'] as const)
        if (quote.roomAllocation.reduce((sum, r) => sum + r[key], 0) !== quote.query.party[key])
            issue('allocation-party-mismatch', ['roomAllocation']);
    if (new Set(quote.roomAllocation.map(r => r.roomNumber)).size !== quote.query.rooms || quote.roomAllocation.some(r => r.roomNumber > quote.query.rooms))
        issue('room-number-sequence-required', ['roomAllocation']);
    const ages = (values: number[]) => values.slice().sort((a, b) => a - b).join(',');
    if (quote.query.childAgesAtCheckIn && ages(quote.roomAllocation.flatMap(r => r.childAgesAtCheckIn ?? [])) !== ages(quote.query.childAgesAtCheckIn))
        issue('stay-age-allocation-mismatch', ['roomAllocation']);
    if (quote.query.party.infantAgesMonths && ages(quote.roomAllocation.flatMap(r => r.infantAgesMonths ?? [])) !== ages(quote.query.party.infantAgesMonths))
        issue('infant-age-allocation-mismatch', ['roomAllocation']);
    if (quote.roomDetails && (quote.roomDetails.length !== quote.query.rooms || quote.roomDetails.some(d => !quote.roomAllocation.some(r => r.roomNumber === d.roomNumber && r.roomRateId === d.roomRateId)) || new Set(quote.roomDetails.map(d => d.roomNumber)).size !== quote.query.rooms))
        issue('room-detail-allocation-mismatch', ['roomDetails']);
    const total = quote.breakdown.reduce((sum, line) => sum + BigInt(line.amount.amountRial), 0n);
    if (total !== BigInt(quote.total.amountRial))
        issue('breakdown-total-mismatch', ['breakdown']);
});
export type HotelQuoteSnapshot = z.infer<typeof HotelQuoteSnapshotSchema>;
const stableHotelValue = (value: unknown): string => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b, 'en'))) : item);
const sameHotelQuery = (a: HotelSearchQuery, b: HotelSearchQuery) => stableHotelValue(a) === stableHotelValue(b);
export const HotelSearchSnapshotSchema = z.strictObject({ hotelSearchId: IdSchema, query: HotelSearchQuerySchema, status: z.enum(['complete', 'empty', 'failed']), hotels: z.array(HotelSchema), quotes: z.array(HotelQuoteSnapshotSchema), results: z.array(HotelComparisonResultSchema).optional(), observedAt: ISOInstantSchema }).superRefine((snapshot, ctx) => {
    if (!snapshot.results)
        return;
    const error = (message: string) => ctx.addIssue({ code: 'custom', path: ['results'], message });
    if (new Set(snapshot.quotes.map(q => q.quoteId)).size !== snapshot.quotes.length || snapshot.quotes.some(q => !snapshot.hotels.some(h => h.hotelId === q.hotelId) || !sameHotelQuery(q.query, snapshot.query) || q.completeness.status !== 'complete' || q.eligibility.status !== 'eligible'))
        error('snapshot-quote-evidence-mismatch');
    if ((snapshot.status === 'complete') !== Boolean(snapshot.quotes.length))
        error('snapshot-status-quote-mismatch');
    if (snapshot.results.length !== snapshot.hotels.length || new Set(snapshot.results.map(r => r.hotelId)).size !== snapshot.hotels.length || snapshot.results.some(r => !snapshot.hotels.some(h => h.hotelId === r.hotelId)))
        error('hotel-result-membership-mismatch');
    for (const row of snapshot.results) {
        const quotes = snapshot.quotes.filter(q => q.hotelId === row.hotelId);
        if (row.quoteIds.length !== quotes.length || new Set(row.quoteIds).size !== quotes.length || row.quoteIds.some(id => !quotes.some(q => q.quoteId === id)))
            error('hotel-quote-membership-mismatch');
        if (row.status === 'priced' ? !row.representativeQuoteId || !quotes.some(q => q.quoteId === row.representativeQuoteId && q.eligibility.status === 'eligible' && q.completeness.status === 'complete') : row.representativeQuoteId !== null || row.quoteIds.length !== 0)
            error('hotel-representative-mismatch');
    }
});
export type HotelSearchSnapshot = z.infer<typeof HotelSearchSnapshotSchema>;
