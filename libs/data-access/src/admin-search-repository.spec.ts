import { describe, expect, it, vi } from 'vitest';
import { AdminSearchRepository } from './admin-search-repository';
import type { PrismaClient } from './generated/client';

const scope = { sessionId: 'owner' };
const now = new Date('2026-10-26T00:00:00.000Z');
const query = { mode: 'flight', scope: 'domestic', tripType: 'one-way', originCityId: 'tehran', destinationCityId: 'mashhad', departureDate: '2026-10-25', party: { adults: 1, children: 0, infants: 0 }, classCode: 'economy', filters: {}, sort: 'cheapest' };
const snapshot = { searchId: 'run', clientGeneration: 'generation', query, status: 'complete', groups: [], providerStatuses: [], coverage: { expectedProviderIds: [], successfulProviderIds: [], failedProviderIds: [], pendingProviderIds: [], complete: true }, observedAt: now.toISOString() };
const run = { id: 'run', clientGeneration: 'generation', query, status: 'complete', snapshot, createdAt: now, updatedAt: now, fixtureVersion: 'fixture', mappingRevision: 'mapping', predecessorId: null };
function fixture() {
  const table = () => ({ count: vi.fn<(input: Record<string, unknown>) => Promise<number>>().mockResolvedValue(0), findFirst: vi.fn<(input: Record<string, unknown>) => Promise<unknown>>().mockResolvedValue(null), findMany: vi.fn<(input: Record<string, unknown>) => Promise<unknown[]>>().mockResolvedValue([]), groupBy: vi.fn<(input: Record<string, unknown>) => Promise<unknown[]>>().mockResolvedValue([]) });
  const tx = { $queryRaw: vi.fn<(input: unknown, ...values: unknown[]) => Promise<unknown[]>>().mockImplementation(async statement => Array.isArray(statement) ? [{ id: scope.sessionId }] : (statement as { sql: string }).sql.startsWith('SELECT count(*)') ? [{ count: 0 }] : []), searchRun: table(), auditEvent: table(), rawRecord: table(), normalizationDecision: table(), offerSnapshot: table(), quote: table(), searchEventRecord: table(), providerRun: table(), datePriceRun: { findUnique: vi.fn<(input: unknown) => Promise<unknown>>().mockResolvedValue(null) } };
  const transaction = vi.fn(async (work: (value: typeof tx) => unknown) => work(tx));
  const db = { $transaction: transaction } as unknown as PrismaClient;
  return { tx, transaction, repository: new AdminSearchRepository(db) };
}
describe('scoped paginated admin evidence reads', () => {
  it('counts and reads only public comparisons in one reset-safe scope with deterministic pagination', async () => {
    const { tx, transaction, repository } = fixture();
    tx.$queryRaw.mockResolvedValueOnce([{ id: 'owner' }]).mockResolvedValueOnce([{ count: 4 }]).mockResolvedValueOnce([{ id: 'run' }]); tx.searchRun.findMany.mockResolvedValue([run]);
    const result = await repository.list(scope, { offset: 1, limit: 1, mode: 'flight', status: 'complete', providerId: 'p' });
    expect(result).toMatchObject({ offset: 1, limit: 1, total: 4, items: [{ searchId: 'run', groupCount: 0 }] });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw.mock.calls[0]![1]).toBe('owner');
    const countQuery = tx.$queryRaw.mock.calls[1]![0] as { sql: string; values: unknown[] };
    expect(countQuery.sql).toContain('NOT EXISTS (SELECT 1 FROM "DatePriceRun"');
    expect(countQuery.sql).toContain('EXISTS (SELECT 1 FROM "ProviderRun"');
    expect(countQuery.values).toEqual(['owner', 'complete', 'flight', 'p']);
    const pageQuery = tx.$queryRaw.mock.calls[2]![0] as { sql: string; values: unknown[] };
    expect(pageQuery.values).toEqual(['owner', 'complete', 'flight', 'p', 1, 1]);
    expect(tx.searchRun.findMany).toHaveBeenCalledWith({ where: { sessionId: 'owner', id: { in: ['run'] } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1 });
  });
  it('rejects reset/foreign runs before reading any raw, audit or event evidence', async () => {
    const { tx, repository } = fixture();
    await expect(repository.inspect(scope, 'foreign', { offset: 0, limit: 25, section: 'raw' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(tx.searchRun.findFirst).toHaveBeenCalledWith({ where: { sessionId: 'owner', id: 'foreign', snapshot: { path: ['searchId'], string_starts_with: '' } } });
    expect(tx.rawRecord.findMany).not.toHaveBeenCalled(); expect(tx.auditEvent.findFirst).not.toHaveBeenCalled();
    tx.$queryRaw.mockResolvedValue([]);
    await expect(repository.list(scope, { offset: 0, limit: 25 })).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
    expect(tx.searchRun.findMany).not.toHaveBeenCalled();
  });
  it('does not interpret private internal evidence as a public comparison', async () => {
    const { tx, repository } = fixture(); tx.searchRun.findFirst.mockResolvedValue({ ...run, snapshot: { kind: 'referral-recheck' } });
    await expect(repository.inspect(scope, 'private', { offset: 0, limit: 25, section: 'events' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(tx.searchEventRecord.findMany).not.toHaveBeenCalled();
  });
  it('rejects date-price parents even though their internal snapshot has the public transport shape', async () => {
    const { tx, repository } = fixture(); tx.searchRun.findFirst.mockResolvedValue(run); tx.datePriceRun.findUnique.mockResolvedValue({ id: 'run' });
    await expect(repository.inspect(scope, 'run', { offset: 0, limit: 25, section: 'raw' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(tx.rawRecord.findMany).not.toHaveBeenCalled();
  });
  it('preserves exact raw HTML-like data and source IDs with search-scoped joins', async () => {
    const { tx, repository } = fixture(); tx.searchRun.findFirst.mockResolvedValue(run);
    const raw = { rawRecordId: 'raw', providerId: 'p', sourceNamespace: 'p/v1', observedAt: now.toISOString(), fixtureVersion: 'fixture', payload: '<img src=x onerror=steal()>' };
    tx.rawRecord.count.mockResolvedValue(1); tx.rawRecord.findMany.mockResolvedValue([{ id: 'raw', providerRunId: 'provider-run', observedAt: now, payload: { sourceRawRecordId: 'source-record', raw } }]);
    const result = await repository.inspect(scope, 'run', { offset: 0, limit: 1, section: 'raw' });
    expect(result.evidence).toEqual({ offset: 0, limit: 1, section: 'raw', total: 1, items: [{ providerRunId: 'provider-run', sourceRawRecordId: 'source-record', record: raw }] });
    expect(tx.rawRecord.count).toHaveBeenCalledWith({ where: { sessionId: 'owner', providerRun: { sessionId: 'owner', searchId: 'run' } } });
    expect(tx.rawRecord.findMany.mock.calls[0]![0]).toMatchObject({ skip: 0, take: 1 });
  });
  it('returns exact stored ranking/exclusion audit and timestamps instead of recomputing decisions', async () => {
    const { tx, repository } = fixture(); tx.searchRun.findFirst.mockResolvedValue(run);
    const payload = { searchId: 'run', evaluations: [{ offerId: 'excluded', evaluation: { status: 'ineligible', reasons: ['UNKNOWN_MANDATORY_TOTAL'] } }], explanations: [{ reason: 'actual-original-rank' }] };
    tx.auditEvent.count.mockResolvedValue(1); tx.auditEvent.findMany.mockResolvedValue([{ id: 'projection', kind: 'search-projection', createdAt: now, payload }]);
    const result = await repository.inspect(scope, 'run', { offset: 0, limit: 1, section: 'projections' });
    expect(result.evidence).toMatchObject({ items: [{ auditId: 'projection', createdAt: now.toISOString(), payload }] });
    expect(tx.auditEvent.findMany.mock.calls[0]![0]).toMatchObject({ where: { sessionId: 'owner', payload: { path: ['searchId'], equals: 'run' } }, take: 1 });
  });
  it('has no invented activity or latency observations in a new session', async () => {
    const { tx, repository } = fixture();
    const result = await repository.providerHealth(scope, ['p', 'other']);
    expect(result).toEqual({ providers: [{ providerId: 'p', totalRuns: 0, statusCounts: [], recent: [] }, { providerId: 'other', totalRuns: 0, statusCounts: [], recent: [] }], recentLimit: 50 });
    expect(tx.searchEventRecord.findMany).not.toHaveBeenCalled();
  });
  it('reports actual failed state, duration and retained raw counts; missing timestamps remain unknown', async () => {
    const { tx, repository } = fixture();
    const timeout = { providerId: 'p', status: 'timeout', offerCount: 1, elapsedMs: 3501, reason: 'DEADLINE' };
    const pending = { providerId: 'p', status: 'pending', offerCount: 0 };
    tx.$queryRaw.mockResolvedValueOnce([{ id: 'owner' }]).mockResolvedValueOnce([{ status: 'timeout', count: 1 }, { status: 'pending', count: 1 }]).mockResolvedValueOnce([{ id: 'provider-run' }, { id: 'pending-run' }]);
    tx.providerRun.findMany.mockResolvedValue([{ id: 'provider-run', searchId: 'run', payload: timeout, _count: { records: 2 }, records: [{ observedAt: now }] }, { id: 'pending-run', searchId: 'new', payload: pending, _count: { records: 0 }, records: [] }]);
    tx.searchEventRecord.findMany.mockResolvedValue([{ searchId: 'run', createdAt: now, payload: { searchId: 'run', clientGeneration: 'generation', sequence: 3, type: 'provider-status', payload: timeout } }]);
    const result = await repository.providerHealth(scope, ['p']);
    expect(result.providers[0]).toEqual({ providerId: 'p', totalRuns: 2, statusCounts: [{ status: 'timeout', count: 1 }, { status: 'pending', count: 1 }], recent: [{ searchId: 'run', providerRunId: 'provider-run', recordedAt: now.toISOString(), observedAt: now.toISOString(), status: timeout, rawRecordCount: 2 }, { searchId: 'new', providerRunId: 'pending-run', recordedAt: null, observedAt: null, status: pending, rawRecordCount: 0 }] });
    expect(tx.providerRun.findMany.mock.calls[0]![0]).toMatchObject({ take: 50, where: { sessionId: 'owner', providerId: 'p', id: { in: ['provider-run', 'pending-run'] } } });
  });
});
