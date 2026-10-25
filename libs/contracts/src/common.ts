import { z } from 'zod';

export const IdSchema = z.string().trim().min(1).max(200);
export const NonnegativeIntegerSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const PositiveIntegerSchema = NonnegativeIntegerSchema.min(1);
export const ModeSchema = z.enum(['flight', 'train', 'bus']);
export type Mode = z.infer<typeof ModeSchema>;
export const ScopeSchema = z.enum(['domestic', 'international']);
export type Scope = z.infer<typeof ScopeSchema>;
export const TripTypeSchema = z.enum(['one-way', 'round-trip']);
export type TripType = z.infer<typeof TripTypeSchema>;
/** Gregorian date-only wire value; no Date/UTC truncation. */
export const LocalDateSchema = z.iso.date();
export type LocalDate = z.infer<typeof LocalDateSchema>;
export const ISOInstantSchema = z.iso.datetime({ offset: false, local: false });
export type ISOInstant = z.infer<typeof ISOInstantSchema>;
export const MoneySchema = z.strictObject({ amountRial: NonnegativeIntegerSchema, currency: z.literal('IRR') });
export type Money = z.infer<typeof MoneySchema>;
export const GeoPointSchema = z.strictObject({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) });
export type GeoPoint = z.infer<typeof GeoPointSchema>;
export const PartySchema = z.strictObject({
  adults: PositiveIntegerSchema.max(9), children: NonnegativeIntegerSchema.max(8), infants: NonnegativeIntegerSchema.max(9),
  childAges: z.array(NonnegativeIntegerSchema).max(8).optional(),
  infantAgesMonths: z.array(NonnegativeIntegerSchema).max(9).optional(),
}).superRefine((party, ctx) => {
  if (party.adults + party.children + party.infants > 9) ctx.addIssue({ code: 'custom', path: ['adults'], message: 'party-total-exceeds-nine' });
  if (party.infants > party.adults) ctx.addIssue({ code: 'custom', path: ['infants'], message: 'infants-exceed-adults' });
  if (party.childAges && party.childAges.length !== party.children) ctx.addIssue({ code: 'custom', path: ['childAges'], message: 'age-count-mismatch' });
  if (party.infantAgesMonths && party.infantAgesMonths.length !== party.infants) ctx.addIssue({ code: 'custom', path: ['infantAgesMonths'], message: 'age-count-mismatch' });
});
export type Party = z.infer<typeof PartySchema>;
export const CoverageSchema = z.strictObject({
  expectedProviderIds: z.array(IdSchema), successfulProviderIds: z.array(IdSchema), failedProviderIds: z.array(IdSchema), pendingProviderIds: z.array(IdSchema), complete: z.boolean(),
});
export type Coverage = z.infer<typeof CoverageSchema>;
export const DataIssueSchema = z.strictObject({ code: IdSchema, fieldPath: z.array(z.union([z.string(), NonnegativeIntegerSchema])), severity: z.enum(['warning', 'rejected', 'ambiguous']), rawRecordId: IdSchema.optional() });
export type DataIssue = z.infer<typeof DataIssueSchema>;
/** Unknown is evidence, never an implicit false, zero, or free allowance. */
export const KnownBooleanSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('known'), value: z.boolean() }),
  z.strictObject({ status: z.literal('unknown'), reason: IdSchema }),
]);
export const KnownQuantitySchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('known'), value: z.number().nonnegative() }),
  z.strictObject({ status: z.literal('unknown'), reason: IdSchema }),
]);
export const ProvenanceSchema = z.strictObject({
  rawRecordId: IdSchema, sourceNamespace: IdSchema, sourceValue: z.unknown(),
  sourceRevision: IdSchema, mappingRevision: IdSchema, fixtureVersion: IdSchema,
});
export type Provenance = z.infer<typeof ProvenanceSchema>;
export const ApiErrorCodeSchema = z.enum(['INVALID_QUERY', 'UNSUPPORTED_ROUTE', 'AGE_REQUIRED', 'SESSION_EXPIRED', 'NOT_FOUND', 'SEARCH_LIMIT', 'QUOTE_EXPIRED', 'QUOTE_CHANGED', 'OFFER_UNAVAILABLE', 'INCOMPLETE_PRICE', 'INTENT_EXPIRED', 'IDEMPOTENCY_CONFLICT', 'MAPPING_COLLISION', 'IDENTITY_REQUIRED', 'SAVED_SEARCH_LIMIT']);
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;
export const ApiErrorSchema = z.strictObject({
  code: ApiErrorCodeSchema, fieldPaths: z.array(z.array(z.union([z.string(), NonnegativeIntegerSchema]))), retryable: z.boolean(), requestId: IdSchema,
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
