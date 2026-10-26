import { AdminProviderHealthSchema, AdminSearchInspectionSchema, AdminSearchListSchema, NormalizationTraceSchema, NormalizedOfferSchema, ProviderStatusSchema, QuoteSnapshotSchema, RawProviderRecordSchema, SearchEventSchema, SearchSnapshotSchema, type AdminSearchInspectionQuery, type AdminSearchListQuery } from '@torob-ticket/contracts';
import { Prisma, type PrismaClient } from './generated/client';
import { RepositoryError, scopedTransaction, type DataScope } from './scope';

/** Only public transport comparisons, never date inventory or private rechecks. */
const comparisons = (sessionId: string): Prisma.SearchRunWhereInput => ({ sessionId, snapshot: { path: ['searchId'], string_starts_with: '' } });
const publicRunSql = (scope: DataScope) => Prisma.sql`s."sessionId" = ${scope.sessionId} AND jsonb_typeof(s.snapshot->'searchId') = 'string' AND NOT EXISTS (SELECT 1 FROM "DatePriceRun" d WHERE d."sessionId" = s."sessionId" AND d.id = s.id)`;
type Run = { id: string; clientGeneration: string; status: string; snapshot: unknown; createdAt: Date; updatedAt: Date; fixtureVersion: string; mappingRevision: string; predecessorId: string | null };
function snapshotOf(run: Run) {
  const parsed = SearchSnapshotSchema.safeParse(run.snapshot);
  if (!parsed.success || parsed.data.searchId !== run.id || parsed.data.clientGeneration !== run.clientGeneration || parsed.data.status !== run.status) throw new RepositoryError('NOT_FOUND');
  return parsed.data;
}
function summary(run: Run) {
  const snapshot = snapshotOf(run);
  return { searchId: run.id, clientGeneration: run.clientGeneration, query: snapshot.query, status: snapshot.status, createdAt: run.createdAt.toISOString(), updatedAt: run.updatedAt.toISOString(), fixtureVersion: run.fixtureVersion, mappingRevision: run.mappingRevision, ...(run.predecessorId ? { predecessorSearchId: run.predecessorId } : {}), groupCount: snapshot.groups.length, providerStatuses: snapshot.providerStatuses };
}
const audit = (row: { id: string; kind: string; createdAt: Date; payload: unknown }) => ({ auditId: row.id, kind: row.kind, createdAt: row.createdAt.toISOString(), payload: row.payload });

