import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SearchEventSchema, SearchRecoverySchema, type SearchEvent } from '@torob-ticket/contracts';
import { AppModule } from '../app.module';
import { SessionService } from '../sessions/session.service';
import { requireTestDatabaseUrl } from '../../test/test-database.cjs';
const query = { mode: 'flight', scope: 'domestic', tripType: 'one-way', originCityId: 'tehran', destinationCityId: 'mashhad', departureDate: '2026-10-25', party: { adults: 1, children: 0, infants: 0 }, classCode: 'economy', filters: {}, sort: 'cheapest' };
function parseFrames(text: string) { return text.split('\n\n').filter(frame => frame.includes('data:')).map(frame => { const event = SearchEventSchema.parse(JSON.parse(frame.split('\n').find(line => line.startsWith('data:'))!.slice(5))); expect(frame.split('\n').find(line => line.startsWith('id:'))?.slice(3).trim()).toBe(String(event.sequence)); return event; }); }
describe('cookie-authorized durable SSE HTTP', () => {
  let app: INestApplication; let base: string; let a: string; let b: string; const ids: string[] = [];
  const get = (path: string, cookie = a, headers: Record<string, string> = {}, signal?: AbortSignal) => fetch(`${base}/api/v1/searches${path}`, { headers: { cookie, ...headers }, signal });
  const post = (path: string, body: unknown, cookie = a) => fetch(`${base}/api/v1/searches${path}`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  beforeAll(async () => {
    process.env.DATABASE_URL = requireTestDatabaseUrl(process.env.TEST_DATABASE_URL);
    app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication(); app.setGlobalPrefix('api'); await app.listen(0, '127.0.0.1'); base = await app.getUrl();
    const cookies: string[] = [];
    for (let index = 0; index < 2; index++) {
      const response = await fetch(`${base}/api/v1/demo/session`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ seed: 5, anchorInstant: '2026-10-24T00:00:00Z' }) });
      const cookie = response.headers.get('set-cookie')!.split(';')[0]!; cookies.push(cookie);
      const context = await app.get(SessionService).authenticate({ headers: { cookie } }, { setHeader: () => undefined }); ids.push(context.sessionId);
    }
    [a, b] = cookies as [string, string];
  });
  afterAll(async () => { if (app) { await app.get(SessionService).database.demoSession.deleteMany({ where: { id: { in: ids } } }); await app.close(); } });
  it('replays after N while collection finishes and closes with exactly one final projection', async () => {
    const created = await post('', { query, clientGeneration: 'http' }); expect(created.status).toBe(201);
    const start = SearchRecoverySchema.parse(await created.json()); const id = start.snapshot.searchId;
    expect((await get(`/${id}/events`, b)).status).toBe(404);
    expect((await get(`/${id}` , b)).status).toBe(404);
    expect((await get(`/${id}/events`, a, { 'Last-Event-ID': 'bogus' })).status).toBe(400);
    const response = await get(`/${id}/events`, a, { 'Last-Event-ID': String(start.sequence) });
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const events = parseFrames(await response.text());
    expect(events[0]?.sequence).toBe(start.sequence + 1);
    expect(events.map(e => e.sequence)).toEqual(events.map((_, index) => index + start.sequence + 1));
    expect(events.filter(e => e.type === 'terminal')).toHaveLength(1);
    const final = SearchRecoverySchema.parse(await (await get(`/${id}`)).json());
    expect(events.at(-1)).toMatchObject({ sequence: final.sequence, payload: final.snapshot, type: 'terminal' });
    expect(await (await get(`/${id}/events`, a, { 'Last-Event-ID': String(final.sequence) })).text()).toBe('');
    const replay = parseFrames(await (await get(`/${id}/events`, a, { 'Last-Event-ID': String(final.sequence - 1) })).text());
    expect(replay).toEqual([events.at(-1)]);
  });
  it('disconnect releases the stream but the bounded run completes and can be replayed', async () => {
    const start = SearchRecoverySchema.parse(await (await post('', { query, clientGeneration: 'disconnect' })).json());
    const controller = new AbortController();
    const response = await get(`/${start.snapshot.searchId}/events`, a, {}, controller.signal);
    const reader = response.body!.getReader(); const first = await reader.read(); expect(first.done).toBe(false); controller.abort(); await reader.cancel().catch(() => undefined);
    let final = start;
    await expect.poll(async () => { final = SearchRecoverySchema.parse(await (await get(`/${start.snapshot.searchId}`)).json()); return final.snapshot.status; }, { interval: 50, timeout: 5000 }).toBe('complete');
    const replay: SearchEvent[] = parseFrames(await (await get(`/${start.snapshot.searchId}/events`)).text());
    expect(replay.at(-1)?.type).toBe('terminal'); expect(replay.at(-1)?.sequence).toBe(final.sequence);
  });
  it('returns a retryable 429 under simultaneous admissions and rejects foreign supersession atomically', async () => {
    const results = await Promise.all([1, 2, 3].map(index => post('', { query, clientGeneration: `limit-${index}` })));
    expect(results.map(result => result.status).sort()).toEqual([201, 201, 429]);
    const refused = results.find(result => result.status === 429)!;
    expect(await refused.json()).toMatchObject({ code: 'SEARCH_LIMIT', retryable: true, fieldPaths: [], requestId: expect.any(String) });
    for (const result of results.filter(row => row.status === 201)) {
      const run = SearchRecoverySchema.parse(await result.json());
      const foreign = await post('', { query, clientGeneration: 'intruder', supersedesSearchId: run.snapshot.searchId }, b);
      expect(foreign.status).toBe(404);
      expect((await post(`/${run.snapshot.searchId}/cancel`, {})).status).toBe(201);
    }
  });
});
