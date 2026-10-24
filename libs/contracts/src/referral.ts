import { z } from 'zod';
import { ApiErrorCodeSchema, IdSchema, ISOInstantSchema, PositiveIntegerSchema } from './common';
import { HotelQuoteSnapshotSchema } from './hotel';
import { ItinerarySchema, QuoteSnapshotSchema } from './offer';

export const ReferralSelectionSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('transport'), quoteId: IdSchema, quoteVersion: PositiveIntegerSchema }),
  z.strictObject({ kind: z.literal('hotel'), quoteId: IdSchema, quoteVersion: PositiveIntegerSchema }),
]);
export type ReferralSelection = z.infer<typeof ReferralSelectionSchema>;
/** Immutable handoff evidence includes the exact selected itinerary/stay. */
export const ReferralQuoteSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('transport'), quote: QuoteSnapshotSchema, itinerary: ItinerarySchema }),
  z.strictObject({ kind: z.literal('hotel'), quote: HotelQuoteSnapshotSchema }),
]);
export const ReferralIntentSchema = z.strictObject({ intentId: IdSchema, selection: ReferralSelectionSchema, quote: ReferralQuoteSchema, createdAt: ISOInstantSchema, expiresAt: ISOInstantSchema });
export type ReferralIntent = z.infer<typeof ReferralIntentSchema>;
export const RecheckResultSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('ready'), intent: ReferralIntentSchema }),
  z.strictObject({ status: z.literal('changed'), intent: ReferralIntentSchema, previousQuoteVersion: PositiveIntegerSchema, previousQuote: ReferralQuoteSchema, materialChanges: z.array(IdSchema).min(1) }),
  z.strictObject({ status: z.literal('unavailable'), reason: ApiErrorCodeSchema, retryable: z.boolean(), alternativeQuoteIds: z.array(IdSchema) }),
]);
export type RecheckResult = z.infer<typeof RecheckResultSchema>;
export const ConfirmReferralInputSchema = z.strictObject({ intentId: IdSchema, acceptedQuoteVersion: PositiveIntegerSchema, idempotencyKey: IdSchema });
export type ConfirmReferralInput = z.infer<typeof ConfirmReferralInputSchema>;
export const ReferralReceiptSchema = z.strictObject({ referralId: IdSchema, intentId: IdSchema, selection: ReferralSelectionSchema, payload: ReferralQuoteSchema, confirmedAt: ISOInstantSchema, handoffPath: z.string().regex(/^\/provider-demo\/[A-Za-z0-9_-]+$/) });
export type ReferralReceipt = z.infer<typeof ReferralReceiptSchema>;
