import { z } from 'zod';
import { CoverageSchema, IdSchema, ISOInstantSchema, LocalDateSchema, ModeSchema, NonnegativeIntegerSchema, PartySchema, PositiveIntegerSchema, ScopeSchema, TripTypeSchema } from './common';
import { ComparisonGroupSchema, ExplanationSchema, SuggestionSchema } from './offer';

export const SortOrderSchema = z.enum(['cheapest', 'fastest', 'fewest-connections']);
export type SortOrder = z.infer<typeof SortOrderSchema>;
const RestrictionListSchema = z.array(IdSchema).transform(ids => ids.length ? [...new Set(ids)].sort() : undefined).optional();
export const EligibilityFiltersSchema = z.strictObject({
  budgetMaxRial: NonnegativeIntegerSchema.optional(),
  departureWindow: z.strictObject({ startMinute: NonnegativeIntegerSchema.max(1439), endMinute: NonnegativeIntegerSchema.max(1439) }).optional(),
  providerIds: RestrictionListSchema, operatorIds: RestrictionListSchema,
  maxStopsOrTransfers: NonnegativeIntegerSchema.optional(), checkedBaggageMinKg: z.number().nonnegative().optional(), refundableOnly: z.boolean().optional(),
}).transform(({ providerIds, operatorIds, ...filters }) => ({ ...filters, ...(providerIds ? { providerIds } : {}), ...(operatorIds ? { operatorIds } : {}) }));
export type EligibilityFilters = z.infer<typeof EligibilityFiltersSchema>;
export const TransportSearchQuerySchema = z.strictObject({
  mode: ModeSchema, scope: ScopeSchema, tripType: TripTypeSchema,
  originCityId: IdSchema, destinationCityId: IdSchema, departureDate: LocalDateSchema, returnDate: LocalDateSchema.optional(),
  party: PartySchema, classCode: IdSchema, filters: EligibilityFiltersSchema, sort: SortOrderSchema,
}).superRefine((query, ctx) => {
  if (query.originCityId === query.destinationCityId) ctx.addIssue({ code: 'custom', path: ['destinationCityId'], message: 'same-origin-destination' });
  if (query.tripType === 'round-trip' && !query.returnDate) ctx.addIssue({ code: 'custom', path: ['returnDate'], message: 'return-date-required' });
  if (query.tripType === 'one-way' && query.returnDate) ctx.addIssue({ code: 'custom', path: ['returnDate'], message: 'one-way-cannot-have-return' });
  if (query.returnDate && query.returnDate < query.departureDate) ctx.addIssue({ code: 'custom', path: ['returnDate'], message: 'return-before-departure' });
});
export type TransportSearchQuery = z.infer<typeof TransportSearchQuerySchema>;
export const SearchRequestSchema = z.strictObject({ query: TransportSearchQuerySchema, clientGeneration: IdSchema });
export type SearchRequest = z.infer<typeof SearchRequestSchema>;
export const SearchStatusSchema = z.enum(['collecting', 'complete', 'partial', 'empty', 'failed', 'cancelled', 'interrupted']);
export type SearchStatus = z.infer<typeof SearchStatusSchema>;
export const ProviderStatusSchema = z.strictObject({ providerId: IdSchema, status: z.enum(['pending', 'running', 'complete', 'failed', 'timeout', 'paused', 'cancelled']), offerCount: NonnegativeIntegerSchema, elapsedMs: NonnegativeIntegerSchema.optional(), reason: IdSchema.optional(), retryable: z.boolean().optional() });
export type ProviderStatus = z.infer<typeof ProviderStatusSchema>;
export const SearchSnapshotSchema = z.strictObject({
  searchId: IdSchema, clientGeneration: IdSchema, query: TransportSearchQuerySchema, status: SearchStatusSchema,
  groups: z.array(ComparisonGroupSchema), providerStatuses: z.array(ProviderStatusSchema), coverage: CoverageSchema, observedAt: ISOInstantSchema,
  explanations: z.array(ExplanationSchema).optional(), suggestion: SuggestionSchema.nullable().optional(), predecessorSearchId: IdSchema.optional(),
});
export type SearchSnapshot = z.infer<typeof SearchSnapshotSchema>;
const EventEnvelope = { searchId: IdSchema, sequence: PositiveIntegerSchema, clientGeneration: IdSchema };
export const SearchEventSchema = z.discriminatedUnion('type', [
  z.strictObject({ ...EventEnvelope, type: z.literal('provider-status'), payload: ProviderStatusSchema }),
  z.strictObject({ ...EventEnvelope, type: z.literal('snapshot'), payload: SearchSnapshotSchema }),
  z.strictObject({ ...EventEnvelope, type: z.literal('terminal'), payload: SearchSnapshotSchema.refine(snapshot => snapshot.status !== 'collecting', { path: ['status'], message: 'terminal-status-required' }) }),
]).superRefine((event, ctx) => {
  if (event.type === 'provider-status') return;
  if (event.payload.searchId !== event.searchId) ctx.addIssue({ code: 'custom', path: ['payload', 'searchId'], message: 'event-search-mismatch' });
  if (event.payload.clientGeneration !== event.clientGeneration) ctx.addIssue({ code: 'custom', path: ['payload', 'clientGeneration'], message: 'event-generation-mismatch' });
});
export type SearchEvent = z.infer<typeof SearchEventSchema>;
