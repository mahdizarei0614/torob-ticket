import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrisma, SearchRepository, SessionRepository, type PrismaClient } from '@torob-ticket/data-access';
import { fixtureIdentity } from '@torob-ticket/fixtures';
import { requireTestDatabaseUrl } from '../../test/test-database.cjs';

describe('search admission and lifecycle on PostgreSQL', () => {
  let db: PrismaClient;
  let sessionId: string;
  beforeAll(async () => {
    db = createPrisma(requireTestDatabaseUrl(process.env.TEST_DATABASE_URL));
    const session = await new SessionRepository(db, fixtureIdentity).create(randomUUID(), {}, new Date());
    sessionId = session.id;
  });
  afterAll(async () => { await db?.demoSession.deleteMany({ where: { id: sessionId } }); await db?.$disconnect(); });
  it('limits rolling starts even after cancellation, isolates sessions, and recovers after the window', async () => {
    const repository = new SearchRepository(db);
    const owner = await new SessionRepository(db, fixtureIdentity).create(randomUUID(), {}, new Date());
    const scope = { sessionId: owner.id };
    const now = new Date();
    const input = { query: {}, snapshot: {}, clientGeneration: 'burst' };
    try {
      for (let index = 0; index < 5; index++) {
        const run = await repository.create(scope, input, now, { enforceLimit: true });
        // Preserve durable history while simulating already-finished work.
        await db.searchRun.update({ where: { sessionId_id: { sessionId: owner.id, id: run.id } }, data: { status: 'cancelled' } });
      }
      await expect(repository.create(scope, input, now, { enforceLimit: true })).rejects.toMatchObject({ code: 'SEARCH_LIMIT' });
      const other = await repository.create({ sessionId }, input, now, { enforceLimit: true });
      await db.searchRun.update({ where: { sessionId_id: { sessionId, id: other.id } }, data: { status: 'cancelled' } });
      await expect(repository.create(scope, input, new Date(now.getTime() + 10_000), { enforceLimit: true })).resolves.toBeDefined();
    } finally { await db.demoSession.delete({ where: { id: owner.id } }); }
  });
  it('admits only two concurrent runs under a simultaneous admission race', async () => {
    const repository = new SearchRepository(db);
    const results = await Promise.allSettled(Array.from({ length: 3 }, () => repository.create(
      { sessionId }, { query: {}, snapshot: {}, clientGeneration: randomUUID() }, new Date(), { enforceLimit: true },
    )));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(2);
    expect(results.find(result => result.status === 'rejected')).toMatchObject({ reason: { code: 'SEARCH_LIMIT' } });
  });
});

