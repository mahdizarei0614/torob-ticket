import 'reflect-metadata';
import { createHash, randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { afterAll, afterEach, beforeAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { HotelSearchSnapshotSchema, RecheckResultSchema, ReferralReceiptSchema, type HotelSearchQuery, type HotelQuoteSnapshot, type ReferralIntent } from '@torob-ticket/contracts';
import { HotelRepository, SearchRepository, type HotelRun, type Prisma } from '@torob-ticket/data-access';
import { requireTestDatabaseUrl } from '../../test/test-database.cjs';
import { AppModule } from '../app.module';
import { SystemRealClock } from '../common/clocks';
import { SessionService } from '../sessions/session.service';
const query: HotelSearchQuery = { destinationCityId: 'mashhad', checkIn: '2026-10-25', checkOut: '2026-10-27', party: { adults: 2, children: 0, infants: 0 }, rooms: 1, sort: 'cheapest' };
type Owner = {
    cookie: string;
    sessionId: string;
};
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
describe('hotel whole-stay HTTP/PostgreSQL authority', () => {
    let app: INestApplication, base: string, sessions: SessionService;
    let now = new Date('2026-10-25T07:00:00Z');
    const owned: Owner[] = [];
    async function boot() {
        const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(SystemRealClock).useValue({ now: () => new Date(now) }).compile();
        app = module.createNestApplication();
        app.setGlobalPrefix('api');
        await app.listen(0, '127.0.0.1');
        base = await app.getUrl();
        sessions = app.get(SessionService);
    }
    beforeAll(async () => {
        process.env.DATABASE_URL = requireTestDatabaseUrl(process.env.TEST_DATABASE_URL);
        await boot();
    });
    beforeEach(() => {
        now = new Date('2026-10-25T07:00:00Z');
    });
    afterEach(async () => {
        vi.restoreAllMocks();
        await sessions.database.demoSession.deleteMany({ where: { id: { in: owned.map(o => o.sessionId) } } });
        owned.length = 0;
    });
    afterAll(async () => {
        await app?.close();
    });
    async function session(scenario = 'normal', anchorInstant = '2026-10-25T06:00:00Z') {
        const response = await fetch(base + '/api/v1/demo/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seed: 2020, anchorInstant, scenario }) });
        expect(response.status).toBe(201);
        // The cookie stays in memory and is never included in assertions, traces or evidence.
        const cookie = response.headers.get('set-cookie')!.split(';')[0]!, credentialHash = createHash('sha256').update(cookie.slice(cookie.indexOf('=') + 1)).digest('hex');
        const row = await sessions.database.demoSession.findUniqueOrThrow({ where: { credentialHash } });
        const owner = { cookie, sessionId: row.id };
        owned.push(owner);
        return owner;
    }
    async function request(owner: Owner, method: string, path: string, body?: unknown) {
        const r = await fetch(base + '/api/v1/' + path, { method, headers: { Cookie: owner.cookie, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
        return { status: r.status, payload: await r.json() as unknown };
    }
    async function search(owner: Owner, input = query) {
        const r = await request(owner, 'POST', 'hotel-searches', input);
        expect(r.status).toBe(201);
        return HotelSearchSnapshotSchema.parse(r.payload);
    }
    async function prepare(owner: Owner, quote: HotelQuoteSnapshot) {
        const checked = await request(owner, 'POST', 'referrals/prepare', { kind: 'hotel', quoteId: quote.quoteId, quoteVersion: quote.version });
        expect(checked.status).toBe(201);
        return RecheckResultSchema.parse(checked.payload);
    }
    function accepted(intent: ReferralIntent, idempotencyKey = 'hotel-repeat') {
        return { intentId: intent.intentId, acceptedQuoteVersion: intent.selection.quoteVersion, idempotencyKey };
    }
    async function ready(owner: Owner) {
        const snapshot = await search(owner), checked = await prepare(owner, snapshot.quotes[0]!);
        if (checked.status === 'unavailable')
            throw Error('expected ready/changed');
        return { snapshot, checked, intent: checked.intent };
    }
    const scope = (owner: Owner) => ({ sessionId: owner.sessionId });
    const repository = () => new HotelRepository(sessions.database);
    it('guest persists fourteen properties, typed complete quotes and exact immutable GET evidence', async () => {
        const owner = await session(), snapshot = await search(owner);
        expect(snapshot.status).toBe('complete');
        expect(snapshot.hotels).toHaveLength(14);
        expect(snapshot.results).toHaveLength(14);
        expect(snapshot.quotes.length).toBeGreaterThan(0);
        expect(snapshot.quotes.every(q => q.completeness.status === 'complete' && q.eligibility.status === 'eligible' && q.roomDetails?.length === query.rooms)).toBe(true);
        const saved = await request(owner, 'GET', 'hotel-searches/' + snapshot.hotelSearchId);
        expect(saved.status).toBe(200);
        expect(saved.payload).toEqual(snapshot);
        const run = await sessions.database.hotelSearchRun.findUniqueOrThrow({ where: { sessionId_id: { sessionId: owner.sessionId, id: snapshot.hotelSearchId } } });
        const data = run.payload as unknown as HotelRun;
        expect(data.source.templates).toHaveLength(56);
        for (const hotel of snapshot.hotels) {
            const expectedIds = [1, 2, 3, 4].map(capacity => `${hotel.hotelId}-rate-${capacity}`);
            expect(data.source.templates.filter(rate => rate.hotelId === hotel.hotelId).map(rate => rate.id).sort()).toEqual(expectedIds);
            expect(data.source.rates.filter(rate => rate.hotelId === hotel.hotelId).map(rate => [rate.roomRateId, rate.maxAdults]).sort()).toEqual(expectedIds.map((id, index) => [id, index + 1]));
            expect(data.source.rates.find(rate => rate.roomRateId === `${hotel.hotelId}-rate-4`)).toMatchObject({ maxAdults: 4, maxChildren: 0, maxInfants: 0 });
        }
        expect(data.source.policies).toBeDefined();
        expect(data.source.engineRevision).toBe('hotel-engine-v1');
        expect(data.snapshot).toEqual(snapshot);
        const quotes = await sessions.database.quote.findMany({ where: { sessionId: owner.sessionId, hotelSearchId: snapshot.hotelSearchId } });
        expect(quotes.map(q => q.payload)).toEqual(expect.arrayContaining(snapshot.quotes));
        expect(quotes.every(q => q.offerId === null)).toBe(true);
        now = new Date(now.getTime() + 1000);
        const fresh = await search(owner);
        expect(fresh.hotelSearchId).not.toBe(snapshot.hotelSearchId);
        expect(fresh.observedAt).not.toBe(snapshot.observedAt);
        expect((await request(owner, 'GET', 'hotel-searches/' + snapshot.hotelSearchId)).payload).toEqual(snapshot);
        expect(fresh.quotes[0]!.quoteId).not.toBe(snapshot.quotes[0]!.quoteId);
    });
    it('cannot sell five adults in one two-adult room and preserves missing-age diagnostics', async () => {
        const owner = await session(), impossible = await search(owner, { ...query, party: { adults: 5, children: 0, infants: 0 } });
        expect(impossible.status).toBe('empty');
        expect(impossible.quotes).toEqual([]);
        expect(impossible.results?.every(row => row.representativeQuoteId === null)).toBe(true);
        const missing = await search(owner, { ...query, party: { adults: 2, children: 1, childAges: [8], infants: 0 } });
        expect(missing.quotes).toEqual([]);
        expect(missing.results?.some(row => row.status === 'unknown' && row.reasons.includes('stay-child-ages-required'))).toBe(true);
        const aged = await search(owner, { ...query, party: { adults: 2, children: 1, infants: 0 }, childAgesAtCheckIn: [12] });
        expect(aged.quotes).toEqual([]);
    });
    it('prices exact multi-room stay ages and leaves uncertain infant semantics nonactionable', async () => {
        const owner = await session(), snapshot = await search(owner, { ...query, rooms: 2, party: { adults: 3, children: 2, infants: 0 }, childAgesAtCheckIn: [4, 11] });
        expect(snapshot.status).toBe('complete');
        for (const q of snapshot.quotes) {
            expect(q.roomAllocation).toHaveLength(2);
            expect(q.roomAllocation.reduce((n, r) => n + r.adults, 0)).toBe(3);
            expect(q.roomAllocation.flatMap(r => r.childAgesAtCheckIn ?? []).sort((a, b) => a - b)).toEqual([4, 11]);
        }
        const infants = await search(owner, { ...query, party: { adults: 2, children: 0, infants: 1 } });
        expect(infants.quotes.every(q => q.roomDetails!.every(d => d.infantCountsTowardOccupancy.status === 'known' && !d.infantCountsTowardOccupancy.value))).toBe(true);
        expect(infants.quotes.every(q => q.roomAllocation.every(r => r.roomRateId.endsWith('-rate-2')))).toBe(true);
    });
    it('validates destination-local boundaries, actual arrival references, and arbitrary valid custom points', async () => {
        const owner = await session('normal', '2026-10-25T23:00:00Z');
        expect((await request(owner, 'POST', 'hotel-searches', query)).status).toBe(400);
        const last = await search(owner, { ...query, checkIn: '2027-02-22', checkOut: '2027-02-23' });
        expect(last.status).toBe('complete');
        expect((await request(owner, 'POST', 'hotel-searches', { ...query, checkIn: '2027-02-23', checkOut: '2027-02-24' })).status).toBe(400);
        expect((await request(owner, 'POST', 'hotel-searches', { ...query, checkIn: '2026-10-26', arrivalPlaceId: 'tehran-IKA', sort: 'arrival-distance' })).status).toBe(400);
        expect((await request(owner, 'POST', 'hotel-searches', { ...query, checkIn: '2026-10-26', sort: 'arrival-distance' })).status).toBe(400);
        const custom = await search(owner, { ...query, checkIn: '2026-10-26', sort: 'location-distance', customPoint: { latitude: 89, longitude: 179 } });
        expect(custom.results!.every(r => r.locationDistanceKm !== null && r.arrivalDistanceKm === null && r.distanceKind === 'straight-line')).toBe(true);
        const priced = custom.results!.filter(r => r.status === 'priced');
        expect(priced.map(r => r.locationDistanceKm)).toEqual(priced.map(r => r.locationDistanceKm).sort((a, b) => a! - b!));
    });
    it('uses the shared guest confirmation, concurrent idempotency, receipt GET and frozen replay', async () => {
        const owner = await session(), { intent, checked } = await ready(owner);
        expect(checked.status).toBe('ready');
        expect(intent.selection.quoteVersion).toBe(2);
        expect(Date.parse(intent.expiresAt) - Date.parse(intent.createdAt)).toBe(120000);
        const input = accepted(intent), confirmed = await Promise.all(Array.from({ length: 4 }, () => request(owner, 'POST', 'referrals/confirm', input)));
        expect(confirmed.every(r => r.status === 201)).toBe(true);
        const receipt = ReferralReceiptSchema.parse(confirmed[0]!.payload);
        expect(confirmed.every(r => JSON.stringify(r.payload) === JSON.stringify(receipt))).toBe(true);
        expect(receipt.payload).toEqual(intent.quote);
        expect((await request(owner, 'GET', 'referrals/' + receipt.referralId)).payload).toEqual(receipt);
        expect(await sessions.database.referralEvent.count({ where: { sessionId: owner.sessionId } })).toBe(1);
        expect((await request(owner, 'POST', 'referrals/confirm', { ...input, acceptedQuoteVersion: 1 })).payload).toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
        now = new Date(now.getTime() + 700000);
        await sessions.database.demoSession.update({ where: { id: owner.sessionId }, data: { scenario: 'sold-out' } });
        expect((await request(owner, 'POST', 'referrals/confirm', input)).payload).toEqual(receipt);
    });
    it('rechecks fresh material room terms and price from base without compounding', async () => {
        const owner = await session('price-change'), { snapshot, checked, intent } = await ready(owner);
        expect(checked.status).toBe('changed');
        if (checked.status !== 'changed' || intent.quote.kind !== 'hotel')
            throw Error('expected hotel change');
        expect(checked.previousQuote.quote).toEqual(snapshot.quotes[0]);
        expect(checked.materialChanges).toContain('roomDetails');
        expect(checked.materialChanges).toContain('total');
        expect(intent.quote.quote.roomAllocation).toEqual(snapshot.quotes[0]!.roomAllocation);
        expect(intent.quote.quote.total.amountRial).toBeGreaterThan(snapshot.quotes[0]!.total.amountRial);
        expect((await request(owner, 'POST', 'referrals/confirm', { ...accepted(intent), acceptedQuoteVersion: 1 })).payload).toMatchObject({ code: 'QUOTE_CHANGED' });
        const again = await prepare(owner, intent.quote.quote);
        expect(again.status).toBe('ready');
        if (again.status === 'unavailable')
            throw Error('expected ready');
        expect(again.intent.quote.quote.total).toEqual(intent.quote.quote.total);
        expect(again.intent.selection.quoteVersion).toBe(3);
        expect((await request(owner, 'POST', 'referrals/confirm', accepted(intent))).payload).toMatchObject({ code: 'QUOTE_CHANGED' });
        expect((await request(owner, 'POST', 'referrals/confirm', accepted(again.intent))).status).toBe(201);
        const old = await prepare(owner, snapshot.quotes[0]!);
        expect(old).toMatchObject({ status: 'unavailable', reason: 'QUOTE_CHANGED' });
    });
    it('sold-out targets one immutable selected allocation and a returned same-query alternative rechecks ready', async () => {
        const owner = await session('sold-out'), snapshot = await search(owner), target = snapshot.quotes.find(q => q.quoteId === snapshot.results!.find(r => r.status === 'priced')!.representativeQuoteId)!;
        const result = await prepare(owner, target);
        expect(result.status).toBe('unavailable');
        if (result.status !== 'unavailable')
            throw Error('expected unavailable');
        expect(result.alternativeQuoteIds.length).toBeGreaterThan(0);
        expect(result.alternativeQuoteIds).not.toContain(target.quoteId);
        const alternative = snapshot.quotes.find(q => q.quoteId === result.alternativeQuoteIds[0])!;
        expect(alternative.query).toEqual(target.query);
        const checked = await prepare(owner, alternative);
        expect(checked.status).toBe('ready');
        if (checked.status === 'unavailable')
            throw Error('expected alternative ready');
        expect((await request(owner, 'POST', 'referrals/confirm', accepted(checked.intent))).status).toBe(201);
        expect(await sessions.database.quote.count({ where: { sessionId: owner.sessionId, id: target.quoteId } })).toBe(1);
    });
    it('binds intent and quote deadlines, exact digest, scope and private recheck lineage', async () => {
        const owner = await session(), foreign = await session(), { snapshot, intent } = await ready(owner);
        expect((await request(foreign, 'GET', 'hotel-searches/' + snapshot.hotelSearchId)).status).toBe(404);
        expect((await request(foreign, 'POST', 'referrals/prepare', { kind: 'hotel', quoteId: intent.selection.quoteId, quoteVersion: 2 })).status).toBe(404);
        expect((await request(foreign, 'POST', 'referrals/confirm', accepted(intent))).status).toBe(404);
        const version = await sessions.database.quote.findUniqueOrThrow({ where: { sessionId_id_version: { sessionId: owner.sessionId, id: intent.selection.quoteId, version: 2 } } });
        expect(version.hotelSearchId).not.toBe(snapshot.hotelSearchId);
        expect((await request(owner, 'GET', 'hotel-searches/' + version.hotelSearchId)).status).toBe(404);
        const row = await sessions.database.referralIntent.findUniqueOrThrow({ where: { sessionId_id: { sessionId: owner.sessionId, id: intent.intentId } } });
        const forged = { ...intent, intentId: randomUUID() };
        await sessions.database.referralIntent.create({ data: { sessionId: owner.sessionId, id: forged.intentId, quoteId: row.quoteId, quoteVersion: row.quoteVersion, createdAt: row.createdAt, expiresAt: row.expiresAt, payload: json({ ...(row.payload as object), intent: forged }) } });
        expect((await request(owner, 'POST', 'referrals/confirm', accepted(forged))).payload).toMatchObject({ code: 'QUOTE_CHANGED' });
        now = new Date(now.getTime() + 120000);
        expect((await request(owner, 'POST', 'referrals/confirm', accepted(intent))).payload).toMatchObject({ code: 'INTENT_EXPIRED' });
        now = new Date(now.getTime() + 480000);
        expect(await prepare(owner, snapshot.quotes[1]!)).toMatchObject({ status: 'unavailable', reason: 'QUOTE_EXPIRED' });
        expect((await request(owner, 'GET', 'hotel-searches/' + snapshot.hotelSearchId)).payload).toEqual(snapshot);
    });
    it('does not bind hotel confirmation to simulated identity or mutable session touch timestamps', async () => {
        const owner = await session(), { intent } = await ready(owner);
        expect((await request(owner, 'POST', 'auth/demo/sign-in', {})).status).toBe(201);
        now = new Date(now.getTime() + 1000);
        expect((await request(owner, 'POST', 'referrals/confirm', accepted(intent))).status).toBe(201);
    });
    it('invalidates a prepared intent when relevant provider context changes', async () => {
        const owner = await session(), { intent } = await ready(owner);
        await sessions.database.providerOverride.create({ data: { sessionId: owner.sessionId, providerId: 'demo-provider-01', payload: { paused: true } } });
        expect((await request(owner, 'POST', 'referrals/confirm', accepted(intent))).payload).toMatchObject({ code: 'QUOTE_CHANGED' });
    });
    it('paused provider inventory is not actionable and fresh source failures are diagnostic', async () => {
        const owner = await session();
        for (let i = 1; i <= 6; i++)
            await sessions.database.providerOverride.create({ data: { sessionId: owner.sessionId, providerId: 'demo-provider-0' + i, payload: { paused: true } } });
        const snapshot = await search(owner);
        expect(snapshot.quotes).toEqual([]);
        expect(snapshot.status).toBe('failed');
        expect(snapshot.results!.every(r => r.status === 'failed')).toBe(true);
    });
    it('shares two-operation admission with transport and admits only two concurrent hotel operations', async () => {
        const owner = await session(), repo = repository();
        const attempts = await Promise.allSettled(Array.from({ length: 3 }, () => repo.admitSearch(scope(owner), query, 'Asia/Tehran', now)));
        expect(attempts.filter(r => r.status === 'fulfilled')).toHaveLength(2);
        expect(attempts.find(r => r.status === 'rejected')).toMatchObject({ reason: { code: 'SEARCH_LIMIT' } });
        expect((await request(owner, 'POST', 'hotel-searches', query)).payload).toMatchObject({ code: 'SEARCH_LIMIT' });
        const transport = { mode: 'flight', scope: 'domestic', tripType: 'one-way', originCityId: 'tehran', destinationCityId: 'mashhad', departureDate: '2026-10-25', party: { adults: 1, children: 0, infants: 0 }, classCode: 'economy', filters: {}, sort: 'cheapest' };
        expect((await request(owner, 'POST', 'searches', { query: transport, clientGeneration: 't20-bound' })).payload).toMatchObject({ code: 'SEARCH_LIMIT' });
        for (const result of attempts)
            if (result.status === 'fulfilled')
                await repo.fail(scope(owner), result.value.id, 'test-cancelled', now);
        expect((await search(owner)).status).toBe('complete');
    });
    it('rejects a source race after admission and records failed work without committing quotes', async () => {
        const owner = await session();
        let release!: () => void, entered!: () => void;
        const gate = new Promise<void>(resolve => {
            release = resolve;
        }), reached = new Promise<void>(resolve => {
            entered = resolve;
        });
        const original = HotelRepository.prototype.completeSearch;
        vi.spyOn(HotelRepository.prototype, 'completeSearch').mockImplementation(async function (this: HotelRepository, ...args) {
            entered();
            await gate;
            return original.apply(this, args);
        });
        const pending = request(owner, 'POST', 'hotel-searches', query);
        await reached;
        await sessions.database.providerOverride.create({ data: { sessionId: owner.sessionId, providerId: 'demo-provider-01', payload: { paused: true } } });
        release();
        expect((await pending).payload).toMatchObject({ code: 'QUOTE_CHANGED' });
        const runs = await sessions.database.hotelSearchRun.findMany({ where: { sessionId: owner.sessionId } });
        expect(runs).toHaveLength(1);
        expect(runs[0]!.payload).toMatchObject({ phase: 'failed' });
        expect(await sessions.database.quote.count({ where: { sessionId: owner.sessionId } })).toBe(0);
    });
    it('reset fences an in-flight owner and erases its old hotel/quote/referral scope', async () => {
        const owner = await session();
        let release!: () => void, entered!: () => void;
        const gate = new Promise<void>(resolve => {
            release = resolve;
        }), reached = new Promise<void>(resolve => {
            entered = resolve;
        });
        const original = HotelRepository.prototype.completeSearch;
        vi.spyOn(HotelRepository.prototype, 'completeSearch').mockImplementation(async function (this: HotelRepository, ...args) {
            entered();
            await gate;
            return original.apply(this, args);
        });
        const pending = request(owner, 'POST', 'hotel-searches', query);
        await reached;
        const response = await fetch(base + '/api/v1/demo/reset', { method: 'POST', headers: { Cookie: owner.cookie, 'Content-Type': 'application/json' }, body: '{}' });
        expect(response.status).toBe(201);
        const oldId = owner.sessionId;
        owner.cookie = response.headers.get('set-cookie')!.split(';')[0]!;
        const credentialHash = createHash('sha256').update(owner.cookie.slice(owner.cookie.indexOf('=') + 1)).digest('hex');
        owner.sessionId = (await sessions.database.demoSession.findUniqueOrThrow({ where: { credentialHash } })).id;
        release();
        expect((await pending).payload).toMatchObject({ code: 'SESSION_EXPIRED' });
        expect(await sessions.database.hotelSearchRun.count({ where: { sessionId: oldId } })).toBe(0);
        expect(await sessions.database.quote.count({ where: { sessionId: oldId } })).toBe(0);
        vi.restoreAllMocks();
        expect((await search(owner)).status).toBe('complete');
    });
    it('reads identical persisted snapshots after restart and recovers interrupted public/private hotel work', async () => {
        const owner = await session(), snapshot = await search(owner), repo = repository();
        const abandoned = await repo.admitSearch(scope(owner), query, 'Asia/Tehran', now);
        const recheck = await repo.admitRecheck(scope(owner), { kind: 'hotel', quoteId: snapshot.quotes[0]!.quoteId, quoteVersion: 1 }, 'Asia/Tehran', { now: () => now });
        await app.close();
        await boot();
        expect((await request(owner, 'GET', 'hotel-searches/' + snapshot.hotelSearchId)).payload).toEqual(snapshot);
        expect((await request(owner, 'GET', 'hotel-searches/' + abandoned.id)).payload).toMatchObject({ status: 'failed', quotes: [] });
        expect((await request(owner, 'GET', 'hotel-searches/' + recheck.id)).status).toBe(404);
        const failed = await sessions.database.hotelSearchRun.findMany({ where: { sessionId: owner.sessionId, id: { in: [abandoned.id, recheck.id] } } });
        expect(failed.every(r => (r.payload as {
            phase?: string;
        }).phase === 'failed')).toBe(true);
        expect((await search(owner)).status).toBe('complete');
        expect(await new SearchRepository(sessions.database).get(scope(owner), snapshot.hotelSearchId).catch(e => e.code)).toBe('NOT_FOUND');
    });
});
