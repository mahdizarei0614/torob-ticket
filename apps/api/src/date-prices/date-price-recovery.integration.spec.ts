import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DatePriceSnapshotSchema, SearchSnapshotSchema } from '@torob-ticket/contracts';
import { createPrisma, DatePriceRepository, SessionRepository, type Prisma, type PrismaClient } from '@torob-ticket/data-access';
import { fixtureIdentity } from '@torob-ticket/fixtures';
import { requireTestDatabaseUrl } from '../../test/test-database.cjs';

const now = new Date('2026-11-01T12:00:00.000Z'), interruptedAt = new Date(now.getTime() + 1000);
const query = { mode: 'flight', scope: 'domestic', tripType: 'one-way', originCityId: 'tehran', destinationCityId: 'mashhad', departureDate: '2026-11-01', party: { adults: 1, children: 0, infants: 0 }, classCode: 'economy', filters: {}, sort: 'cheapest' } as const;
const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));
interface Owner { sessionId: string; fixtureVersion: string; mappingRevision: string }
interface ReturnedRow { id: string; sessionId: string; keys: string[] }

describe('date recovery reads only durable checking candidates on PostgreSQL', () => {
  let db: PrismaClient;
  const owned: string[] = [];
  beforeAll(() => { db = createPrisma(requireTestDatabaseUrl(process.env.TEST_DATABASE_URL)); });
  afterAll(async () => {
    try { await db?.demoSession.deleteMany({ where: { id: { in: owned } } }); }
    finally { await db?.$disconnect(); }
  });
  async function owner(): Promise<Owner> {
    const row = await new SessionRepository(db, fixtureIdentity).create(randomUUID(), { seed: 1616, anchorInstant: '2026-11-01T00:00:00Z', scenario: 'normal' }, now);
    owned.push(row.id); return { sessionId: row.id, fixtureVersion: row.fixtureVersion, mappingRevision: row.mappingRevision };
  }
  function payload(id: string) {
    const snapshot = DatePriceSnapshotSchema.parse({ datePriceId: id, clientGeneration: id, query: { query, leg: 'outbound', dates: [query.departureDate], clientGeneration: id }, cells: [{ date: query.departureDate, status: 'checking' }], status: 'checking', pollCursor: '0', observedAt: now.toISOString() });
    // These are persistence-boundary fixtures, not a provider-service run. They
    // contain the actual snapshot/sequence/coverage fields interruption consumes;
    // no invented prices, provider success, frozen source or quote evidence.
    return { kind: 'date-price-evidence', evidenceSearchId: id, snapshot, sequence: 0, coverageByDate: {} };
  }
  async function record(a: Owner, parentStatus: 'collecting' | 'complete' | 'interrupted', value: (id: string) => unknown = payload) {
    const id = randomUUID();
    const snapshot = SearchSnapshotSchema.parse({ searchId: id, clientGeneration: id, query, status: parentStatus, groups: [], providerStatuses: [], coverage: { expectedProviderIds: [], successfulProviderIds: [], failedProviderIds: [], pendingProviderIds: [], complete: parentStatus !== 'collecting' }, observedAt: (parentStatus === 'interrupted' ? interruptedAt : now).toISOString() });
    const stored = value(id);
    await db.$transaction([
      db.searchRun.create({ data: { sessionId: a.sessionId, id, query: json(query), clientGeneration: id, status: parentStatus, snapshot: json(snapshot), fixtureVersion: a.fixtureVersion, mappingRevision: a.mappingRevision, createdAt: now, updatedAt: parentStatus === 'interrupted' ? interruptedAt : now } }),
      db.datePriceRun.create({ data: { sessionId: a.sessionId, id, queryKey: randomUUID(), payload: json(stored), createdAt: now } }),
    ]);
    return { id, stored };
  }
  const date = (a: Owner, id: string) => db.datePriceRun.findUniqueOrThrow({ where: { sessionId_id: { sessionId: a.sessionId, id } } });
  const interruptedAudit = (a: Owner, id: string) => db.auditEvent.findMany({ where: { sessionId: a.sessionId, kind: 'date-price-interrupted', payload: { path: ['datePriceId'], equals: id } } });

  it('returns only checking evidence identities, preserves live/history rows, and recovers an interrupted parent exactly once', async () => {
    const a = await owner(), b = await owner(), scopeIds = new Set([a.sessionId, b.sessionId]);
    const complete = await record(a, 'complete', id => ({ ...payload(id), snapshot: { ...payload(id).snapshot, status: 'complete' } }));
    const interrupted = await record(b, 'interrupted', id => ({ ...payload(id), snapshot: { ...payload(id).snapshot, status: 'interrupted' } }));
    const unknownChecking = await record(a, 'interrupted', id => ({ ...payload(id), kind: 'unrecognized-date-history' }));
    const unknownWithoutSnapshot = await record(b, 'complete', () => ({ kind: 'unrecognized-history' }));
    const live = await record(a, 'collecting'), abandoned = await record(b, 'interrupted');
    const history = [[a, complete], [b, interrupted], [a, unknownChecking], [b, unknownWithoutSnapshot]] as const;
    const historyBefore = await Promise.all(history.map(([owner, row]) => date(owner, row.id)));
    const liveBefore = await date(a, live.id);
    const reads: ReturnedRow[][] = [];
    const observed = db.$extends({ query: { datePriceRun: { async findMany({ args, query }) {
      // Execute the genuine Prisma/PostgreSQL query, then observe the rows it
      // actually delivered. This is not an assertion on a mirrored where/select.
      const result = await query(args);
      reads.push(result.map(row => {
        if (typeof row.id !== 'string' || typeof row.sessionId !== 'string') throw new Error('Actual recovery discovery omitted its identity');
        return { id: row.id, sessionId: row.sessionId, keys: Object.keys(row).sort() };
      }));
      return result;
    } } } }) as unknown as PrismaClient;
    const repository = new DatePriceRepository(observed);
    await repository.reconcileInterrupted();
    expect(await date(a, live.id)).toEqual(liveBefore);
    expect(await Promise.all(history.map(([owner, row]) => date(owner, row.id)))).toEqual(historyBefore);
    const recovered = await date(b, abandoned.id), value = recovered.payload as unknown as ReturnType<typeof payload>;
    expect(value.sequence).toBe(1);
    expect(value.snapshot).toEqual({ ...payload(abandoned.id).snapshot, status: 'interrupted', pollCursor: '1', observedAt: interruptedAt.toISOString(), cells: [{ date: query.departureDate, status: 'unavailable', reason: 'interrupted', retryable: true, coverage: { expectedProviderIds: [], successfulProviderIds: [], failedProviderIds: [], pendingProviderIds: [], complete: true } }] });
    expect(await interruptedAudit(b, abandoned.id)).toHaveLength(1);
    await repository.reconcileInterrupted();
    expect(await date(b, abandoned.id)).toEqual(recovered);
    expect(await interruptedAudit(b, abandoned.id)).toHaveLength(1);
    expect(await interruptedAudit(a, live.id)).toHaveLength(0);
    expect(reads).toHaveLength(2);
    const ownedRead = (index: number) => reads[index]!.filter(row => scopeIds.has(row.sessionId));
    // Old source returns all six fixture rows/full payloads here: meaningful RED.
    expect(ownedRead(0).map(row => row.id).sort()).toEqual([live.id, abandoned.id].sort());
    expect(ownedRead(1).map(row => row.id)).toEqual([live.id]);
    expect(ownedRead(0).concat(ownedRead(1)).every(row => row.keys.join(',') === 'id,sessionId')).toBe(true);
  });

  it('revalidates latest kind and terminal status after candidate discovery before interrupting under the session lock', async () => {
    const a = await owner();
    const changedKind = await record(a, 'interrupted'), changedStatus = await record(a, 'interrupted');
    const unknown = { ...payload(changedKind.id), kind: 'unrecognized-date-record' };
    const terminal = { ...payload(changedStatus.id), snapshot: { ...payload(changedStatus.id).snapshot, status: 'complete' } };
    let changed = false;
    const observed = db.$extends({ query: { datePriceRun: { async findMany({ args, query }) {
      const result = await query(args);
      if (!changed) {
        changed = true;
        // Deterministic interleaving between the real discovery read and the
        // repository's subsequent scoped transaction; no timers/provider work.
        await db.$transaction([
          db.datePriceRun.update({ where: { sessionId_id: { sessionId: a.sessionId, id: changedKind.id } }, data: { payload: json(unknown) } }),
          db.datePriceRun.update({ where: { sessionId_id: { sessionId: a.sessionId, id: changedStatus.id } }, data: { payload: json(terminal) } }),
        ]);
      }
      return result;
    } } } }) as unknown as PrismaClient;
    await new DatePriceRepository(observed).reconcileInterrupted();
    expect(changed).toBe(true);
    expect((await date(a, changedKind.id)).payload).toEqual(json(unknown));
    expect((await date(a, changedStatus.id)).payload).toEqual(json(terminal));
    expect(await interruptedAudit(a, changedKind.id)).toHaveLength(0);
    expect(await interruptedAudit(a, changedStatus.id)).toHaveLength(0);
  });
});
