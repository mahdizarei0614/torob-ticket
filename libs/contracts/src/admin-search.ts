import { z } from 'zod';
import { IdSchema, ISOInstantSchema, ModeSchema, NonnegativeIntegerSchema } from './common';
import { NormalizationTraceSchema, RawProviderRecordSchema } from './admin';
import { NormalizedOfferSchema, QuoteSnapshotSchema } from './offer';
import { ProviderStatusSchema, SearchEventSchema, SearchSnapshotSchema, SearchStatusSchema, TransportSearchQuerySchema } from './search';

const OffsetSchema = z.number().int().min(0).max(100000);
const LimitSchema = z.number().int().min(1).max(100);
const WireOffsetSchema = z.string().regex(/^(0|[1-9]\d*)$/).transform(Number).pipe(OffsetSchema).optional().default(0);
const WireLimitSchema = z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(LimitSchema).optional().default(25);
export const AdminSearchListQuerySchema = z.strictObject({ offset: WireOffsetSchema, limit: WireLimitSchema, status: SearchStatusSchema.optional(), mode: ModeSchema.optional(), providerId: IdSchema.optional() });
export type AdminSearchListQuery = z.infer<typeof AdminSearchListQuerySchema>;
export const AdminSearchSectionSchema = z.enum(['events', 'raw', 'normalizations', 'offers', 'quotes', 'projections']);
export const AdminSearchInspectionQuerySchema = z.strictObject({ offset: WireOffsetSchema, limit: WireLimitSchema, section: AdminSearchSectionSchema.optional().default('events') });
export type AdminSearchInspectionQuery = z.infer<typeof AdminSearchInspectionQuerySchema>;
const pageIsConsistent = (page: { offset: number; limit: number; total: number; items: unknown[] }) => page.items.length <= page.limit && page.items.length <= Math.max(0, page.total - page.offset);
const PageFields = { offset: OffsetSchema, limit: LimitSchema, total: NonnegativeIntegerSchema };
export const AdminSearchSummarySchema = z.strictObject({ searchId: IdSchema, clientGeneration: IdSchema, query: TransportSearchQuerySchema, status: SearchStatusSchema, createdAt: ISOInstantSchema, updatedAt: ISOInstantSchema, fixtureVersion: IdSchema, mappingRevision: IdSchema, predecessorSearchId: IdSchema.optional(), groupCount: NonnegativeIntegerSchema, providerStatuses: z.array(ProviderStatusSchema) });
export const AdminSearchListSchema = z.strictObject({ ...PageFields, items: z.array(AdminSearchSummarySchema).max(100) }).refine(pageIsConsistent, 'inconsistent-page-count');
export type AdminSearchList = z.infer<typeof AdminSearchListSchema>;
const AuditSchema = z.strictObject({ auditId: IdSchema, kind: IdSchema, createdAt: ISOInstantSchema, payload: z.unknown() });
export const AdminSearchEvidenceSchema = z.discriminatedUnion('section', [
  z.strictObject({ ...PageFields, section: z.literal('events'), items: z.array(z.strictObject({ recordedAt: ISOInstantSchema, event: SearchEventSchema })).max(100) }),
  z.strictObject({ ...PageFields, section: z.literal('raw'), items: z.array(z.strictObject({ providerRunId: IdSchema, sourceRawRecordId: IdSchema, record: RawProviderRecordSchema })).max(100) }),
  z.strictObject({ ...PageFields, section: z.literal('normalizations'), items: z.array(NormalizationTraceSchema).max(100) }),
  z.strictObject({ ...PageFields, section: z.literal('offers'), items: z.array(z.strictObject({ offerId: IdSchema, recordedAt: ISOInstantSchema, offer: NormalizedOfferSchema, source: z.unknown().optional() })).max(100) }),
  z.strictObject({ ...PageFields, section: z.literal('quotes'), items: z.array(z.strictObject({ offerId: IdSchema, quote: QuoteSnapshotSchema })).max(100) }),
  z.strictObject({ ...PageFields, section: z.literal('projections'), items: z.array(AuditSchema).max(100) }),
]);
export const AdminSearchInspectionSchema = z.strictObject({ summary: AdminSearchSummarySchema, snapshot: SearchSnapshotSchema, context: AuditSchema.nullable(), evidence: AdminSearchEvidenceSchema }).refine(value => {
  if (value.summary.searchId !== value.snapshot.searchId || value.summary.clientGeneration !== value.snapshot.clientGeneration || value.summary.status !== value.snapshot.status || value.summary.groupCount !== value.snapshot.groups.length || JSON.stringify(value.summary.query) !== JSON.stringify(value.snapshot.query) || JSON.stringify(value.summary.providerStatuses) !== JSON.stringify(value.snapshot.providerStatuses) || !pageIsConsistent(value.evidence)) return false;
  const belongs = (payload: unknown) => !!payload && typeof payload === 'object' && 'searchId' in payload && payload.searchId === value.summary.searchId;
  if (value.context && (value.context.kind !== 'search-context' || !belongs(value.context.payload))) return false;
  if (value.evidence.section === 'events') return value.evidence.items.every(row => row.event.searchId === value.summary.searchId && row.event.clientGeneration === value.summary.clientGeneration);
  if (value.evidence.section === 'offers') return value.evidence.items.every(row => row.offerId === row.offer.offerId);
  if (value.evidence.section === 'projections') return value.evidence.items.every(row => ['search-projection', 'search-terminated'].includes(row.kind) && belongs(row.payload));
  return true;
}, 'inspection-lineage-or-page-mismatch');
export type AdminSearchInspection = z.infer<typeof AdminSearchInspectionSchema>;
export const AdminReplayInputSchema = z.strictObject({ clientGeneration: IdSchema });
export type AdminReplayInput = z.infer<typeof AdminReplayInputSchema>;
export const AdminProviderObservationSchema = z.strictObject({ searchId: IdSchema, providerRunId: IdSchema, recordedAt: ISOInstantSchema.nullable(), observedAt: ISOInstantSchema.nullable(), status: ProviderStatusSchema, rawRecordCount: NonnegativeIntegerSchema });
export const AdminProviderHealthSchema = z.strictObject({ providers: z.array(z.strictObject({ providerId: IdSchema, totalRuns: NonnegativeIntegerSchema, statusCounts: z.array(z.strictObject({ status: ProviderStatusSchema.shape.status, count: NonnegativeIntegerSchema })), recent: z.array(AdminProviderObservationSchema).max(50) })).max(6), recentLimit: z.literal(50) }).refine(value => new Set(value.providers.map(row => row.providerId)).size === value.providers.length && value.providers.every(row => row.statusCounts.reduce((sum, status) => sum + status.count, 0) === row.totalRuns && row.recent.length <= row.totalRuns && new Set(row.statusCounts.map(status => status.status)).size === row.statusCounts.length && row.recent.every(sample => sample.status.providerId === row.providerId)), 'provider-health-count-or-lineage-mismatch');
export type AdminProviderHealth = z.infer<typeof AdminProviderHealthSchema>;