/** Every page/count and its source evidence share the reset/session row lock. */
export class AdminSearchRepository {
  constructor(private readonly db: PrismaClient) {}
  list(scope: DataScope, query: AdminSearchListQuery) {
    return scopedTransaction(this.db, scope, async tx => {
      const predicate = Prisma.sql`${publicRunSql(scope)} ${query.status ? Prisma.sql`AND s.status = ${query.status}` : Prisma.empty} ${query.mode ? Prisma.sql`AND s.query->>'mode' = ${query.mode}` : Prisma.empty} ${query.providerId ? Prisma.sql`AND EXISTS (SELECT 1 FROM "ProviderRun" p WHERE p."sessionId" = s."sessionId" AND p."searchId" = s.id AND p."providerId" = ${query.providerId})` : Prisma.empty}`;
      const count = await tx.$queryRaw<{ count: number }[]>(Prisma.sql`SELECT count(*)::int AS count FROM "SearchRun" s WHERE ${predicate}`);
      const ids = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT s.id FROM "SearchRun" s WHERE ${predicate} ORDER BY s."createdAt" DESC, s.id DESC LIMIT ${query.limit} OFFSET ${query.offset}`);
      const total = count[0]!.count;
      const rows = ids.length ? await tx.searchRun.findMany({ where: { sessionId: scope.sessionId, id: { in: ids.map(row => row.id) } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: query.limit }) : [];
      return AdminSearchListSchema.parse({ offset: query.offset, limit: query.limit, total, items: rows.map(summary) });
    });
  }
  inspect(scope: DataScope, id: string, query: AdminSearchInspectionQuery) {
    return scopedTransaction(this.db, scope, async tx => {
      if (await tx.datePriceRun.findUnique({ where: { sessionId_id: { sessionId: scope.sessionId, id } } })) throw new RepositoryError('NOT_FOUND');
      const run = await tx.searchRun.findFirst({ where: { ...comparisons(scope.sessionId), id } });
      if (!run) throw new RepositoryError('NOT_FOUND');
      const snapshot = snapshotOf(run);
      const context = await tx.auditEvent.findFirst({ where: { sessionId: scope.sessionId, kind: 'search-context', payload: { path: ['searchId'], equals: id } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
      const evidence = await this.section(tx, scope, id, query);
      return AdminSearchInspectionSchema.parse({ summary: summary(run), snapshot, context: context ? audit(context) : null, evidence });
    });
  }
  private async section(tx: Prisma.TransactionClient, scope: DataScope, id: string, query: AdminSearchInspectionQuery) {
    const page = { offset: query.offset, limit: query.limit, section: query.section };
    const pagination = { skip: query.offset, take: query.limit };
    switch (query.section) {
      case 'events': {
        const where = { sessionId: scope.sessionId, searchId: id };
        const total = await tx.searchEventRecord.count({ where });
        const rows = await tx.searchEventRecord.findMany({ where, orderBy: { sequence: 'asc' }, ...pagination });
        return { ...page, total, items: rows.map(row => ({ recordedAt: row.createdAt.toISOString(), event: SearchEventSchema.parse(row.payload) })) };
      }
      case 'raw': {
        const where = { sessionId: scope.sessionId, providerRun: { sessionId: scope.sessionId, searchId: id } };
        const total = await tx.rawRecord.count({ where });
        const rows = await tx.rawRecord.findMany({ where, orderBy: [{ observedAt: 'asc' }, { id: 'asc' }], ...pagination });
        return { ...page, total, items: rows.map(row => { const payload = row.payload as { raw: unknown; sourceRawRecordId: string }; return { providerRunId: row.providerRunId, sourceRawRecordId: payload.sourceRawRecordId, record: RawProviderRecordSchema.parse(payload.raw) }; }) };
      }
      case 'normalizations': {
        const where = { sessionId: scope.sessionId, rawRecord: { sessionId: scope.sessionId, providerRun: { sessionId: scope.sessionId, searchId: id } } };
        const total = await tx.normalizationDecision.count({ where });
        const rows = await tx.normalizationDecision.findMany({ where, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], ...pagination });
        return { ...page, total, items: rows.map(row => NormalizationTraceSchema.parse(row.payload)) };
      }
      case 'offers': {
        const where = { sessionId: scope.sessionId, searchId: id };
        const total = await tx.offerSnapshot.count({ where });
        const rows = await tx.offerSnapshot.findMany({ where, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], ...pagination });
        return { ...page, total, items: rows.map(row => { const payload = row.payload as { offer: unknown; source?: unknown }; return { offerId: row.id, recordedAt: row.createdAt.toISOString(), offer: NormalizedOfferSchema.parse(payload.offer), ...(payload.source === undefined ? {} : { source: payload.source }) }; }) };
      }
      case 'quotes': {
        const where = { sessionId: scope.sessionId, offer: { sessionId: scope.sessionId, searchId: id } };
        const total = await tx.quote.count({ where });
        const rows = await tx.quote.findMany({ where, orderBy: [{ id: 'asc' }, { version: 'asc' }], ...pagination });
        return { ...page, total, items: rows.map(row => ({ offerId: row.offerId!, quote: QuoteSnapshotSchema.parse(row.payload) })) };
      }
      case 'projections': {
        const where = { sessionId: scope.sessionId, kind: { in: ['search-projection', 'search-terminated'] }, payload: { path: ['searchId'], equals: id } };
        const total = await tx.auditEvent.count({ where });
        const rows = await tx.auditEvent.findMany({ where, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], ...pagination });
        return { ...page, total, items: rows.map(audit) };
      }
    }
  }
  providerHealth(scope: DataScope, providerIds: readonly string[]) {
    return scopedTransaction(this.db, scope, async tx => {
      const providers = [];
      for (const providerId of providerIds) {
        const predicate = Prisma.sql`${publicRunSql(scope)} AND p."sessionId" = ${scope.sessionId} AND p."providerId" = ${providerId}`;
        const counts = await tx.$queryRaw<{ status: string; count: number }[]>(Prisma.sql`SELECT p.status, count(*)::int AS count FROM "ProviderRun" p JOIN "SearchRun" s ON s."sessionId" = p."sessionId" AND s.id = p."searchId" WHERE ${predicate} GROUP BY p.status ORDER BY p.status`);
        const ids = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT p.id FROM "ProviderRun" p JOIN "SearchRun" s ON s."sessionId" = p."sessionId" AND s.id = p."searchId" WHERE ${predicate} ORDER BY s."updatedAt" DESC, p.id DESC LIMIT 50`);
        const rows = ids.length ? await tx.providerRun.findMany({ where: { sessionId: scope.sessionId, providerId, id: { in: ids.map(row => row.id) } }, orderBy: [{ search: { updatedAt: 'desc' } }, { id: 'desc' }], take: 50, include: { _count: { select: { records: true } }, records: { orderBy: [{ observedAt: 'desc' }, { id: 'desc' }], take: 1, select: { observedAt: true } } } }) : [];
        const events = rows.length ? await tx.searchEventRecord.findMany({ where: { sessionId: scope.sessionId, searchId: { in: rows.map(row => row.searchId) }, OR: [{ payload: { path: ['payload', 'providerId'], equals: providerId } }, { payload: { path: ['type'], equals: 'terminal' } }] }, orderBy: [{ createdAt: 'desc' }, { sequence: 'desc' }], take: 1000 }) : [];
        const recent = rows.map(row => {
          const status = ProviderStatusSchema.parse(row.payload);
          const event = events.find(event => {
            if (event.searchId !== row.searchId) return false;
            const parsed = SearchEventSchema.safeParse(event.payload);
            if (!parsed.success) return false;
            const value = parsed.data.type === 'provider-status' ? parsed.data.payload : parsed.data.payload.providerStatuses.find(item => item.providerId === providerId);
            return !!value && JSON.stringify(value) === JSON.stringify(status);
          });
          return { searchId: row.searchId, providerRunId: row.id, recordedAt: event?.createdAt.toISOString() ?? null, observedAt: row.records[0]?.observedAt.toISOString() ?? null, status, rawRecordCount: row._count.records };
        });
        providers.push({ providerId, totalRuns: counts.reduce((sum, row) => sum + row.count, 0), statusCounts: counts, recent });
      }
      return AdminProviderHealthSchema.parse({ providers, recentLimit: 50 });
    });
  }
}
