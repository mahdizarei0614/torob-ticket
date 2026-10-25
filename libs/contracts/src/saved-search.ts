import { z } from 'zod';
import { IdSchema, ISOInstantSchema } from './common';
import { TransportSearchQuerySchema } from './search';

export const DemoIdentitySchema = z.strictObject({ identityId: IdSchema, displayName: IdSchema, simulated: z.literal(true) });
export type DemoIdentity = z.infer<typeof DemoIdentitySchema>;
const SavedSearchNameSchema=z.string().transform(name=>name.normalize('NFC')).pipe(IdSchema);
export const SaveSearchInputSchema = z.strictObject({ name: SavedSearchNameSchema, query: TransportSearchQuerySchema });
export type SaveSearchInput = z.infer<typeof SaveSearchInputSchema>;
export const SavedSearchSchema = z.strictObject({ savedSearchId: IdSchema, identityId: IdSchema, name: SavedSearchNameSchema, query: TransportSearchQuerySchema, createdAt: ISOInstantSchema });
export type SavedSearch = z.infer<typeof SavedSearchSchema>;

export const DemoAuthStateSchema = z.strictObject({identity:DemoIdentitySchema.nullable()});
export type DemoAuthState = z.infer<typeof DemoAuthStateSchema>;
export const SavedSearchListSchema = z.strictObject({items:z.array(SavedSearchSchema).max(20)});
export const DeleteSavedSearchResultSchema = z.strictObject({deletedSavedSearchId:IdSchema});
