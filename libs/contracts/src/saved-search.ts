import { z } from 'zod';
import { IdSchema, ISOInstantSchema } from './common';
import { TransportSearchQuerySchema } from './search';

export const DemoIdentitySchema = z.strictObject({ identityId: IdSchema, displayName: IdSchema, simulated: z.literal(true) });
export type DemoIdentity = z.infer<typeof DemoIdentitySchema>;
export const SaveSearchInputSchema = z.strictObject({ name: IdSchema, query: TransportSearchQuerySchema });
export type SaveSearchInput = z.infer<typeof SaveSearchInputSchema>;
export const SavedSearchSchema = z.strictObject({ savedSearchId: IdSchema, identityId: IdSchema, name: IdSchema, query: TransportSearchQuerySchema, createdAt: ISOInstantSchema });
export type SavedSearch = z.infer<typeof SavedSearchSchema>;
