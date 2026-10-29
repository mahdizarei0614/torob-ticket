import { z } from 'zod';
import { CoverageSchema, DataIssueSchema, GeoPointSchema, IdSchema, ISOInstantSchema, KnownBooleanSchema, KnownQuantitySchema, ModeSchema, MoneySchema, NonnegativeIntegerSchema, PartySchema, PositiveIntegerSchema, ProvenanceSchema } from './common';

// Repeated schema parsing sees the same small set of IANA strings. Cache only
// native validity, retaining exact input/IdSchema semantics and bounded memory.
const timeZoneValidity=new Map<string,boolean>();
const maximumTimeZoneKeys=128;
function validTimeZone(value:string):boolean {
  const cached=timeZoneValidity.get(value);
  if(cached!==undefined){timeZoneValidity.delete(value);timeZoneValidity.set(value,cached);return cached;}
  let valid:boolean;
  try{new Intl.DateTimeFormat('en',{timeZone:value});valid=!/^[+-]/.test(value);}catch{valid=false;}
  // IdSchema rejects overlong strings; do not retain arbitrary oversized inputs
  // even when Zod also runs this refinement to collect its original error issues.
  if(value.length<=200){
    if(timeZoneValidity.size>=maximumTimeZoneKeys)timeZoneValidity.delete(timeZoneValidity.keys().next().value!);
    timeZoneValidity.set(value,valid);
  }
  return valid;
}
export const TimeZoneSchema=IdSchema.refine(validTimeZone,'invalid-time-zone');
export const PlaceSchema = z.strictObject({ id: IdSchema, cityId: IdSchema, name: IdSchema, kind: z.enum(['airport', 'station', 'terminal', 'landmark']), code: IdSchema.optional(), point: GeoPointSchema, timeZone: TimeZoneSchema });
export type Place = z.infer<typeof PlaceSchema>;
export const SegmentSchema = z.strictObject({
  segmentId: IdSchema, mode: ModeSchema, serviceId: IdSchema, operatorId: IdSchema,
  originPlaceId: IdSchema, destinationPlaceId: IdSchema,
  departureAt: ISOInstantSchema, arrivalAt: ISOInstantSchema, departureTimeZone: TimeZoneSchema, arrivalTimeZone: TimeZoneSchema,
}).refine(segment => Date.parse(segment.arrivalAt) > Date.parse(segment.departureAt), { path: ['arrivalAt'], message: 'arrival-must-follow-departure' });
export type Segment = z.infer<typeof SegmentSchema>;
export const JourneyStopSchema = z.strictObject({
  placeId: IdSchema, kind: z.enum(['connection', 'dwell', 'technical-stop', 'ground-transfer']), waitMinutes: NonnegativeIntegerSchema, vehicleChange: z.boolean(),
  arrivalAt: ISOInstantSchema.optional(), departureAt: ISOInstantSchema.optional(),
});
export const JourneyLegSchema = z.strictObject({ segments: z.array(SegmentSchema).min(1), stops: z.array(JourneyStopSchema) });
export type JourneyLeg = z.infer<typeof JourneyLegSchema>;
export const ItinerarySchema = z.strictObject({ itineraryId: IdSchema, mode: ModeSchema, originPlaceId: IdSchema, destinationPlaceId: IdSchema, outbound: JourneyLegSchema, return: JourneyLegSchema.optional() });
export type Itinerary = z.infer<typeof ItinerarySchema>;
export const LegFareConditionsSchema = z.strictObject({
  classCode: IdSchema, checkedBaggageKg: KnownQuantitySchema, cabinBaggageKg: KnownQuantitySchema,
  refundable: KnownBooleanSchema, cancellation: z.discriminatedUnion('status', [
    z.strictObject({ status: z.literal('known'), policyCode: IdSchema, penalty: MoneySchema.optional() }),
    z.strictObject({ status: z.literal('unknown'), reason: IdSchema }),
  ]),
  seatOrBerth: z.discriminatedUnion('status', [z.strictObject({ status: z.literal('known'), value: IdSchema }), z.strictObject({ status: z.literal('unknown'), reason: IdSchema })]),
  materialTerms: z.array(IdSchema),
});
export const FareConditionsSchema = z.strictObject({ outbound: LegFareConditionsSchema, return: LegFareConditionsSchema.optional() });
export type FareConditions = z.infer<typeof FareConditionsSchema>;
export const PriceBreakdownSchema = z.array(z.strictObject({ code: IdSchema, amount: MoneySchema, mandatory: z.boolean() }));
export const PriceCompletenessSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('complete') }),
  z.strictObject({ status: z.literal('incomplete'), missing: z.array(IdSchema).min(1) }),
]);
export const EligibilitySchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('eligible') }),
  z.strictObject({ status: z.literal('ineligible'), reasons: z.array(IdSchema).min(1) }),
  z.strictObject({ status: z.literal('unknown'), reasons: z.array(IdSchema).min(1) }),
]);
export const NormalizedOfferSchema = z.strictObject({
  offerId: IdSchema, providerId: IdSchema, fareId: IdSchema, itinerary: ItinerarySchema,
  conditions: FareConditionsSchema, total: MoneySchema.optional(), breakdown: PriceBreakdownSchema,
  completeness: PriceCompletenessSchema, eligibility: EligibilitySchema, availability: KnownBooleanSchema,
  observedAt: ISOInstantSchema, provenance: z.array(ProvenanceSchema).min(1), issues: z.array(DataIssueSchema),
}).refine(offer => offer.completeness.status !== 'complete' || offer.total !== undefined, { path: ['total'], message: 'complete-price-requires-total' });
export type NormalizedOffer = z.infer<typeof NormalizedOfferSchema>;
export const QuoteSnapshotSchema = z.strictObject({
  quoteId: IdSchema, version: PositiveIntegerSchema, itineraryId: IdSchema, fareId: IdSchema, providerId: IdSchema,
  party: PartySchema, total: MoneySchema, breakdown: PriceBreakdownSchema, completeness: PriceCompletenessSchema,
  eligibility: EligibilitySchema, conditions: FareConditionsSchema, observedAt: ISOInstantSchema, expiresAt: ISOInstantSchema,
  sourceRevision: IdSchema, mappingRevision: IdSchema, fixtureVersion: IdSchema, provenance: z.array(ProvenanceSchema).min(1),
}).refine(quote => Date.parse(quote.expiresAt) > Date.parse(quote.observedAt), { path: ['expiresAt'], message: 'expiry-must-follow-observation' });
export type QuoteSnapshot = z.infer<typeof QuoteSnapshotSchema>;
export const ComparisonGroupSchema = z.strictObject({
  groupId: IdSchema, itinerary: ItinerarySchema, eligibleQuotes: z.array(QuoteSnapshotSchema.refine(quote => quote.completeness.status === 'complete' && quote.eligibility.status === 'eligible', 'eligible-complete-quote-required')), incompletePriceOffers: z.array(NormalizedOfferSchema),
  representativeQuoteId: IdSchema.optional(), durationMinutes: NonnegativeIntegerSchema, connectionCount: NonnegativeIntegerSchema,
});
export type ComparisonGroup = z.infer<typeof ComparisonGroupSchema>;
export const ExplanationSchema = z.strictObject({ reasonCode: z.enum(['price-difference', 'time-saved', 'connection-count', 'baggage-difference', 'provider-coverage']), facts: z.record(z.string(), z.number().finite()), baselineIds: z.array(IdSchema).min(1), coverage: CoverageSchema });
export type Explanation = z.infer<typeof ExplanationSchema>;
export const SuggestionSchema = z.strictObject({
  kind: z.enum(['nearby-date', 'faster-journey']), alternativeId: IdSchema, baselineId: IdSchema,
  delta: z.strictObject({ amountRial: z.number().int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER), minutes: z.number().finite(), priceRatio: z.number().finite() }),
  coverage: CoverageSchema, dismissalScope: z.strictObject({ searchId: IdSchema }),
});
export type Suggestion = z.infer<typeof SuggestionSchema>;
