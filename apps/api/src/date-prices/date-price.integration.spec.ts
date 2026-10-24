import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SearchRepository, SessionRepository, sessionInfo } from '@torob-ticket/data-access';
import { fixtureIdentity } from '@torob-ticket/fixtures';
import type { DatePriceQuery } from '@torob-ticket/contracts';
import { requireTestDatabaseUrl } from '../../test/test-database.cjs';
import { FrozenDemoClock, SystemRealClock } from '../common/clocks';
import { SessionService } from '../sessions/session.service';
import type { SessionContext } from '../sessions/session-context';
import { ProviderService } from '../providers/provider.service';
import { DatePriceService } from './date-price.service';
const request: DatePriceQuery = { query: { mode: 'flight', scope: 'domestic', tripType: 'one-way', originCityId: 'tehran', destinationCityId: 'mashhad', departureDate: '2026-10-25', party: { adults: 1, children: 0, infants: 0 }, classCode: 'economy', filters: {}, sort: 'cheapest' }, leg: 'outbound', dates: ['2026-10-25', '2026-10-26'], clientGeneration: 'date-g1' };
describe('date prices persist auditable scoped observations', () => {
  let sessions: SessionService; let service: DatePriceService; let owner: SessionContext;
  beforeAll(async () => {
    process.env.DATABASE_URL = requireTestDatabaseUrl(process.env.TEST_DATABASE_URL);
    sessions = new SessionService(new SystemRealClock()); await sessions.ensureReady();
    const row = await new SessionRepository(sessions.database, fixtureIdentity).create(randomUUID(), { seed: 5, anchorInstant: '2026-10-24T00:00:00Z' }, new Date());
    owner = { sessionId: row.id, scope: { sessionId: row.id }, info: sessionInfo(row), demoClock: new FrozenDemoClock(row.anchorInstant.toISOString()) };
    service = new DatePriceService(sessions, new ProviderService(() => new SearchRepository(sessions.database), sessions.realClock));
  });
  afterAll(async () => { await service?.onModuleDestroy(); if (owner) await sessions.database.demoSession.deleteMany({ where: { id: owner.sessionId } }); await sessions?.onModuleDestroy(); });
  it('creates durable checking state and finishes with source-backed prices rather than eternal checking', async () => {
    const initial = await service.startDatePrices(owner, request);
    expect(await sessions.database.datePriceRun.count({ where: { sessionId: owner.sessionId, id: initial.datePriceId } })).toBe(1);
    await expect.poll(async () => (await service.getDatePrices(owner, initial.datePriceId, request)).status, { timeout: 10000, interval: 20 }).toBe('complete');
    const result = await service.getDatePrices(owner, initial.datePriceId, request);
    expect(result.cells.every(cell => cell.status === 'priced')).toBe(true);
    for (const cell of result.cells) if (cell.status === 'priced') for (const id of cell.quoteIds) expect(await sessions.database.quote.count({ where: { sessionId: owner.sessionId, id } })).toBe(1);
  });
});

