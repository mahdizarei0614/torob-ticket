import { z } from 'zod';
import { DataIssueSchema, IdSchema, ISOInstantSchema, NonnegativeIntegerSchema } from './common';
import { DemoIdentitySchema } from './saved-search';
import { ProviderStatusSchema, SearchSnapshotSchema } from './search';

export const DemoScenarioSchema = z.enum(['normal', 'slow-provider', 'provider-timeout', 'price-change', 'sold-out', 'conflicting-data', 'no-eligible-results']);
export type DemoScenario = z.infer<typeof DemoScenarioSchema>;
/** Session anchors preserve seconds and 1–3 fractional digits exactly in Date/PostgreSQL milliseconds. */
const SessionAnchorSchema = ISOInstantSchema.refine(value => /T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value), 'session-anchor-requires-second-to-millisecond-precision');
export const CreateDemoSessionInputSchema = z.strictObject({ seed: NonnegativeIntegerSchema.optional(), anchorInstant: SessionAnchorSchema.optional(), scenario: DemoScenarioSchema.optional() });
export type CreateDemoSessionInput = z.infer<typeof CreateDemoSessionInputSchema>;
export const SessionInfoSchema = z.strictObject({ seed: NonnegativeIntegerSchema, anchorInstant: ISOInstantSchema, scenario: DemoScenarioSchema, fixtureVersion: IdSchema, catalogRevision: IdSchema, mappingRevision: IdSchema, scenarioRevision: IdSchema, expiresAt: ISOInstantSchema, identity: DemoIdentitySchema.nullable() });
export type SessionInfo = z.infer<typeof SessionInfoSchema>;
export const RawProviderRecordSchema = z.strictObject({ rawRecordId: IdSchema, providerId: IdSchema, sourceNamespace: IdSchema, observedAt: ISOInstantSchema, fixtureVersion: IdSchema, payload: z.unknown() });
export type RawProviderRecord = z.infer<typeof RawProviderRecordSchema>;
export const NormalizationTraceSchema = z.strictObject({ traceId: IdSchema, rawRecordId: IdSchema, mappingRevision: IdSchema, outcome: z.enum(['accepted', 'rejected', 'ambiguous']), offerId: IdSchema.optional(), decisions: z.array(z.strictObject({ fieldPath: z.array(z.union([z.string(), NonnegativeIntegerSchema])), ruleCode: IdSchema, sourceValue: z.unknown(), normalizedValue: z.unknown().optional() })), issues: z.array(DataIssueSchema), observedAt: ISOInstantSchema });
export type NormalizationTrace = z.infer<typeof NormalizationTraceSchema>;
export const MappingPatchSchema = z.strictObject({ entityType: z.enum(['city', 'place', 'operator', 'class']), sourceNamespace: IdSchema, sourceValue: z.string().min(1).max(1000), targetId: IdSchema, baseRevision: IdSchema });
export type MappingPatch = z.infer<typeof MappingPatchSchema>;
export const MappingPreviewSchema = z.strictObject({ patch: MappingPatchSchema, valid: z.boolean(), collisions: z.array(z.strictObject({ targetIds: z.array(IdSchema).min(1), sourceValue: z.unknown() })), affectedRawRecordIds: z.array(IdSchema), affectedSearchIds: z.array(IdSchema), issues: z.array(DataIssueSchema) });
export type MappingPreview = z.infer<typeof MappingPreviewSchema>;
export const ProviderOverridePatchSchema = z.strictObject({ paused: z.boolean().optional(), latencyMs: NonnegativeIntegerSchema.max(60000).optional(), failureProfile: z.enum(['none', 'timeout', 'error']).optional() }).refine(patch => Object.keys(patch).length > 0, 'empty-override');
export type ProviderOverridePatch = z.infer<typeof ProviderOverridePatchSchema>;
export const SetDemoScenarioInputSchema = z.strictObject({ scenario: DemoScenarioSchema });
export type SetDemoScenarioInput = z.infer<typeof SetDemoScenarioInputSchema>;
export const AdminSearchDetailSchema = z.strictObject({ snapshot: SearchSnapshotSchema, providerRuns: z.array(ProviderStatusSchema), rawRecords: z.array(RawProviderRecordSchema), normalizationTraces: z.array(NormalizationTraceSchema) });
export type AdminSearchDetail = z.infer<typeof AdminSearchDetailSchema>;
/** Counts are factual demo events, not inferred conversion/revenue. */
export const ReferralMetricsSchema = z.strictObject({ prepared: NonnegativeIntegerSchema, changed: NonnegativeIntegerSchema, unavailable: NonnegativeIntegerSchema, confirmed: NonnegativeIntegerSchema, byProvider: z.array(z.strictObject({ providerId: IdSchema, confirmed: NonnegativeIntegerSchema })) });
export type ReferralMetrics = z.infer<typeof ReferralMetricsSchema>;
