import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AdminControlConfigSchema, AdminProviderHealthSchema, AdminSearchInspectionSchema, AdminSearchListSchema, DatePriceSnapshotSchema, SearchRecoverySchema, type SearchRecovery } from '@torob-ticket/contracts';
import { AppModule } from '../app.module';
import { SessionService } from '../sessions/session.service';
import { requireTestDatabaseUrl } from '../../test/test-database.cjs';

const query = { mode: 'flight', scope: 'domestic', tripType: 'one-way', originCityId: 'tehran', destinationCityId: 'mashhad', departureDate: '2026-10-25', party: { adults: 1, children: 0, infants: 0 }, classCode: 'economy', filters: {}, sort: 'cheapest' };
describe('cookie-scoped inspectable processing evidence and terminal replay', () => {
  let app: INestApplication; let base: string; let a: string; let b: string; let normal: SearchRecovery; let timeout: SearchRecovery; let dateId: string;
  const ids: string[] = [];
  const request = (path: string, cookie = a, method = 'GET', body?: unknown) => fetch(base + '/api/v1' + path, { method, headers: { cookie, ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const pause = () => new Promise(resolve => setTimeout(resolve, 10));
  async function finish(id: string) {
    const deadline = Date.now() + 7000;
    while (Date.now() < deadline) {
      const response = await request('/searches/' + id); expect(response.status).toBe(200);
      const result = SearchRecoverySchema.parse(await response.json());
      if (result.snapshot.status !== 'collecting') return result;
      await pause();
    }
    throw new Error('admin-search-terminal-deadline');
  }
  async function start(generation: string) {
    const response = await request('/searches', a, 'POST', { query, clientGeneration: generation }); expect(response.status).toBe(201);
    return finish(SearchRecoverySchema.parse(await response.json()).snapshot.searchId);
  }
  async function config() { return AdminControlConfigSchema.parse(await (await request('/admin/config')).json()); }
  async function scenario(value: string) {
    const current = await config(); const response = await request('/admin/scenario', a, 'POST', { baseRevision: current.revision, scenario: value }); expect(response.status).toBe(201);
  }
  async function inspect(id: string, section = 'events', cookie = a, offset = 0, limit = 100) {
    const response = await request(`/admin/searches/${id}?section=${section}&offset=${offset}&limit=${limit}`, cookie); expect(response.status).toBe(200);
    return AdminSearchInspectionSchema.parse(await response.json());
  }
  beforeAll(async () => {
    process.env.DATABASE_URL = requireTestDatabaseUrl(process.env.TEST_DATABASE_URL);
    app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication(); app.setGlobalPrefix('api'); await app.listen(0, '127.0.0.1'); base = await app.getUrl();
    const cookies: string[] = [];
    for (let index = 0; index < 2; index++) {
      const response = await request('/demo/session', '', 'POST', { seed: 2424, anchorInstant: '2026-10-25T06:00:00Z', scenario: 'normal' }); expect(response.status).toBe(201);
      const cookie = response.headers.get('set-cookie')!.split(';')[0]!; cookies.push(cookie);
      const session = await app.get(SessionService).authenticate({ headers: { cookie } }, { setHeader: () => undefined }); ids.push(session.sessionId);
    }
    [a, b] = cookies as [string, string];
    const dates = await request('/date-prices', a, 'POST', { query, leg: 'outbound', dates: ['2026-10-25'], clientGeneration: 'admin-date-internal' }); expect(dates.status).toBe(201);
    dateId = DatePriceSnapshotSchema.parse(await dates.json()).datePriceId;
    const dateDeadline = Date.now() + 7000;
    while (Date.now() < dateDeadline) {
      const snapshot = DatePriceSnapshotSchema.parse(await (await request(`/date-prices/${dateId}?clientGeneration=admin-date-internal`)).json());
      if (snapshot.status === 'complete') break;
      if (snapshot.status !== 'checking') throw new Error('admin-date-inventory-interrupted');
      await pause();
    }
    expect(DatePriceSnapshotSchema.parse(await (await request(`/date-prices/${dateId}?clientGeneration=admin-date-internal`)).json()).status).toBe('complete');
    normal = await start('admin-normal'); await scenario('provider-timeout'); timeout = await start('admin-timeout'); await scenario('normal');
  });
  afterAll(async () => { if (app) { await app.get(SessionService).database.demoSession.deleteMany({ where: { id: { in: ids } } }); await app.close(); } });
  it('keeps a zero-activity reviewer truly empty and requires a session cookie', async () => {
    const health = AdminProviderHealthSchema.parse(await (await request('/admin/providers', b)).json());
    expect(health.providers).toHaveLength(6); expect(health.providers.every(provider => provider.totalRuns === 0 && provider.recent.length === 0 && provider.statusCounts.length === 0)).toBe(true);
    expect(AdminSearchListSchema.parse(await (await request('/admin/searches', b)).json())).toMatchObject({ total: 0, items: [] });
    expect((await request('/admin/providers', '')).status).toBe(401);
  });
  it('uses bounded stable pagination and validated status/mode filters without internal runs', async () => {
    const first = AdminSearchListSchema.parse(await (await request('/admin/searches?limit=1')).json());
    const second = AdminSearchListSchema.parse(await (await request('/admin/searches?limit=1&offset=1')).json());
    expect(first.total).toBe(2); expect(second.total).toBe(2); expect(first.items).toHaveLength(1); expect(second.items).toHaveLength(1);
    expect(new Set([first.items[0]!.searchId, second.items[0]!.searchId])).toEqual(new Set([normal.snapshot.searchId, timeout.snapshot.searchId]));
    expect((await request(`/admin/searches/${dateId}`)).status).toBe(404);
    expect((await request(`/admin/searches/${dateId}/replay`, a, 'POST', { clientGeneration: 'not-a-comparison' })).status).toBe(404);
    const partial = AdminSearchListSchema.parse(await (await request('/admin/searches?status=partial&mode=flight')).json());
    expect(partial.items.map(row => row.searchId)).toContain(timeout.snapshot.searchId); expect(partial.items.every(row => row.status === 'partial')).toBe(true);
    for (const suffix of ['limit=101', 'limit=0', 'offset=-1', 'offset=1e2', 'unknown=x', 'limit=1&limit=2']) expect((await request('/admin/searches?' + suffix)).status).toBe(400);
  });
  it('traces original quote and ranked group to normalized offers, raw source records and exact stored evaluations', async () => {
    const id = normal.snapshot.searchId;
    const raw = await inspect(id, 'raw'); const traces = await inspect(id, 'normalizations'); const offers = await inspect(id, 'offers'); const quotes = await inspect(id, 'quotes'); const projections = await inspect(id, 'projections');
    if (raw.evidence.section !== 'raw' || traces.evidence.section !== 'normalizations' || offers.evidence.section !== 'offers' || quotes.evidence.section !== 'quotes' || projections.evidence.section !== 'projections') throw new Error('wrong-section');
    const group = normal.snapshot.groups.find(group => group.eligibleQuotes.length)!; const quote = group.eligibleQuotes[0]!;
    const stored = quotes.evidence.items.find(row => row.quote.quoteId === quote.quoteId && row.quote.version === quote.version)!; expect(stored.quote).toEqual(quote);
    const offer = offers.evidence.items.find(row => row.offerId === stored.offerId)!; expect(offer.offer.provenance.length).toBeGreaterThan(0);
    const trace = traces.evidence.items.find(row => row.offerId === offer.offerId)!; expect(trace.outcome).toBe('accepted');
    const source = raw.evidence.items.find(row => row.record.rawRecordId === trace.rawRecordId)!; expect(source.record.providerId).toBe(quote.providerId); expect(source.sourceRawRecordId).toBeTruthy();
    expect(offer.offer.provenance.some(row => row.rawRecordId === source.record.rawRecordId)).toBe(true);
    const last = projections.evidence.items.at(-1)!; const payload = last.payload as { evaluations: { offerId: string }[]; current: { groups: unknown[] }; explanations: unknown[] };
    expect(payload.evaluations.some(row => row.offerId === offer.offerId)).toBe(true); expect(payload.current.groups).toEqual(normal.snapshot.groups); expect(payload.explanations).toEqual(normal.snapshot.explanations);
    expect(raw.context).toMatchObject({ kind: 'search-context', payload: { searchId: id, context: { operationId: expect.any(String), mappingRevision: normal.snapshot.groups[0]!.eligibleQuotes[0]!.mappingRevision, scenarioRevision: expect.any(String) } } });
    const small = await inspect(id, 'raw', a, 1, 1); expect(small.evidence.items).toHaveLength(1); expect(small.evidence.total).toBe(raw.evidence.total);
  });
  it('uses recorded provider statuses/timing and never renders timeout as empty success', async () => {
    const health = AdminProviderHealthSchema.parse(await (await request('/admin/providers')).json());
    const evidence = await inspect(timeout.snapshot.searchId); if (evidence.evidence.section !== 'events') throw new Error('wrong-section');
    expect(health.providers.every(row => row.recent.every(sample => sample.searchId !== dateId))).toBe(true);
    expect(health.providers.filter(row => row.totalRuns > 0).every(row => row.totalRuns === 2)).toBe(true);
    const timedOut = timeout.snapshot.providerStatuses.find(row => row.status === 'timeout')!; expect(timedOut).toBeTruthy();
    const sample = health.providers.find(row => row.providerId === timedOut.providerId)!.recent.find(row => row.searchId === timeout.snapshot.searchId)!;
    expect(sample.status).toEqual(timedOut); expect(sample.status.elapsedMs).toBeGreaterThan(0); expect(sample.recordedAt).not.toBeNull();
    const recorded = evidence.evidence.items.find(row => row.recordedAt === sample.recordedAt && (row.event.type === 'provider-status' ? row.event.payload.providerId === timedOut.providerId && row.event.payload.status === 'timeout' : row.event.payload.providerStatuses.some(status => status.providerId === timedOut.providerId && status.status === 'timeout')));
    expect(recorded).toBeTruthy(); expect(health.providers.find(row => row.providerId === timedOut.providerId)!.statusCounts).toContainEqual({ status: 'timeout', count: 1 });
  });
  it('rejects foreign IDs, unsupported sections and extra replay fields before exposing any evidence', async () => {
    const id = normal.snapshot.searchId;
    for (const section of ['raw', 'normalizations', 'offers', 'quotes', 'events', 'projections']) expect((await request(`/admin/searches/${id}?section=${section}`, b)).status).toBe(404);
    expect((await request(`/admin/searches/${id}/replay`, b, 'POST', { clientGeneration: 'foreign' })).status).toBe(404);
    expect((await request(`/admin/searches/${id}?section=private`)).status).toBe(400);
    const invalid = await request(`/admin/searches/${id}/replay`, a, 'POST', { clientGeneration: 'new', sessionId: 'foreign' }); expect(invalid.status).toBe(400); expect(await invalid.json()).toMatchObject({ code: 'INVALID_QUERY', requestId: expect.any(String) });
  });
  it('replays only a terminal run into a linked new run using current controls, leaving all original evidence unchanged', async () => {
    const original = await inspect(normal.snapshot.searchId, 'projections');
    const current = await config(); expect((await request('/admin/providers/demo-provider-01', a, 'PATCH', { baseRevision: current.revision, patch: { paused: true } })).status).toBe(200);
    const response = await request(`/admin/searches/${normal.snapshot.searchId}/replay`, a, 'POST', { clientGeneration: 'admin-replay-current' }); expect(response.status).toBe(201);
    const started = SearchRecoverySchema.parse(await response.json()); expect(started.snapshot.searchId).not.toBe(normal.snapshot.searchId); expect(started.snapshot.predecessorSearchId).toBe(normal.snapshot.searchId);
    if (started.snapshot.status === 'collecting') expect((await request(`/admin/searches/${started.snapshot.searchId}/replay`, a, 'POST', { clientGeneration: 'too-early' })).status).toBe(409);
    const fresh = await finish(started.snapshot.searchId); expect(fresh.snapshot.providerStatuses.find(row => row.providerId === 'demo-provider-01')!.status).toBe('paused');
    expect(await inspect(normal.snapshot.searchId, 'projections')).toEqual(original);
    const replay = await inspect(fresh.snapshot.searchId); expect(replay.summary.predecessorSearchId).toBe(normal.snapshot.searchId);
    expect(replay.context).toMatchObject({ payload: { context: { overrides: { 'demo-provider-01': { paused: true } } } } });
  });
  it('removes only reset owner evidence and leaves the other reviewer empty', async () => {
    const response = await request('/admin/reset', a, 'POST', {}); expect(response.status).toBe(201);
    const cookie = response.headers.get('set-cookie')?.split(';')[0]; if (cookie) a = cookie;
    expect((await request(`/admin/searches/${normal.snapshot.searchId}`)).status).toBe(404);
    expect(AdminSearchListSchema.parse(await (await request('/admin/searches')).json()).total).toBe(0);
    expect(AdminSearchListSchema.parse(await (await request('/admin/searches', b)).json()).total).toBe(0);
    const session = await app.get(SessionService).authenticate({ headers: { cookie: a } }, { setHeader: () => undefined }); ids.push(session.sessionId);
  });
});