import { SearchService } from '../searches/search.service';
import { mockRegistry, MockProvider, type ProviderAdapter } from '@torob-ticket/provider-adapters';
const gate = () => { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; };
describe('date cache identity, admission, and failure semantics', () => {
  let sessions: SessionService; let providers: ProviderService;
  const owners: SessionContext[] = []; const services: DatePriceService[] = [];
  let now = Date.now();
  async function owner() {
    const row = await new SessionRepository(sessions.database, fixtureIdentity).create(randomUUID(), { seed: 5, anchorInstant: '2026-10-24T00:00:00Z' }, new Date(now));
    const value = { sessionId: row.id, scope: { sessionId: row.id }, info: sessionInfo(row), demoClock: new FrozenDemoClock(row.anchorInstant.toISOString()) };
    owners.push(value); return value;
  }
  function create(registry: readonly ProviderAdapter[] = mockRegistry) { const value = new DatePriceService(sessions, providers, registry); services.push(value); return value; }
  async function complete(service: DatePriceService, c: SessionContext, q = request) {
    const initial = await service.startDatePrices(c, q);
    let result = initial;
    await expect.poll(async () => { result = await service.getDatePrices(c, initial.datePriceId, q); return result.status; }, { timeout: 10000, interval: 10 }).not.toBe('checking');
    return result;
  }
  beforeAll(async () => { process.env.DATABASE_URL = requireTestDatabaseUrl(process.env.TEST_DATABASE_URL); sessions = new SessionService({ now: () => new Date(now) }); await sessions.ensureReady(); providers = new ProviderService(() => new SearchRepository(sessions.database), sessions.realClock); });
  afterAll(async () => { for (const service of services) await service.onModuleDestroy(); await sessions.database.demoSession.deleteMany({ where: { id: { in: owners.map(c => c.sessionId) } } }); await sessions.onModuleDestroy(); });
  it('reuses canonical data with current generation metadata strictly before 60 seconds and scopes owners', async () => {
    const a = await owner(); const b = await owner(); let calls = 0;
    const registry = mockRegistry.map(adapter => ({ providerId: adapter.providerId, search: adapter.search.bind(adapter), recheck: adapter.recheck.bind(adapter), dateInventory: async (q, c) => { calls++; return adapter.dateInventory(q, { ...c, overrides: { ...c.overrides, [adapter.providerId]: { latencyMs: 0 } } }); } } satisfies ProviderAdapter));
    const service = create(registry); const first = await complete(service, a); expect(calls).toBe(4);
    const view = { ...request, clientGeneration: 'new-generation', dates: [...request.dates].reverse(), query: { ...request.query, sort: 'fastest' as const } };
    now += 59999;
    const hit = await complete(service, a, view); expect(hit.datePriceId).toBe(first.datePriceId); expect(calls).toBe(4);
    expect(hit.clientGeneration).toBe(view.clientGeneration); expect(hit.query).toEqual({ ...view, dates: [...view.dates].sort(), query: { ...view.query, sort: 'cheapest', party: { ...view.query.party, childAges: [], infantAgesMonths: [] } } });
    expect(hit.cells).toEqual(first.cells);
    await expect(service.getDatePrices(b, first.datePriceId, request)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    now += 1; const expired = await complete(service, a); expect(expired.datePriceId).not.toBe(first.datePriceId); expect(calls).toBe(8);
    const other = await complete(service, b); expect(other.datePriceId).not.toBe(expired.datePriceId);
  });
  it('invalidates mapping and actual provider overrides without changing historic evidence', async () => {
    const a = await owner(); const service = create(); const first = await complete(service, a);
    await sessions.repository.applyMapping(a.scope, a.info.mappingRevision, {}, new Date(now));
    const mapped = await complete(service, a); expect(mapped.datePriceId).not.toBe(first.datePriceId);
    await sessions.database.providerOverride.create({ data: { sessionId: a.sessionId, providerId: 'demo-provider-01', payload: { paused: true } } });
    const overridden = await complete(service, a); expect(overridden.datePriceId).not.toBe(mapped.datePriceId);
    expect(overridden.cells[0]).toMatchObject({ status: 'priced', coverage: { failedProviderIds: ['demo-provider-01'] } });
    expect((await service.getDatePrices(a, first.datePriceId, request)).cells).toEqual(first.cells);
  });
  it('failure and missing per-date responses never masquerade as no-match; all-success empty does', async () => {
    const a = await owner();
    const missing = create(mockRegistry.map(adapter => ({ providerId: adapter.providerId, search: adapter.search.bind(adapter), recheck: adapter.recheck.bind(adapter), dateInventory: async () => ({ providerId: adapter.providerId, status: 'success', dates: [] }) } satisfies ProviderAdapter)));
    const failed = await complete(missing, a);
    expect(failed.cells.every(cell => cell.status === 'unavailable')).toBe(true);
    const retried = await complete(missing, a);
    expect(retried.datePriceId).not.toBe(failed.datePriceId);
    expect((await missing.getDatePrices(a, failed.datePriceId, request)).cells).toEqual(failed.cells);
    now += 60000;
    const empty = create(mockRegistry.map(adapter => new MockProvider(adapter.providerId, () => [])));
    expect((await complete(empty, a)).cells.every(cell => cell.status === 'no-match')).toBe(true);
  });
  it('shares the two-run admission bound, deduplicates identical admissions, and rejects evidence parents at public search seams', async () => {
    const a = await owner(); const hold = gate(); const entered = gate(); let count = 0;
    const service = create(mockRegistry.map(adapter => ({ providerId: adapter.providerId, search: adapter.search.bind(adapter), recheck: adapter.recheck.bind(adapter), dateInventory: async (q, c) => { if (++count === 2) entered.resolve(); await hold.promise; return adapter.dateInventory(q, c); } } satisfies ProviderAdapter)));
    const [first, same] = await Promise.all([service.startDatePrices(a, request), service.startDatePrices(a, request)]);
    expect(same.datePriceId).toBe(first.datePriceId); await entered.promise;
    const searches = new SearchService(sessions, providers);
    try {
      await expect(searches.getSearch(a, first.datePriceId)).rejects.toMatchObject({ code: 'NOT_FOUND' });
      await expect(searches.cancelSearch(a, first.datePriceId)).rejects.toMatchObject({ code: 'NOT_FOUND' });
      await expect(searches.retrySearch(a, first.datePriceId, 'retry')).rejects.toMatchObject({ code: 'NOT_FOUND' });
      await expect(searches.startSearch(a, { query: request.query, clientGeneration: 'x', supersedesSearchId: first.datePriceId })).rejects.toMatchObject({ code: 'NOT_FOUND' });
      const second = await service.startDatePrices(a, { ...request, dates: ['2026-10-27'] });
      await expect(searches.startSearch(a, { query: request.query, clientGeneration: 'limit' })).rejects.toMatchObject({ code: 'SEARCH_LIMIT' });
      hold.resolve(); await service.cancelDatePrices(a, first.datePriceId, request); await service.cancelDatePrices(a, second.datePriceId, { ...request, dates: ['2026-10-27'] });
    } finally { hold.resolve(); await searches.onModuleDestroy(); }
  });
});

// Additional boundaries use production adapters and committed evidence, never a price stub.
describe('selected-date equivalence and frozen-context boundaries', () => {
  let sessions: SessionService; let providers: ProviderService; let dates: DatePriceService; let searches: SearchService;
  const owners: SessionContext[] = [];
  async function owner() {
    const row = await new SessionRepository(sessions.database, fixtureIdentity).create(randomUUID(), { seed: 7, anchorInstant: '2026-10-24T00:00:00Z' }, new Date());
    const value = { sessionId: row.id, scope: { sessionId: row.id }, info: sessionInfo(row), demoClock: new FrozenDemoClock(row.anchorInstant.toISOString()) }; owners.push(value);
    for (const adapter of mockRegistry) await sessions.database.providerOverride.create({ data: { sessionId: row.id, providerId: adapter.providerId, payload: { latencyMs: 0 } } });
    return value;
  }
  beforeAll(async () => { process.env.DATABASE_URL = requireTestDatabaseUrl(process.env.TEST_DATABASE_URL); sessions = new SessionService(new SystemRealClock()); await sessions.ensureReady(); providers = new ProviderService(() => new SearchRepository(sessions.database), sessions.realClock); dates = new DatePriceService(sessions, providers); searches = new SearchService(sessions, providers); });
  afterAll(async () => { await dates.onModuleDestroy(); await searches.onModuleDestroy(); await sessions.database.demoSession.deleteMany({ where: { id: { in: owners.map(c => c.sessionId) } } }); await sessions.onModuleDestroy(); });
  for (const [mode, scope, destinationCityId, classCode] of [ ['flight', 'domestic', 'mashhad', 'economy'], ['flight', 'international', 'istanbul', 'economy'], ['train', 'domestic', 'mashhad', 'seat'], ['train', 'international', 'van', 'seat'], ['bus', 'domestic', 'isfahan', 'standard'], ['bus', 'international', 'yerevan', 'standard'] ] as const) it(`${mode}/${scope} date minima equal actual selected-date results for a party and fixed return`, async () => {
    const a = await owner();
    const query = { ...request.query, mode, scope, destinationCityId, classCode, tripType: 'round-trip' as const, returnDate: '2026-10-29', party: { adults: 2, children: 1, infants: 0, childAges: [7] }, filters: { maxStopsOrTransfers: 2 } };
    const q = { ...request, query, dates: ['2026-10-25', '2026-10-26', '2026-10-30'] };
    const run = await dates.startDatePrices(a, q);
    await expect.poll(async () => (await dates.getDatePrices(a, run.datePriceId, q)).status, { timeout: 10000, interval: 10 }).toBe('complete');
    const projection = await dates.getDatePrices(a, run.datePriceId, q);
    expect(projection.cells[2]?.status).toBe('invalid-date-pair');
    for (const cell of projection.cells.slice(0, 2)) {
      const search = await searches.startSearch(a, { query: { ...query, departureDate: cell.date }, clientGeneration: 'selected' });
      await expect.poll(async () => (await searches.getSearch(a, search.snapshot.searchId)).snapshot.status, { timeout: 10000, interval: 10 }).not.toBe('collecting');
      const selected = await searches.getSearch(a, search.snapshot.searchId);
      const totals = selected.snapshot.groups.flatMap(group => group.eligibleQuotes.map(quote => quote.total.amountRial));
      expect(totals.length).toBeGreaterThan(0); expect(cell).toMatchObject({ status: 'priced', minimum: { amountRial: Math.min(...totals) } });
      if (cell.status === 'priced') for (const quoteId of cell.quoteIds) {
        const saved = await sessions.database.quote.findUniqueOrThrow({ where: { sessionId_id_version: { sessionId: a.sessionId, id: quoteId, version: 1 } }, include: { offer: true } });
        expect(saved.offer?.searchId).toBe(run.datePriceId);
      }
    }
  });
  it('freezes actual overrides between atomic admission and provider context creation', async () => {
    const a = await owner();
    class EditingProviderService extends ProviderService {
      override async createContext(...args: Parameters<ProviderService['createContext']>) {
        await sessions.database.providerOverride.update({ where: { sessionId_providerId: { sessionId: a.sessionId, providerId: 'demo-provider-01' } }, data: { payload: { paused: true } } });
        return super.createContext(...args);
      }
    }
    const service = new DatePriceService(sessions, new EditingProviderService(() => new SearchRepository(sessions.database), sessions.realClock));
    try {
      const run = await service.startDatePrices(a, request);
      await expect.poll(async () => (await service.getDatePrices(a, run.datePriceId, request)).status, { timeout: 10000, interval: 10 }).toBe('complete');
      expect((await service.getDatePrices(a, run.datePriceId, request)).cells[0]).toMatchObject({ coverage: { successfulProviderIds: expect.arrayContaining(['demo-provider-01']), failedProviderIds: [] } });
    } finally { await service.onModuleDestroy(); }
  });
  it('retains batch error reasons in scoped audit evidence', async () => {
    const a = await owner(); await sessions.database.providerOverride.updateMany({ where: { sessionId: a.sessionId }, data: { payload: { failureProfile: 'error' } } });
    const run = await dates.startDatePrices(a, request);
    await expect.poll(async () => (await dates.getDatePrices(a, run.datePriceId, request)).status, { timeout: 10000, interval: 10 }).toBe('complete');
    const saved = await dates.repository.read(a.scope, run.datePriceId);
    expect(saved).toMatchObject({ providerEvidence: { 'demo-provider-01': { status: 'failed', errorCode: 'PROVIDER_ERROR' } } });
  });
  it('cancellation and restart recovery terminalize checking snapshots and retain completed evidence', async () => {
    const a = await owner();
    const run = await dates.startDatePrices(a, request);
    await expect.poll(async () => (await dates.getDatePrices(a, run.datePriceId, request)).status, { timeout: 5000, interval: 10 }).toBe('complete');
    const before = await dates.getDatePrices(a, run.datePriceId, request);
    const abandoned = await dates.repository.admit(a.scope, { ...request, dates: ['2026-10-27'] }, new Date(), { sourceRevisions: {}, policyRevisions: {} });
    const replacement = new SessionService(new SystemRealClock());
    const recoveredDates = new DatePriceService(replacement, new ProviderService(() => new SearchRepository(replacement.database), replacement.realClock));
    try {
      await replacement.ensureReady();
      expect((await recoveredDates.getDatePrices(a, abandoned.id, 'after-restart')).status).toBe('interrupted');
      expect((await recoveredDates.getDatePrices(a, abandoned.id, 'after-restart')).cells[0]).toMatchObject({ status: 'unavailable', reason: 'interrupted' });
      expect(await recoveredDates.getDatePrices(a, before.datePriceId, request)).toEqual(before);
      const audits = await sessions.database.auditEvent.count({ where: { sessionId: a.sessionId, kind: 'date-price-interrupted' } });
      await replacement.ensureReady();
      expect(await sessions.database.auditEvent.count({ where: { sessionId: a.sessionId, kind: 'date-price-interrupted' } })).toBe(audits);
    } finally { await recoveredDates.onModuleDestroy(); await replacement.onModuleDestroy(); }
    await sessions.database.providerOverride.updateMany({ where: { sessionId: a.sessionId }, data: { payload: { latencyMs: 60000 } } });
    const active = await dates.startDatePrices(a, request);
    const cancelled = await dates.cancelDatePrices(a, active.datePriceId, request);
    expect(cancelled.status).toBe('interrupted'); expect(cancelled.cells.every(cell => cell.status === 'unavailable')).toBe(true);
    const resetRun = await dates.startDatePrices(a, { ...request, dates: ['2026-10-28'] });
    await sessions.reset(a, {}, { headers: {} }, { setHeader: () => undefined });
    await expect(dates.getDatePrices(a, resetRun.datePriceId, request)).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
  });
  it('storage outage is recoverable interruption with no replayed provider operation', async () => {
    const a = await owner(); let calls = 0;
    const service = new DatePriceService(sessions, providers, mockRegistry.map(adapter => ({ providerId: adapter.providerId, search: adapter.search.bind(adapter), recheck: adapter.recheck.bind(adapter), dateInventory: async (q, c) => { calls++; return adapter.dateInventory(q, c); } } satisfies ProviderAdapter)));
    await sessions.database.$executeRawUnsafe(`ALTER TABLE "DatePriceRun" ADD CONSTRAINT t10_terminal_outage CHECK (payload->'snapshot'->>'status' = 'checking') NOT VALID`);
    let id = '';
    try {
      const run = await service.startDatePrices(a, request); id = run.datePriceId;
      await expect.poll(async () => { try { await sessions.ensureReady(); return false; } catch { return true; } }, { timeout: 10000, interval: 20 }).toBe(true);
    } finally { await sessions.database.$executeRawUnsafe('ALTER TABLE "DatePriceRun" DROP CONSTRAINT t10_terminal_outage'); }
    const observedCalls = calls;
    const recovered = await service.getDatePrices(a, id, request);
    expect(recovered.status).toBe('interrupted'); expect(recovered.cells.some(cell => cell.status === 'checking')).toBe(false);
    expect(calls).toBe(observedCalls); expect(await sessions.database.rawRecord.count({ where: { sessionId: a.sessionId } })).toBeGreaterThan(0);
    await service.onModuleDestroy();
  });
  it('retains committed source records when a batched provider fails halfway through', async () => {
    const a = await owner(); let writes = 0;
    class FailingSink extends SearchRepository {
      override appendNormalizationEvidence(...args: Parameters<SearchRepository['appendNormalizationEvidence']>) {
        if (++writes === 2) return Promise.reject(new Error('sink-unavailable'));
        return super.appendNormalizationEvidence(...args);
      }
    }
    const service = new DatePriceService(sessions, new ProviderService(() => new FailingSink(sessions.database), sessions.realClock));
    const q = { ...request, query: { ...request.query, filters: { providerIds: ['demo-provider-01'] } } };
    try {
      const run = await service.startDatePrices(a, q);
      await expect.poll(async () => (await service.getDatePrices(a, run.datePriceId, q)).status, { timeout: 10000, interval: 10 }).toBe('complete');
      const result = await service.getDatePrices(a, run.datePriceId, q);
      expect(result.cells[0]).toMatchObject({ status: 'priced', coverage: { failedProviderIds: ['demo-provider-01'] } });
      expect(result.cells[1]).toMatchObject({ status: 'unavailable', reason: 'retrieval-failed' });
      expect(await sessions.database.rawRecord.count({ where: { sessionId: a.sessionId } })).toBe(1);
      expect(await sessions.database.quote.count({ where: { sessionId: a.sessionId } })).toBe(1);
      expect((await service.repository.read(a.scope, run.datePriceId)).providerEvidence?.['demo-provider-01']?.errorCode).toBe('TRACE_SINK_FAILED');
    } finally { await service.onModuleDestroy(); }
  });
  it('ninety local dates use one batched adapter operation per participating provider', async () => {
    const a = await owner(); const batches: string[][] = [];
    const registry = mockRegistry.map(adapter => {
      const empty = new MockProvider(adapter.providerId, () => []);
      return { providerId: adapter.providerId, search: adapter.search.bind(adapter), recheck: adapter.recheck.bind(adapter), dateInventory: async (q, c) => { batches.push(q.dates); return empty.dateInventory(q, c); } } satisfies ProviderAdapter;
    });
    const service = new DatePriceService(sessions, providers, registry);
    const days = Array.from({ length: 90 }, (_, day) => new Date(Date.UTC(2026, 9, 24 + day)).toISOString().slice(0, 10));
    const q = { ...request, dates: days };
    try {
      const run = await service.startDatePrices(a, q);
      await expect.poll(async () => (await service.getDatePrices(a, run.datePriceId, q)).status, { timeout: 10000, interval: 10 }).toBe('complete');
      expect(batches).toHaveLength(4); expect(batches.every(batch => batch.length === 90)).toBe(true);
      expect((await service.getDatePrices(a, run.datePriceId, q)).cells.every(cell => cell.status === 'no-match')).toBe(true);
    } finally { await service.onModuleDestroy(); }
  });
});
