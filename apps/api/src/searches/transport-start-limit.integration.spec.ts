import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SearchEventSchema, SearchSnapshotSchema, type SearchStatus } from '@torob-ticket/contracts';
import { createPrisma, SearchRepository, SessionRepository, type Prisma, type PrismaClient } from '@torob-ticket/data-access';
import { fixtureIdentity } from '@torob-ticket/fixtures';
import { requireTestDatabaseUrl } from '../../test/test-database.cjs';

const now = new Date('2026-11-01T12:00:00.000Z');
const query = { mode: 'flight', scope: 'domestic', tripType: 'one-way', originCityId: 'tehran', destinationCityId: 'mashhad', departureDate: '2026-11-01', party: { adults: 1, children: 0, infants: 0 }, classCode: 'economy', filters: {}, sort: 'cheapest' } as const;
const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));
interface Owner { sessionId: string; fixtureVersion: string; mappingRevision: string }

describe('transport rolling-start budget distinguishes internal evidence on PostgreSQL', () => {
  let db: PrismaClient;
  let searches: SearchRepository;
  const owned: string[] = [];
  beforeAll(() => {
    // Root's runner must migrate/seed its newly owned _test database first.
    // Never infer a default connection or touch the running Compose database.
    db = createPrisma(requireTestDatabaseUrl(process.env.TEST_DATABASE_URL));
    searches = new SearchRepository(db);
  });
  afterAll(async () => {
    try { await db?.demoSession.deleteMany({ where: { id: { in: owned } } }); }
    finally { await db?.$disconnect(); }
  });
  async function owner(): Promise<Owner> {
    const row = await new SessionRepository(db, fixtureIdentity).create(randomUUID(), { seed: 1616, anchorInstant: '2026-11-01T00:00:00Z', scenario: 'normal' }, now);
    owned.push(row.id);
    return { sessionId: row.id, fixtureVersion: row.fixtureVersion, mappingRevision: row.mappingRevision };
  }
  function snapshot(id: string, clientGeneration: string, status: SearchStatus, at = now) {
    return SearchSnapshotSchema.parse({ searchId: id, clientGeneration, query, status, groups: [], providerStatuses: [], coverage: { expectedProviderIds: [], successfulProviderIds: [], failedProviderIds: [], pendingProviderIds: [], complete: status !== 'collecting' }, observedAt: at.toISOString() });
  }
  function start(a: Owner, at = now, options: { supersedesSearchId?: string; id?: string } = {}) {
    const id = options.id ?? randomUUID(), clientGeneration = randomUUID();
    return searches.create({ sessionId: a.sessionId }, { query: json(query), clientGeneration, snapshot: json(snapshot(id, clientGeneration, 'collecting', at)) }, at, { enforceLimit: true, ...options, id });
  }
  async function finish(a: Owner, run: { id: string; clientGeneration: string }, status: Exclude<SearchStatus, 'collecting'>) {
    return db.searchRun.update({ where: { sessionId_id: { sessionId: a.sessionId, id: run.id } }, data: { status, snapshot: json(snapshot(run.id, run.clientGeneration, status)), updatedAt: now } });
  }
  /** Data-only admission fixtures: no providers, quotes or successful inventory
   * work are claimed. DatePriceRun membership and recheck kind are the durable
   * discriminants used by the real repositories; their rows stay inspectable. */
  async function dateParent(a: Owner, status: 'complete' | 'interrupted' | 'collecting', id: string = randomUUID()) {
    const generation = randomUUID();
    await db.$transaction([
      db.searchRun.create({ data: { sessionId: a.sessionId, id, clientGeneration: generation, query: json(query), snapshot: json(snapshot(id, generation, status)), status, fixtureVersion: a.fixtureVersion, mappingRevision: a.mappingRevision, createdAt: now, updatedAt: now } }),
      db.datePriceRun.create({ data: { sessionId: a.sessionId, id, queryKey: randomUUID(), payload: { kind: 'date-price-evidence', evidenceSearchId: id, snapshot: { status: status === 'collecting' ? 'checking' : status } }, createdAt: now } }),
    ]);
    return id;
  }
  async function recheckParent(a: Owner) {
    const id = randomUUID();
    await db.searchRun.create({ data: { sessionId: a.sessionId, id, clientGeneration: id, query: json(query), snapshot: { kind: 'referral-recheck' }, status: 'cancelled', fixtureVersion: a.fixtureVersion, mappingRevision: a.mappingRevision, createdAt: now, updatedAt: now } });
    return id;
  }

  it('excludes terminal date/recheck parents but counts five mixed-status comparisons until the strict ten-second boundary, independently per owner', async () => {
    const a = await owner(), b = await owner();
    const dateIds: string[] = [], recheckIds: string[] = [];
    for (let index = 0; index < 5; index++) dateIds.push(await dateParent(a, index % 2 ? 'interrupted' : 'complete'));
    for (let index = 0; index < 3; index++) recheckIds.push(await recheckParent(a));
    const comparisonIds: string[] = [];
    for (const status of ['complete', 'partial', 'failed', 'cancelled', 'interrupted'] as const) {
      // Current unqualified SearchRun count rejects this FIRST actual transport
      // start because the eight internal parents already consume its budget.
      const run = await start(a); comparisonIds.push(run.id); await finish(a, run, status);
    }
    expect(new Set(comparisonIds).size).toBe(5);
    expect(await db.searchRun.count({ where: { sessionId: a.sessionId, id: { in: dateIds.concat(recheckIds) } } })).toBe(8);
    expect(await db.searchRun.findMany({ where: { sessionId: a.sessionId, id: { in: comparisonIds } }, select: { status: true } })).toEqual(expect.arrayContaining(['complete', 'partial', 'failed', 'cancelled', 'interrupted'].map(status => ({ status }))));
    await expect(start(a)).rejects.toMatchObject({ code: 'SEARCH_LIMIT' });
    await expect(start(a, new Date(now.getTime() + 9999))).rejects.toMatchObject({ code: 'SEARCH_LIMIT' });
    const other = await start(b); expect(other.sessionId).toBe(b.sessionId); await finish(b, other, 'cancelled');
    const boundary = await start(a, new Date(now.getTime() + 10_000));
    expect(boundary.createdAt).toEqual(new Date(now.getTime() + 10_000));
    expect(await db.searchRun.count({ where: { sessionId: a.sessionId } })).toBe(14);
  });

  it('does not let another session date-parent ID exempt an owned comparison from its five-start budget', async () => {
    const a = await owner(), b = await owner();
    const comparisons = [];
    for (let index = 0; index < 5; index++) { const run = await start(a); comparisons.push(run); await finish(a, run, 'cancelled'); }
    const collidingId = comparisons[0]!.id;
    await dateParent(b, 'complete', collidingId);
    expect(await db.datePriceRun.findUnique({ where: { sessionId_id: { sessionId: a.sessionId, id: collidingId } } })).toBeNull();
    expect(await db.datePriceRun.count({ where: { sessionId: b.sessionId, id: collidingId } })).toBe(1);
    await expect(start(a)).rejects.toMatchObject({ code: 'SEARCH_LIMIT' });
    expect(await db.searchRun.count({ where: { sessionId: a.sessionId } })).toBe(5);
  });

  it('retains the two-active shared bound for collecting date parents and transport comparisons', async () => {
    const a = await owner();
    const first = await dateParent(a, 'collecting'), second = await dateParent(a, 'collecting');
    await expect(start(a)).rejects.toMatchObject({ code: 'SEARCH_LIMIT' });
    const parent = await db.searchRun.findUniqueOrThrow({ where: { sessionId_id: { sessionId: a.sessionId, id: first } } });
    await finish(a, parent, 'complete');
    await db.datePriceRun.update({ where: { sessionId_id: { sessionId: a.sessionId, id: first } }, data: { payload: { kind: 'date-price-evidence', evidenceSearchId: first, snapshot: { status: 'complete' } } } });
    const admitted = await start(a);
    expect(admitted.status).toBe('collecting');
    await expect(start(a)).rejects.toMatchObject({ code: 'SEARCH_LIMIT' });
    expect(await db.searchRun.findUniqueOrThrow({ where: { sessionId_id: { sessionId: a.sessionId, id: second } } })).toMatchObject({ status: 'collecting' });
    expect(await db.searchRun.count({ where: { sessionId: a.sessionId, status: 'collecting' } })).toBe(2);
    expect(await db.searchRun.count({ where: { sessionId: a.sessionId } })).toBe(3);
  });

  it('rejects an over-budget replacement before cancelling its prior collecting comparison or appending events', async () => {
    const a = await owner();
    for (const status of ['complete', 'partial', 'cancelled', 'interrupted'] as const) { const run = await start(a); await finish(a, run, status); }
    const prior = await start(a), initial = SearchSnapshotSchema.parse(prior.snapshot);
    const event = SearchEventSchema.parse({ searchId: prior.id, clientGeneration: prior.clientGeneration, sequence: 1, type: 'snapshot', payload: initial });
    await db.searchEventRecord.create({ data: { sessionId: a.sessionId, searchId: prior.id, sequence: 1, payload: json(event), createdAt: now } });
    const before = await db.searchRun.findUniqueOrThrow({ where: { sessionId_id: { sessionId: a.sessionId, id: prior.id } } });
    const eventsBefore = await db.searchEventRecord.findMany({ where: { sessionId: a.sessionId, searchId: prior.id }, orderBy: { sequence: 'asc' } });
    const refusedId = randomUUID();
    await expect(start(a, now, { id: refusedId, supersedesSearchId: prior.id })).rejects.toMatchObject({ code: 'SEARCH_LIMIT' });
    expect(await db.searchRun.findUniqueOrThrow({ where: { sessionId_id: { sessionId: a.sessionId, id: prior.id } } })).toEqual(before);
    expect(before.status).toBe('collecting');
    expect(await db.searchEventRecord.findMany({ where: { sessionId: a.sessionId, searchId: prior.id }, orderBy: { sequence: 'asc' } })).toEqual(eventsBefore);
    expect(await db.searchRun.findUnique({ where: { sessionId_id: { sessionId: a.sessionId, id: refusedId } } })).toBeNull();
    expect(await db.searchRun.count({ where: { sessionId: a.sessionId } })).toBe(5);
  });
});