import { SearchEventSchema, SearchRecoverySchema, type TransportSearchQuery } from '@torob-ticket/contracts';
import { MockProvider, mockRegistry, type ProviderAdapter } from '@torob-ticket/provider-adapters';
import { sessionInfo } from '@torob-ticket/data-access';
import { FrozenDemoClock, SystemRealClock } from '../common/clocks';
import { SessionService } from '../sessions/session.service';
import type { SessionContext } from '../sessions/session-context';
import { ProviderService } from '../providers/provider.service';
import { SearchService } from './search.service';
import { restartOwnedTestDatabase } from '../../test/restart-owned-database';
const query: TransportSearchQuery = { mode: 'flight', scope: 'domestic', tripType: 'one-way', originCityId: 'tehran', destinationCityId: 'mashhad', departureDate: '2026-10-25', party: { adults: 1, children: 0, infants: 0 }, classCode: 'economy', filters: {}, sort: 'cheapest' };
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; };
describe('durable progressive searches', () => {
  let sessions: SessionService;
  let providers: ProviderService;
  let service: SearchService;
  const contexts: SessionContext[] = [];
  async function context(scenario: 'normal' | 'slow-provider' | 'provider-timeout' = 'normal') {
    const row = await new SessionRepository(sessions.database, fixtureIdentity).create(randomUUID(), { seed: 5, anchorInstant: '2026-10-24T00:00:00Z', scenario }, new Date());
    const value: SessionContext = { sessionId: row.id, scope: { sessionId: row.id }, info: sessionInfo(row), demoClock: new FrozenDemoClock(row.anchorInstant.toISOString()) };
    contexts.push(value); return value;
  }
  async function terminal(c: SessionContext, id: string) {
    let result = await service.getSearch(c, id);
    await expect.poll(async () => { result = await service.getSearch(c, id); return result.snapshot.status; }, { timeout: 10000, interval: 20 }).not.toBe('collecting');
    return result;
  }
  beforeAll(async () => {
    process.env.DATABASE_URL = requireTestDatabaseUrl(process.env.TEST_DATABASE_URL);
    sessions = new SessionService(new SystemRealClock()); await sessions.ensureReady();
    providers = new ProviderService(() => new SearchRepository(sessions.database), sessions.realClock);
    service = new SearchService(sessions, providers);
  });
  afterAll(async () => { await service?.onModuleDestroy(); await sessions.database.demoSession.deleteMany({ where: { id: { in: contexts.map(c => c.sessionId) } } }); await sessions?.onModuleDestroy(); });
  it('normal real adapters produce ordered replay, complete audits and immutable quote observations across every update', async () => {
    const a = await context(); const b = await context();
    const started = await service.startSearch(a, { query, clientGeneration: 'normal' });
    const result = await terminal(a, started.snapshot.searchId);
    expect(SearchRecoverySchema.safeParse(result).success).toBe(true);
    expect(result.snapshot.status).toBe('complete');
    expect(result.snapshot.coverage.successfulProviderIds).toHaveLength(4);
    expect(result.snapshot.groups.length).toBeGreaterThan(0);
    expect(result.snapshot.explanations!.length).toBeGreaterThan(0);
    await expect(service.getSearch(b, started.snapshot.searchId)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(service.cancelSearch(b, started.snapshot.searchId)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(service.retrySearch(b, started.snapshot.searchId, 'intruder')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const events = (await service.repository.read(a.scope, result.snapshot.searchId)).events;
    expect(events.map(e => e.sequence)).toEqual(events.map((_, index) => index + 1));
    expect(events.every(e => SearchEventSchema.safeParse(e).success)).toBe(true);
    expect(events.at(-1)).toMatchObject({ type: 'terminal', payload: result.snapshot, sequence: result.sequence });
    const replay = await service.repository.read(a.scope, result.snapshot.searchId, 3);
    expect(replay.events).toEqual(events.slice(3));
    const seen = new Map<string, unknown>();
    for (const event of events) if (event.type !== 'provider-status') for (const group of event.payload.groups) for (const quote of group.eligibleQuotes) {
      if (seen.has(quote.quoteId)) expect(quote).toEqual(seen.get(quote.quoteId)); else seen.set(quote.quoteId, quote);
      expect(Date.parse(quote.expiresAt) - Date.parse(quote.observedAt)).toBe(600000);
    }
    expect(seen.size).toBeGreaterThan(0);
    const db = sessions.database;
    expect(await db.quote.count({ where: { sessionId: a.sessionId } })).toBe(seen.size);
    expect(await db.rawRecord.count({ where: { sessionId: a.sessionId } })).toBe(await db.normalizationDecision.count({ where: { sessionId: a.sessionId } }));
    expect(await db.auditEvent.count({ where: { sessionId: a.sessionId, kind: 'search-context' } })).toBe(1);
    const projection = await db.auditEvent.findFirstOrThrow({ where: { sessionId: a.sessionId, kind: 'search-projection' }, orderBy: { createdAt: 'desc' } });
    expect(projection.payload).toHaveProperty('evaluations');
    expect(projection.payload).toHaveProperty('quoteReferences');
  });
  it('freezes scenario and overrides once, bounds concurrent providers and serializes simultaneous completions', async () => {
    const a = await context(); const gate = deferred(); const entered = deferred();
    let running = 0; let maximum = 0; let startedCount = 0;
    const observed: unknown[] = [];
    const registry = mockRegistry.map(adapter => ({ ...adapter, providerId: adapter.providerId, dateInventory: adapter.dateInventory.bind(adapter), recheck: adapter.recheck.bind(adapter), search: async (q, c) => {
      running++; maximum = Math.max(maximum, running); startedCount++; if (startedCount === 2) entered.resolve();
      await gate.promise; observed.push(c.overrides); const result = await adapter.search(q, { ...c, overrides: { ...c.overrides, [adapter.providerId]: { latencyMs: 0 } } }); running--; return result;
    } } satisfies ProviderAdapter));
    const controlled = new SearchService(sessions, providers, registry);
    const run = await controlled.startSearch(a, { query, clientGeneration: 'race' }); await entered.promise;
    await sessions.database.providerOverride.create({ data: { sessionId: a.sessionId, providerId: 'demo-provider-04', payload: { paused: true } } });
    gate.resolve();
    await expect.poll(async () => (await controlled.getSearch(a, run.snapshot.searchId)).snapshot.status, { interval: 20, timeout: 5000 }).toBe('complete');
    expect(maximum).toBe(2); expect(startedCount).toBe(4); expect(observed.every(value => JSON.stringify(value) === '{}')).toBe(true);
    const events = (await controlled.repository.read(a.scope, run.snapshot.searchId)).events;
    expect(new Set(events.map(event => event.sequence)).size).toBe(events.length);
    expect(events.filter(event => event.type === 'terminal')).toHaveLength(1);
    await controlled.onModuleDestroy();
  });
  it('distinguishes successful zero inventory from all failures and paused providers', async () => {
    const a = await context();
    const emptyRegistry = mockRegistry.map(adapter => new MockProvider(adapter.providerId, () => []));
    const emptyService = new SearchService(sessions, providers, emptyRegistry);
    const empty = await emptyService.startSearch(a, { query, clientGeneration: 'empty' });
    await expect.poll(async () => (await emptyService.getSearch(a, empty.snapshot.searchId)).snapshot.status, { timeout: 5000 }).toBe('empty');
    await emptyService.onModuleDestroy();
    for (const id of [1, 2, 3, 4]) await sessions.database.providerOverride.upsert({ where: { sessionId_providerId: { sessionId: a.sessionId, providerId: `demo-provider-0${id}` } }, create: { sessionId: a.sessionId, providerId: `demo-provider-0${id}`, payload: { paused: true } }, update: { payload: { paused: true } } });
    const failed = await service.startSearch(a, { query, clientGeneration: 'failed' });
    const result = await terminal(a, failed.snapshot.searchId);
    expect(result.snapshot.status).toBe('failed'); expect(result.snapshot.coverage.failedProviderIds).toHaveLength(4); expect(result.snapshot.providerStatuses.every(p => p.status === 'paused')).toBe(true);
  });
  it('slow and timeout scenarios retain progressive useful results with truthful terminal coverage', async () => {
    for (const scenario of ['slow-provider', 'provider-timeout'] as const) {
      const a = await context(scenario);
      const run = await service.startSearch(a, { query, clientGeneration: scenario });
      const result = await terminal(a, run.snapshot.searchId);
      const events = (await service.repository.read(a.scope, run.snapshot.searchId)).events;
      expect(events.some(event => event.type === 'snapshot' && event.payload.groups.length > 0 && event.payload.coverage.pendingProviderIds.length > 0)).toBe(true);
      expect(result.snapshot.status).toBe(scenario === 'provider-timeout' ? 'partial' : 'complete');
      expect(result.snapshot.coverage.complete).toBe(true);
      if (scenario === 'provider-timeout') expect(result.snapshot.providerStatuses.some(row => row.status === 'timeout')).toBe(true);
    }
  });
  it('trace sink failure retains committed raw evidence and reports failed provider coverage with actual offer count', async () => {
    const a = await context();
    let entered = 0;
    class FailingSink extends SearchRepository {
      override appendNormalizationEvidence(scope: Parameters<SearchRepository['appendNormalizationEvidence']>[0], input: Parameters<SearchRepository['appendNormalizationEvidence']>[1]) {
        if (++entered === 2) return Promise.reject(new Error('sink-unavailable'));
        return super.appendNormalizationEvidence(scope, input);
      }
    }
    const repository = new FailingSink(sessions.database);
    const controlled = new SearchService(sessions, new ProviderService(() => repository, sessions.realClock));
    const run = await controlled.startSearch(a, { query: { ...query, filters: { providerIds: ['demo-provider-01'] } }, clientGeneration: 'sink-failure' });
    await expect.poll(async () => (await controlled.getSearch(a, run.snapshot.searchId)).snapshot.status, { timeout: 5000 }).toBe('partial');
    const result = await controlled.getSearch(a, run.snapshot.searchId);
    expect(result.snapshot.providerStatuses).toEqual([expect.objectContaining({ status: 'failed', offerCount: 1, reason: 'TRACE_SINK_FAILED' })]);
    const replay = await controlled.repository.read(a.scope, run.snapshot.searchId);
    const failedEvent = replay.events.find(event => event.type === 'provider-status' && event.payload.status === 'failed');
    expect(failedEvent).toBeDefined();
    const matchingProjection = replay.events.find(event => event.sequence === failedEvent!.sequence + 1);
    expect(matchingProjection?.type).toBe('snapshot');
    if (matchingProjection?.type !== 'snapshot') throw new Error('Expected atomic status projection');
    const derivedStatus = matchingProjection.payload.providerStatuses.find(row => row.providerId === 'demo-provider-01');
    const savedProvider = await sessions.database.providerRun.findUniqueOrThrow({ where: { sessionId_searchId_providerId: { sessionId: a.sessionId, searchId: run.snapshot.searchId, providerId: 'demo-provider-01' } } });
    expect(failedEvent!.payload).toEqual(derivedStatus);
    expect(failedEvent!.payload).toEqual(result.snapshot.providerStatuses[0]);
    expect(failedEvent!.payload).toEqual(savedProvider.payload);
    expect(replay.events.map(event => event.sequence)).toEqual(replay.events.map((_, index) => index + 1));

    expect(await sessions.database.rawRecord.count({ where: { sessionId: a.sessionId } })).toBe(1);
    expect(await sessions.database.normalizationDecision.count({ where: { sessionId: a.sessionId } })).toBe(1);
    expect(await sessions.database.quote.count({ where: { sessionId: a.sessionId } })).toBe(1);
    await controlled.onModuleDestroy();
  });
  it('whole-run deadline stops queued/active work and persists all timeout coverage', async () => {
    const a = await context();
    for (const id of [1, 2, 3, 4]) await sessions.database.providerOverride.create({ data: { sessionId: a.sessionId, providerId: `demo-provider-0${id}`, payload: { latencyMs: 60000 } } });
    const startedAt = Date.now();
    const run = await service.startSearch(a, { query, clientGeneration: 'deadline' });
    const result = await terminal(a, run.snapshot.searchId);
    expect(Date.now() - startedAt).toBeLessThan(6500);
    expect(result.snapshot.status).toBe('failed');
    expect(result.snapshot.providerStatuses.every(row => row.status === 'timeout')).toBe(true);
    expect(result.snapshot.coverage.pendingProviderIds).toEqual([]);
    expect(await sessions.database.rawRecord.count({ where: { sessionId: a.sessionId } })).toBe(0);
  });
  it('cancellation preserves already committed normalization evidence and freezes terminal projection', async () => {
    const a = await context('slow-provider');
    const run = await service.startSearch(a, { query, clientGeneration: 'cancel-with-evidence' });
    await expect.poll(async () => (await service.getSearch(a, run.snapshot.searchId)).snapshot.groups.length, { timeout: 5000, interval: 20 }).toBeGreaterThan(0);
    const result = await service.cancelSearch(a, run.snapshot.searchId);
    const records = await sessions.database.rawRecord.count({ where: { sessionId: a.sessionId } });
    expect(records).toBeGreaterThan(0); expect(result.snapshot.groups.length).toBeGreaterThan(0);
    await service.onModuleDestroy(); service = new SearchService(sessions, providers);
    expect(await service.getSearch(a, run.snapshot.searchId)).toEqual(result);
    expect(await sessions.database.rawRecord.count({ where: { sessionId: a.sessionId } })).toBe(records);
    expect((await service.repository.read(a.scope, run.snapshot.searchId)).events.filter(event => event.type === 'terminal')).toHaveLength(1);
  });
  it('explicit supersession and cancellation preserve another tab and reset fences all stale work', async () => {
    const a = await context('slow-provider');
    const one = await service.startSearch(a, { query, clientGeneration: 'tab-one' });
    const two = await service.startSearch(a, { query, clientGeneration: 'tab-two' });
    await expect(service.startSearch(a, { query, clientGeneration: 'limit' })).rejects.toMatchObject({ code: 'SEARCH_LIMIT' });
    const three = await service.startSearch(a, { query, clientGeneration: 'replacement', supersedesSearchId: one.snapshot.searchId });
    expect((await service.getSearch(a, one.snapshot.searchId)).snapshot.status).toBe('cancelled');
    expect((await service.getSearch(a, two.snapshot.searchId)).snapshot.status).toBe('collecting');
    const cancelled = await service.cancelSearch(a, three.snapshot.searchId);
    expect(cancelled.snapshot.status).toBe('cancelled');
    const retry = await service.retrySearch(a, three.snapshot.searchId, 'retry');
    expect(retry.snapshot.predecessorSearchId).toBe(three.snapshot.searchId); expect(retry.snapshot.searchId).not.toBe(three.snapshot.searchId);
    const response = { setHeader: () => undefined };
    await sessions.reset(a, {}, { headers: {} }, response);
    await expect(service.getSearch(a, two.snapshot.searchId)).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
    await service.onModuleDestroy();
    service = new SearchService(sessions, providers);
    expect(await sessions.database.searchRun.count({ where: { sessionId: a.sessionId } })).toBe(0);
  });
  it('recovers a failed terminal transaction as interrupted after storage returns without resuming providers', async () => {
    const a = await context();
    await sessions.database.$executeRawUnsafe(`ALTER TABLE "SearchEventRecord" ADD CONSTRAINT t09_terminal_outage CHECK (payload->>'type' <> 'terminal') NOT VALID`);
    let id = '';
    try {
      const run = await service.startSearch(a, { query, clientGeneration: 'storage-failure' }); id = run.snapshot.searchId;
      await expect.poll(async () => (await service.getSearch(a, id)).snapshot.providerStatuses.every(row => row.status === 'complete'), { timeout: 5000, interval: 20 }).toBe(true);
      // A readiness recovery failure proves the stopped job has entered the
      // interruption queue; no process restart or lifecycle hook is involved.
      await expect.poll(async () => { try { await sessions.ensureReady(); return false; } catch { return true; } }, { timeout: 5000, interval: 20 }).toBe(true);
      expect((await sessions.database.searchRun.findUniqueOrThrow({ where: { sessionId_id: { sessionId: a.sessionId, id } } })).status).toBe('collecting');
    } finally { await sessions.database.$executeRawUnsafe('ALTER TABLE "SearchEventRecord" DROP CONSTRAINT t09_terminal_outage'); }
    const recovered = await service.getSearch(a, id);
    expect(recovered.snapshot.status).toBe('interrupted');
    expect((await service.repository.read(a.scope, id)).events.filter(event => event.type === 'terminal')).toHaveLength(1);
    expect(await sessions.database.rawRecord.count({ where: { sessionId: a.sessionId } })).toBeGreaterThan(0);
  });
  it('graceful API shutdown interrupts active work instead of claiming explicit user cancellation', async () => {
    const a = await context('slow-provider');
    const run = await service.startSearch(a, { query, clientGeneration: 'shutdown' });
    await service.onModuleDestroy();
    service = new SearchService(sessions, providers);
    expect((await service.getSearch(a, run.snapshot.searchId)).snapshot.status).toBe('interrupted');
  });
  it('actual owned PostgreSQL restart retains completed evidence and API recovery interrupts unfinished work exactly once', async () => {
    const a = await context();
    const completed = await service.startSearch(a, { query, clientGeneration: 'retained' });
    const prior = await terminal(a, completed.snapshot.searchId);
    const id = randomUUID();
    const unfinished = { ...prior.snapshot, searchId: id, clientGeneration: 'crashed', status: 'collecting', groups: [], providerStatuses: prior.snapshot.providerStatuses.map(row => ({ ...row, status: 'running' })), coverage: { ...prior.snapshot.coverage, complete: false, successfulProviderIds: [], pendingProviderIds: prior.snapshot.coverage.expectedProviderIds } };
    await service.repository.create(a.scope, { query, clientGeneration: 'crashed', snapshot: JSON.parse(JSON.stringify(unfinished)) }, new Date(), { id });
    restartOwnedTestDatabase();
    await expect.poll(async () => { try { await sessions.database.$queryRaw`SELECT 1`; return true; } catch { return false; } }, { timeout: 10000, interval: 100 }).toBe(true);
    const replacement = new SessionService(new SystemRealClock()); await replacement.ensureReady();
    expect(await service.getSearch(a, completed.snapshot.searchId)).toEqual(prior);
    const interrupted = await service.getSearch(a, id);
    expect(interrupted.snapshot.status).toBe('interrupted'); expect(interrupted.snapshot.coverage.pendingProviderIds).toEqual([]);
    await replacement.ensureReady();
    expect((await service.repository.read(a.scope, id)).events.filter(event => event.type === 'terminal')).toHaveLength(1);
    await replacement.onModuleDestroy();
  });
});
