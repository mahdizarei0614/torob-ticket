import { describe, expect, it } from 'vitest';
import { AdminProviderHealthSchema, AdminSearchInspectionQuerySchema, AdminSearchInspectionSchema, AdminSearchListQuerySchema, AdminSearchListSchema } from './admin-search';

const query = { mode: 'flight', scope: 'domestic', tripType: 'one-way', originCityId: 'tehran', destinationCityId: 'mashhad', departureDate: '2026-10-25', party: { adults: 1, children: 0, infants: 0 }, classCode: 'economy', filters: {}, sort: 'cheapest' };
const instant = '2026-10-26T00:00:00.000Z';
const snapshot = { searchId: 'run', clientGeneration: 'generation', query, status: 'complete', groups: [], providerStatuses: [], coverage: { expectedProviderIds: [], successfulProviderIds: [], failedProviderIds: [], pendingProviderIds: [], complete: true }, observedAt: instant };
const summary = { searchId: 'run', clientGeneration: 'generation', query, status: 'complete', createdAt: instant, updatedAt: instant, fixtureVersion: 'fixture', mappingRevision: 'mapping', groupCount: 0, providerStatuses: [] };
describe('admin inspection wire boundaries', () => {
  it('defaults bounded pages and rejects coercion tricks, repeats, extra fields and invalid filters', () => {
    expect(AdminSearchListQuerySchema.parse({})).toEqual({ offset: 0, limit: 25 });
    expect(AdminSearchInspectionQuerySchema.parse({})).toEqual({ offset: 0, limit: 25, section: 'events' });
    for (const value of [{ limit: '0' }, { limit: '101' }, { offset: '-1' }, { offset: '100001' }, { offset: '1e2' }, { limit: '' }, { limit: ['1', '2'] }, { unknown: 'x' }, { status: 'success' }]) expect(AdminSearchListQuerySchema.safeParse(value).success).toBe(false);
    expect(AdminSearchInspectionQuerySchema.safeParse({ section: 'secrets' }).success).toBe(false);
  });
  it('rejects a response claiming a smaller page or count than delivered rows', () => {
    expect(AdminSearchListSchema.safeParse({ offset: 0, limit: 1, total: 2, items: [summary, { ...summary, searchId: 'other' }] }).success).toBe(false);
    expect(AdminSearchListSchema.safeParse({ offset: 0, limit: 25, total: 0, items: [summary] }).success).toBe(false);
  });
  it('binds inspected snapshot, timeline and frozen context to the same run', () => {
    const good = { summary, snapshot, context: null, evidence: { section: 'events', offset: 0, limit: 25, total: 0, items: [] } };
    expect(AdminSearchInspectionSchema.safeParse(good).success).toBe(true);
    expect(AdminSearchInspectionSchema.safeParse({ ...good, summary: { ...summary, searchId: 'foreign' } }).success).toBe(false);
    expect(AdminSearchInspectionSchema.safeParse({ ...good, context: { auditId: 'context', kind: 'search-context', createdAt: instant, payload: { searchId: 'foreign' } } }).success).toBe(false);
    expect(AdminSearchInspectionSchema.safeParse({ ...good, evidence: { ...good.evidence, total: 1, items: [{ recordedAt: instant, event: { searchId: 'foreign', clientGeneration: 'generation', sequence: 1, type: 'provider-status', payload: { providerId: 'p', status: 'timeout', offerCount: 0 } } }] } }).success).toBe(false);
  });
  it('keeps empty health genuinely empty, unknown duration absent, and rejects mixed provider samples/counts', () => {
    expect(AdminProviderHealthSchema.parse({ providers: [{ providerId: 'p', totalRuns: 0, statusCounts: [], recent: [] }], recentLimit: 50 }).providers[0]!.recent).toEqual([]);
    const row = { providerId: 'p', totalRuns: 1, statusCounts: [{ status: 'timeout', count: 1 }], recent: [{ searchId: 'run', providerRunId: 'provider-run', recordedAt: instant, observedAt: null, status: { providerId: 'p', status: 'timeout', offerCount: 0 }, rawRecordCount: 0 }] };
    const parsed = AdminProviderHealthSchema.parse({ providers: [row], recentLimit: 50 });
    expect(parsed.providers[0]!.recent[0]!.status.elapsedMs).toBeUndefined();
    expect(AdminProviderHealthSchema.safeParse({ providers: [{ ...row, totalRuns: 0 }], recentLimit: 50 }).success).toBe(false);
    expect(AdminProviderHealthSchema.safeParse({ providers: [{ ...row, providerId: 'foreign' }], recentLimit: 50 }).success).toBe(false);
  });
});
