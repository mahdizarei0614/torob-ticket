import { z } from 'zod';
import { MappingPatchSchema, MappingPreviewSchema, NormalizationTraceSchema, RawProviderRecordSchema } from './admin';
import { IdSchema, ISOInstantSchema, NonnegativeIntegerSchema } from './common';
import { NormalizedOfferSchema } from './offer';
import { TransportSearchQuerySchema } from './search';

export const MappingListQuerySchema = z.strictObject({ offset: z.coerce.number().int().min(0).default(0), limit: z.coerce.number().int().min(1).max(100).default(25), outcome: z.enum(['accepted', 'rejected', 'ambiguous']).optional(), revisionOffset: z.coerce.number().int().min(0).optional(), revisionLimit: z.coerce.number().int().min(1).max(50).optional() });
export type MappingListQuery = z.infer<typeof MappingListQuerySchema>;
export const MappingRecordSchema = z.strictObject({ searchId: IdSchema, query: TransportSearchQuerySchema, raw: RawProviderRecordSchema, trace: NormalizationTraceSchema, normalizedOffer: NormalizedOfferSchema.nullable(), groupId: IdSchema.nullable() });
export const MappingWorkspaceSchema = z.strictObject({ mappingRevision: IdSchema, supportedEntityTypes: z.array(z.literal('city')), namespaces: z.array(IdSchema), targets: z.array(z.strictObject({ entityType: MappingPatchSchema.shape.entityType, id: IdSchema, name: z.string() })), records: z.array(MappingRecordSchema), revisions: z.array(z.strictObject({ revision: IdSchema, parentRevision: IdSchema.nullable(), patch: MappingPatchSchema.nullable(), createdAt: ISOInstantSchema })), totalRecords: NonnegativeIntegerSchema, offset: NonnegativeIntegerSchema, limit: NonnegativeIntegerSchema, hasMore: z.boolean(), revisionsTotal: NonnegativeIntegerSchema, revisionsOffset: NonnegativeIntegerSchema, revisionsLimit: NonnegativeIntegerSchema, revisionsHasMore: z.boolean() });
export type MappingWorkspace = z.infer<typeof MappingWorkspaceSchema>;
const ImpactStateSchema = z.strictObject({ outcome: NormalizationTraceSchema.shape.outcome, decisions: NormalizationTraceSchema.shape.decisions, issues: NormalizationTraceSchema.shape.issues, normalizedOffer: NormalizedOfferSchema.nullable(), groupId: IdSchema.nullable() });
export const MappingImpactPreviewSchema = MappingPreviewSchema.extend({ previewId: IdSchema, observedAt: ISOInstantSchema, expiresAt: ISOInstantSchema, impacts: z.array(z.strictObject({ rawRecordId: IdSchema, searchId: IdSchema, before: ImpactStateSchema, after: ImpactStateSchema })), groupingChanges: z.array(z.strictObject({ searchId: IdSchema, beforeGroupIds: z.array(IdSchema), afterGroupIds: z.array(IdSchema) })) });
export type MappingImpactPreview = z.infer<typeof MappingImpactPreviewSchema>;
export const ApplyMappingInputSchema = z.strictObject({ previewId: IdSchema, patch: MappingPatchSchema });
export type ApplyMappingInput = z.infer<typeof ApplyMappingInputSchema>;
export const MappingAppliedSchema = z.strictObject({ revision: IdSchema, parentRevision: IdSchema, appliedAt: ISOInstantSchema, affectedRawRecordIds: z.array(IdSchema), affectedSearchIds: z.array(IdSchema) });
export type MappingApplied = z.infer<typeof MappingAppliedSchema>;
