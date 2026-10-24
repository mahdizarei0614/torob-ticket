import { z } from 'zod';
import { GeoPointSchema, IdSchema, ISOInstantSchema, KnownBooleanSchema, LocalDateSchema, MoneySchema, NonnegativeIntegerSchema, PartySchema, PositiveIntegerSchema, ProvenanceSchema } from './common';
import { EligibilitySchema, PriceBreakdownSchema, PriceCompletenessSchema } from './offer';

export const HotelSearchQuerySchema = z.strictObject({
  destinationCityId: IdSchema, checkIn: LocalDateSchema, checkOut: LocalDateSchema, party: PartySchema,
  childAgesAtCheckIn: z.array(NonnegativeIntegerSchema).optional(), rooms: PositiveIntegerSchema.max(9),
  sort: z.enum(['cheapest', 'stars', 'arrival-distance', 'location-distance']), arrivalPlaceId: IdSchema.optional(), customPoint: GeoPointSchema.optional(),
}).superRefine((query, ctx) => {
  if (query.checkOut <= query.checkIn) ctx.addIssue({ code: 'custom', path: ['checkOut'], message: 'checkout-must-follow-checkin' });
  if (query.rooms > query.party.adults) ctx.addIssue({ code: 'custom', path: ['rooms'], message: 'each-room-requires-adult' });
  if (query.childAgesAtCheckIn && query.childAgesAtCheckIn.length !== query.party.children) ctx.addIssue({ code: 'custom', path: ['childAgesAtCheckIn'], message: 'stay-child-ages-required' });
  if (query.sort === 'arrival-distance' && !query.arrivalPlaceId) ctx.addIssue({ code: 'custom', path: ['arrivalPlaceId'], message: 'arrival-reference-required' });
  if (query.sort === 'location-distance' && !query.customPoint) ctx.addIssue({ code: 'custom', path: ['customPoint'], message: 'location-reference-required' });
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
  if (room.adults + room.children + room.infants > 9) ctx.addIssue({ code: 'custom', path: ['adults'], message: 'party-total-exceeds-nine' });
  if (room.childAgesAtCheckIn && room.childAgesAtCheckIn.length !== room.children) ctx.addIssue({ code: 'custom', path: ['childAgesAtCheckIn'], message: 'age-count-mismatch' });
  if (room.infantAgesMonths && room.infantAgesMonths.length !== room.infants) ctx.addIssue({ code: 'custom', path: ['infantAgesMonths'], message: 'age-count-mismatch' });
});
export type RoomAllocation = z.infer<typeof RoomAllocationSchema>;
export const HotelQuoteSnapshotSchema = z.strictObject({
  quoteId: IdSchema, version: PositiveIntegerSchema, hotelId: IdSchema, providerId: IdSchema, query: HotelSearchQuerySchema,
  roomAllocation: z.array(RoomAllocationSchema).min(1), total: MoneySchema, breakdown: PriceBreakdownSchema, completeness: PriceCompletenessSchema,
  eligibility: EligibilitySchema, terms: HotelTermsSchema, observedAt: ISOInstantSchema, expiresAt: ISOInstantSchema,
  sourceRevision: IdSchema, mappingRevision: IdSchema, fixtureVersion: IdSchema, provenance: z.array(ProvenanceSchema).min(1),
}).refine(quote => Date.parse(quote.expiresAt) > Date.parse(quote.observedAt), { path: ['expiresAt'], message: 'expiry-must-follow-observation' });
export type HotelQuoteSnapshot = z.infer<typeof HotelQuoteSnapshotSchema>;
export const HotelSearchSnapshotSchema = z.strictObject({ hotelSearchId: IdSchema, query: HotelSearchQuerySchema, status: z.enum(['complete', 'empty', 'failed']), hotels: z.array(HotelSchema), quotes: z.array(HotelQuoteSnapshotSchema), observedAt: ISOInstantSchema });
export type HotelSearchSnapshot = z.infer<typeof HotelSearchSnapshotSchema>;
