import { z } from 'zod';
import { CoverageSchema, IdSchema, ISOInstantSchema, LocalDateSchema, MoneySchema } from './common';
import { TransportSearchQuerySchema } from './search';

/** Query holds the fixed opposite leg; dates are the local dates to inspect. */
export const DatePriceQuerySchema = z.strictObject({ query: TransportSearchQuerySchema, leg: z.enum(['outbound', 'return']), dates: z.array(LocalDateSchema).min(1).max(90), clientGeneration: IdSchema }).refine(input => input.leg !== 'return' || input.query.tripType === 'round-trip', { path: ['leg'], message: 'return-prices-require-round-trip' });
export type DatePriceQuery = z.infer<typeof DatePriceQuerySchema>;
export const DatePriceCellSchema = z.discriminatedUnion('status', [
  z.strictObject({ date: LocalDateSchema, status: z.literal('priced'), minimum: MoneySchema, quoteIds: z.array(IdSchema).min(1), offerIds: z.array(IdSchema).min(1), coverage: CoverageSchema, observedAt: ISOInstantSchema }),
  z.strictObject({ date: LocalDateSchema, status: z.literal('checking') }),
  z.strictObject({ date: LocalDateSchema, status: z.literal('no-match'), coverage: CoverageSchema.refine(coverage => coverage.complete && coverage.successfulProviderIds.length > 0 && coverage.failedProviderIds.length === 0 && coverage.pendingProviderIds.length === 0 && coverage.expectedProviderIds.every(id => coverage.successfulProviderIds.includes(id)), 'adequate-successful-coverage-required') }),
  z.strictObject({ date: LocalDateSchema, status: z.literal('outside-coverage') }),
  z.strictObject({ date: LocalDateSchema, status: z.literal('unavailable'), reason: z.enum(['retrieval-failed', 'incomplete-price', 'interrupted']), retryable: z.boolean(), coverage: CoverageSchema }),
]);
export type DatePriceCell = z.infer<typeof DatePriceCellSchema>;
export const DatePriceSnapshotSchema = z.strictObject({ datePriceId: IdSchema, clientGeneration: IdSchema, query: DatePriceQuerySchema, cells: z.array(DatePriceCellSchema), status: z.enum(['checking', 'complete', 'interrupted']), pollCursor: IdSchema.optional(), observedAt: ISOInstantSchema });
export type DatePriceSnapshot = z.infer<typeof DatePriceSnapshotSchema>;
