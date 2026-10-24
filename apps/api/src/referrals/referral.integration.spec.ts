import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SearchRepository, SessionRepository, sessionInfo } from '@torob-ticket/data-access';
import { ReferralReceiptSchema, RecheckResultSchema, type QuoteSnapshot, type TransportSearchQuery } from '@torob-ticket/contracts';
import { fixtureIdentity, generateProviderRecords } from '@torob-ticket/fixtures';
import { requireTestDatabaseUrl } from '../../test/test-database.cjs';
import { FrozenDemoClock } from '../common/clocks';
import { SessionService } from '../sessions/session.service';
import type { SessionContext } from '../sessions/session-context';
import { ProviderService } from '../providers/provider.service';
import { SearchService } from '../searches/search.service';
import { ReferralService } from './referral.service';
import { RecheckRegistry } from './recheck-registry';
import { MockProvider, mockRegistry, type ProviderAdapter } from '@torob-ticket/provider-adapters';
import { DatePriceService } from '../date-prices/date-price.service';
const query: TransportSearchQuery = { mode: 'flight', scope: 'domestic', tripType: 'round-trip', originCityId: 'tehran', destinationCityId: 'mashhad', departureDate: '2026-10-25', returnDate: '2026-10-28', party: { adults: 2, children: 1, childAges: [8], infants: 0 }, classCode: 'economy', filters: {}, sort: 'cheapest' };
describe('fresh, scoped, atomic referrals', () => {
    let providers: ProviderService;
    let sessions: SessionService;
    let search: SearchService;
    let referrals: ReferralService;
    let now = new Date('2026-10-24T12:00:00Z');
    const contexts: SessionContext[] = [];
    async function setup(scenario: 'normal' | 'price-change' | 'sold-out' = 'normal') {
        now = new Date('2026-10-24T12:00:00Z');
        const row = await new SessionRepository(sessions.database, fixtureIdentity).create(randomUUID(), { seed: 5, anchorInstant: '2026-10-24T00:00:00Z', scenario }, now);
        const c: SessionContext = { sessionId: row.id, scope: { sessionId: row.id }, info: sessionInfo(row), demoClock: new FrozenDemoClock(row.anchorInstant.toISOString()) };
        contexts.push(c);
        for (const providerId of ['demo-provider-01', 'demo-provider-02', 'demo-provider-03', 'demo-provider-04'])
            await sessions.database.providerOverride.create({ data: { sessionId: c.sessionId, providerId, payload: { latencyMs: 0 } } });
        const started = await search.startSearch(c, { query, clientGeneration: randomUUID() });
        let snapshot = (await search.getSearch(c, started.snapshot.searchId)).snapshot;
        await expect.poll(async () => { snapshot = (await search.getSearch(c, started.snapshot.searchId)).snapshot; return snapshot.status; }, { timeout: 5000, interval: 10 }).toBe('complete');
        const quote = snapshot.groups.flatMap(g => g.eligibleQuotes).find(q => q.providerId === 'demo-provider-04')!;
        expect(quote).toBeDefined();
        return { c, quote, searchId: snapshot.searchId };
    }
    const selection = (quote: QuoteSnapshot) => ({ kind: 'transport' as const, quoteId: quote.quoteId, quoteVersion: quote.version });
    beforeAll(async () => {
        process.env.DATABASE_URL = requireTestDatabaseUrl(process.env.TEST_DATABASE_URL);
        sessions = new SessionService({ now: () => new Date(now) });
        await sessions.ensureReady();
        providers = new ProviderService(() => new SearchRepository(sessions.database), sessions.realClock);
        search = new SearchService(sessions, providers);
        referrals = new ReferralService(sessions, providers);
    });
    afterAll(async () => { await referrals?.onModuleDestroy(); await search?.onModuleDestroy(); await sessions.database.demoSession.deleteMany({ where: { id: { in: contexts.map(c => c.sessionId) } } }); await sessions?.onModuleDestroy(); });
    it('rechecks real evidence, preserves whole-party roundtrip, and confirms once under concurrency and refresh', async () => {
        const { c, quote } = await setup();
        const prepared = await referrals.prepareReferral(c, selection(quote));
        expect(prepared.status).toBe('ready');
        expect(RecheckResultSchema.safeParse(prepared).success).toBe(true);
        if (prepared.status === 'unavailable')
            throw Error('unavailable');
        const { intent } = prepared;
        if (intent.quote.kind !== 'transport')
            throw Error('transport');
        expect(intent.selection.quoteVersion).toBe(2);
        expect(intent.quote.quote.party).toEqual(query.party);
        expect(Date.parse(intent.expiresAt) - Date.parse(intent.createdAt)).toBe(120000);
        expect(intent.quote.quote.total).toEqual(quote.total);
        if (intent.quote.kind !== 'transport')
            throw Error('transport');
        expect(intent.quote.itinerary.return?.segments.length).toBeGreaterThan(0);
        const input = { intentId: intent.intentId, acceptedQuoteVersion: 2, idempotencyKey: 'click' };
        const receipts = await Promise.all(Array.from({ length: 6 }, () => referrals.confirmReferral(c, input)));
        expect(new Set(receipts.map(r => r.referralId)).size).toBe(1);
        const receipt = receipts[0]!;
        expect(ReferralReceiptSchema.safeParse(receipt).success).toBe(true);
        expect(receipt.payload).toEqual(intent.quote);
        expect(receipt.handoffPath).toBe(`/provider-demo/${receipt.referralId}`);
        expect(await referrals.getReferral(c, receipt.referralId)).toEqual(receipt);
        expect(await sessions.database.referralEvent.count({ where: { sessionId: c.sessionId } })).toBe(1);
        const versions = await sessions.database.quote.findMany({ where: { sessionId: c.sessionId, id: quote.quoteId }, orderBy: { version: 'asc' }, include: { offer: true } });
        expect(versions[0]!.payload).toEqual(quote);
        expect(versions[1]!.offerId).not.toBe(versions[0]!.offerId);
        const parent = versions[1]!.offer!.searchId;
        expect(await sessions.database.rawRecord.count({ where: { sessionId: c.sessionId, providerRun: { searchId: parent } } })).toBeGreaterThan(0);
        await expect(search.getSearch(c, parent)).rejects.toMatchObject({ code: 'NOT_FOUND' });
        await expect(search.cancelSearch(c, parent)).rejects.toMatchObject({ code: 'NOT_FOUND' });
        await expect(search.retrySearch(c, parent, 'invalid')).rejects.toMatchObject({ code: 'NOT_FOUND' });
        await expect(search.startSearch(c, { query, clientGeneration: 'invalid', supersedesSearchId: parent })).rejects.toMatchObject({ code: 'NOT_FOUND' });
        await expect(referrals.confirmReferral(c, { ...input, acceptedQuoteVersion: 1 })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
        now = new Date(now.getTime() + 600000);
        await sessions.database.demoSession.update({ where: { id: c.sessionId }, data: { scenario: 'sold-out' } });
        expect(await referrals.confirmReferral(c, input)).toEqual(receipt);
        expect((await sessions.database.auditEvent.findMany({ where: { sessionId: c.sessionId } })).some(e => /booking|revenue|conversion/.test(e.kind))).toBe(false);
    });
    it('returns exact old/new price facts requiring the new accepted version', async () => {
        const { c, quote } = await setup('price-change');
        const result = await referrals.prepareReferral(c, selection(quote));
        expect(result.status).toBe('changed');
        if (result.status !== 'changed')
            throw Error('changed');
        expect(result.previousQuote.quote).toEqual(quote);
        expect(result.intent.quote.quote.total.amountRial).toBeGreaterThan(quote.total.amountRial);
        expect(result.materialChanges).toContain('total');
        const input = { intentId: result.intent.intentId, acceptedQuoteVersion: 1, idempotencyKey: 'accept' };
        await expect(referrals.confirmReferral(c, input)).rejects.toMatchObject({ code: 'QUOTE_CHANGED' });
        expect((await referrals.confirmReferral(c, { ...input, acceptedQuoteVersion: 2 })).payload).toEqual(result.intent.quote);
    });
    it('rejects sold-out, expired quotes, hotel guesses, and another reviewer', async () => {
        const a = await setup('sold-out');
        const b = await setup();
        const sold = await referrals.prepareReferral(a.c, selection(a.quote));
        expect(sold).toMatchObject({ status: 'unavailable', reason: 'OFFER_UNAVAILABLE' });
        if (sold.status !== 'unavailable')
            throw Error('sold-out');
        expect(sold.alternativeQuoteIds.length).toBeGreaterThan(0);
        expect(sold.alternativeQuoteIds).not.toContain(a.quote.quoteId);
        await expect(referrals.prepareReferral(b.c, selection(a.quote))).rejects.toMatchObject({ code: 'NOT_FOUND' });
        expect(await referrals.prepareReferral(a.c, { ...selection(a.quote), kind: 'hotel' })).toMatchObject({ status: 'unavailable' });
        now = new Date(Date.parse(b.quote.expiresAt));
        expect(await referrals.prepareReferral(b.c, selection(b.quote))).toMatchObject({ status: 'unavailable', reason: 'QUOTE_EXPIRED' });
        expect(await sessions.database.referralEvent.count({ where: { sessionId: a.c.sessionId } })).toBe(0);
    });
    it('fences intent expiry at exactly two minutes and context edits including unchanged override revision', async () => {
        for (const edit of ['expiry', 'override', 'scenario', 'mapping'] as const) {
            const { c, quote } = await setup();
            const result = await referrals.prepareReferral(c, selection(quote));
            if (result.status === 'unavailable')
                throw Error('ready');
            const input = { intentId: result.intent.intentId, acceptedQuoteVersion: 2, idempotencyKey: 'stale' };
            if (edit === 'expiry')
                now = new Date(result.intent.expiresAt);
            if (edit === 'override')
                await sessions.database.providerOverride.update({ where: { sessionId_providerId: { sessionId: c.sessionId, providerId: 'demo-provider-04' } }, data: { payload: { latencyMs: 1 } } });
            if (edit === 'scenario')
                await sessions.database.demoSession.update({ where: { id: c.sessionId }, data: { scenario: 'sold-out' } });
            if (edit === 'mapping')
                await new SessionRepository(sessions.database).applyMapping(c.scope, c.info.mappingRevision, { entityType: 'city', sourceNamespace: 'demo-provider-04/v1', sourceValue: 'alias', targetId: 'tehran', baseRevision: c.info.mappingRevision }, now);
            await expect(referrals.confirmReferral(c, input)).rejects.toMatchObject({ code: edit === 'expiry' ? 'INTENT_EXPIRED' : 'QUOTE_CHANGED' });
            expect(await sessions.database.referralEvent.count({ where: { sessionId: c.sessionId } })).toBe(0);
        }
    });
    it('allows a repeated fresh version and rejects stale concurrent preparation and previous intent acceptance', async () => {
        const { c, quote } = await setup();
        const result = await referrals.prepareReferral(c, selection(quote));
        if (result.status === 'unavailable')
            throw Error('ready');
        const outcomes = await Promise.allSettled([referrals.prepareReferral(c, result.intent.selection), referrals.prepareReferral(c, result.intent.selection)]);
        const ready = outcomes.filter(r => r.status === 'fulfilled' && r.value.status !== 'unavailable');
        expect(ready).toHaveLength(1);
        await expect(referrals.confirmReferral(c, { intentId: result.intent.intentId, acceptedQuoteVersion: 2, idempotencyKey: 'stale' })).rejects.toMatchObject({ code: 'QUOTE_CHANGED' });
        expect(await sessions.database.quote.count({ where: { sessionId: c.sessionId, id: quote.quoteId } })).toBe(3);
    });
    it('returns exact baggage and refund changes, independently of the adapter outcome hint', async () => {
        for (const condition of ['baggage', 'refund'] as const) {
            const { c, quote } = await setup();
            const adapter = new MockProvider('demo-provider-04', input => generateProviderRecords(input).map(raw => {
                if (raw.providerId !== 'demo-provider-04')
                    return raw;
                const payload = structuredClone(raw.payload) as {
                    rules: {
                        bagKg: number;
                        refundable: boolean;
                    };
                };
                if (condition === 'baggage')
                    payload.rules.bagKg = 15;
                else
                    payload.rules.refundable = false;
                return { ...raw, payload };
            }));
            const registry = new RecheckRegistry([{ providerId: adapter.providerId, search: adapter.search.bind(adapter), dateInventory: adapter.dateInventory.bind(adapter), recheck: async (s, c) => ({ ...await adapter.recheck(s, c), outcome: 'unchanged' }) }]);
            const controlled = new ReferralService(sessions, providers, registry);
            try {
                const result = await controlled.prepareReferral(c, selection(quote));
                expect(result.status).toBe('changed');
                if (result.status !== 'changed')
                    throw Error('changed');
                expect(result.materialChanges).toContain('conditions');
                expect(result.previousQuote.quote).toEqual(quote);
                if (result.intent.quote.kind !== 'transport')
                    throw Error('transport');
                expect(result.intent.quote.quote.conditions.outbound).toMatchObject(condition === 'baggage' ? { checkedBaggageKg: { status: 'known', value: 15 } } : { refundable: { status: 'known', value: false } });
            }
            finally {
                await controlled.onModuleDestroy();
            }
        }
    });
    it('rejects incomplete new fares, source-party mismatch, substituted class and substituted journey', async () => {
        for (const alteration of ['incomplete', 'party', 'class', 'journey'] as const) {
            const { c, quote } = await setup();
            const adapter = new MockProvider('demo-provider-04', input => generateProviderRecords(input).map(raw => {
                if (raw.providerId !== 'demo-provider-04')
                    return raw;
                const payload = structuredClone(raw.payload) as {
                    pricing: {
                        mandatoryFees: number | null;
                    }[];
                    rules: {
                        class: string;
                    };
                    counts: {
                        adults: number;
                    };
                    legs: {
                        journey: {
                            segments: {
                                operatorId: string;
                            }[];
                        };
                    }[];
                };
                if (alteration === 'incomplete')
                    payload.pricing[0]!.mandatoryFees = null;
                if (alteration === 'party')
                    payload.counts.adults = 1;
                if (alteration === 'class')
                    payload.rules.class = 'business';
                if (alteration === 'journey')
                    payload.legs[0]!.journey.segments[0]!.operatorId = 'substitute';
                return { ...raw, payload };
            }));
            const controlled = new ReferralService(sessions, providers, new RecheckRegistry([adapter]));
            try {
                expect(await controlled.prepareReferral(c, selection(quote))).toMatchObject({ status: 'unavailable', reason: alteration === 'incomplete' ? 'INCOMPLETE_PRICE' : 'OFFER_UNAVAILABLE' });
                expect(await sessions.database.referralIntent.count({ where: { sessionId: c.sessionId } })).toBe(0);
            }
            finally {
                await controlled.onModuleDestroy();
            }
        }
    });
    it('confirms one millisecond before expiry, isolates intent/receipt reads, and conflicts on a different intent', async () => {
        const a = await setup();
        const b = await setup();
        const prepared = await referrals.prepareReferral(a.c, selection(a.quote));
        if (prepared.status === 'unavailable')
            throw Error('ready');
        const input = { intentId: prepared.intent.intentId, acceptedQuoteVersion: 2, idempotencyKey: 'same-key' };
        await expect(referrals.repository.getIntent(b.c.scope, input.intentId)).rejects.toMatchObject({ code: 'NOT_FOUND' });
        await expect(referrals.confirmReferral(b.c, input)).rejects.toMatchObject({ code: 'NOT_FOUND' });
        now = new Date(Date.parse(prepared.intent.expiresAt) - 1);
        const receipt = await referrals.confirmReferral(a.c, input);
        await expect(referrals.getReferral(b.c, receipt.referralId)).rejects.toMatchObject({ code: 'NOT_FOUND' });
        const fresh = await referrals.prepareReferral(a.c, prepared.intent.selection);
        if (fresh.status === 'unavailable')
            throw Error('ready');
        await expect(referrals.confirmReferral(a.c, { ...input, intentId: fresh.intent.intentId, acceptedQuoteVersion: 3 })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
        expect(await sessions.database.referralEvent.count({ where: { sessionId: a.c.sessionId } })).toBe(1);
    });
    it('rejects date-price observation IDs as comparison authority', async () => {
        const { c } = await setup();
        const dates = new DatePriceService(sessions, providers);
        try {
            const start = await dates.startDatePrices(c, { query, leg: 'outbound', dates: ['2026-10-26'], clientGeneration: 'dates' });
            let value = await dates.getDatePrices(c, start.datePriceId, 'dates');
            await expect.poll(async () => { value = await dates.getDatePrices(c, start.datePriceId, 'dates'); return value.status; }, { timeout: 5000, interval: 10 }).toBe('complete');
            const row = await sessions.database.quote.findFirstOrThrow({ where: { sessionId: c.sessionId, offer: { searchId: start.datePriceId } } });
            await expect(referrals.prepareReferral(c, { kind: 'transport', quoteId: row.id, quoteVersion: row.version })).rejects.toMatchObject({ code: 'NOT_FOUND' });
        }
        finally {
            await dates.onModuleDestroy();
        }
    });
    it('fences an override edited during recheck and shares the two-operation admission bound', async () => {
        const { c, quote } = await setup();
        let entered!: () => void;
        let release!: () => void;
        const enteredPromise = new Promise<void>(r => { entered = r; });
        const gate = new Promise<void>(r => { release = r; });
        const adapter = mockRegistry.find(a => a.providerId === 'demo-provider-04')!;
        const controlled = new ReferralService(sessions, providers, new RecheckRegistry([{ providerId: adapter.providerId, search: adapter.search.bind(adapter), dateInventory: adapter.dateInventory.bind(adapter), recheck: async (s, c) => { entered(); await gate; return adapter.recheck(s, c); } } satisfies ProviderAdapter]));
        try {
            const work = controlled.prepareReferral(c, selection(quote));
            await enteredPromise;
            const other = await search.repository.create(c.scope, { query, clientGeneration: 'other', snapshot: {} }, now, { enforceLimit: true });
            await expect(referrals.prepareReferral(c, selection(quote))).rejects.toMatchObject({ code: 'SEARCH_LIMIT' });
            await sessions.database.providerOverride.update({ where: { sessionId_providerId: { sessionId: c.sessionId, providerId: 'demo-provider-04' } }, data: { payload: { latencyMs: 1 } } });
            release();
            expect(await work).toMatchObject({ status: 'unavailable', reason: 'QUOTE_CHANGED' });
            expect(await sessions.database.referralIntent.count({ where: { sessionId: c.sessionId } })).toBe(0);
            await search.repository.interrupt(c.scope, other.id, now);
        }
        finally {
            release();
            await controlled.onModuleDestroy();
        }
    });
    it('reset aborts bounded provider work and never authorizes the replacement session', async () => {
        const { c, quote } = await setup();
        await sessions.database.providerOverride.update({ where: { sessionId_providerId: { sessionId: c.sessionId, providerId: 'demo-provider-04' } }, data: { payload: { latencyMs: 60000 } } });
        const work = referrals.prepareReferral(c, selection(quote));
        const settled = work.catch(error => error);
        await expect.poll(() => sessions.database.searchRun.count({ where: { sessionId: c.sessionId, status: 'collecting' } }), { timeout: 2000, interval: 10 }).toBe(1);
        const replacement = await sessions.reset(c, {}, { headers: {} }, { setHeader: () => undefined });
        expect(replacement.seed).toBe(5);
        await settled;
        expect(await sessions.database.referralEvent.count({ where: { sessionId: c.sessionId } })).toBe(0);
        expect(await sessions.database.referralIntent.count({ where: { sessionId: c.sessionId } })).toBe(0);
    });
    it('checks the real clock after acquiring the confirmation transaction lock', async () => {
        const { c, quote } = await setup();
        const result = await referrals.prepareReferral(c, selection(quote));
        if (result.status === 'unavailable')
            throw Error('ready');
        let locked!: () => void;
        let release!: () => void;
        const entered = new Promise<void>(r => { locked = r; });
        const gate = new Promise<void>(r => { release = r; });
        const blocker = sessions.database.$transaction(async (tx) => { await tx.$queryRaw `SELECT id FROM "DemoSession" WHERE id = ${c.sessionId} FOR UPDATE`; locked(); await gate; });
        await entered;
        const work = referrals.confirmReferral(c, { intentId: result.intent.intentId, acceptedQuoteVersion: 2, idempotencyKey: 'lock-boundary' });
        const assertion = expect(work).rejects.toMatchObject({ code: 'INTENT_EXPIRED' });
        now = new Date(result.intent.expiresAt);
        release();
        await blocker;
        await assertion;
        expect(await sessions.database.referralEvent.count({ where: { sessionId: c.sessionId } })).toBe(0);
    });
    it('persists truthful paused-provider evidence without inventing a click', async () => {
        const { c, quote } = await setup();
        await sessions.database.providerOverride.update({ where: { sessionId_providerId: { sessionId: c.sessionId, providerId: 'demo-provider-04' } }, data: { payload: { paused: true } } });
        expect(await referrals.prepareReferral(c, selection(quote))).toMatchObject({ status: 'unavailable' });
        const parent = await sessions.database.searchRun.findFirstOrThrow({ where: { sessionId: c.sessionId, snapshot: { path: ['kind'], equals: 'referral-recheck' } } });
        expect(await sessions.database.providerRun.findFirst({ where: { sessionId: c.sessionId, searchId: parent.id } })).toMatchObject({ providerId: 'demo-provider-04', status: 'paused', payload: { status: 'paused', outcome: 'unavailable' } });
        expect(await sessions.database.referralEvent.count({ where: { sessionId: c.sessionId } })).toBe(0);
    });
    it('rolls back intent/version creation when recheck audit persistence fails', async () => {
        const { c, quote } = await setup();
        await sessions.database.$executeRawUnsafe(`ALTER TABLE "AuditEvent" ADD CONSTRAINT t11_recheck_failure CHECK (kind <> 'referral-rechecked') NOT VALID`);
        try {
            await expect(referrals.prepareReferral(c, selection(quote))).rejects.toThrow();
        }
        finally {
            await sessions.database.$executeRawUnsafe('ALTER TABLE "AuditEvent" DROP CONSTRAINT t11_recheck_failure');
        }
        expect(await sessions.database.referralIntent.count({ where: { sessionId: c.sessionId } })).toBe(0);
        expect(await sessions.database.quote.count({ where: { sessionId: c.sessionId, id: quote.quoteId } })).toBe(1);
        expect(await sessions.database.rawRecord.count({ where: { sessionId: c.sessionId, providerRun: { search: { snapshot: { path: ['kind'], equals: 'referral-recheck' } } } } })).toBeGreaterThan(0);
        const parent = await sessions.database.searchRun.findFirstOrThrow({ where: { sessionId: c.sessionId, snapshot: { path: ['kind'], equals: 'referral-recheck' } } });
        const child = await sessions.database.providerRun.findFirstOrThrow({ where: { sessionId: c.sessionId, searchId: parent.id } });
        expect(parent.status).toBe('interrupted');
        expect(child).toMatchObject({ status: 'cancelled', payload: { status: 'cancelled', reason: 'interrupted' } });
        const eventsBefore = await sessions.database.searchEventRecord.count({ where: { sessionId: c.sessionId, searchId: parent.id } });
        await search.repository.interrupt(c.scope, parent.id, now);
        await sessions.ensureReady();
        expect(await sessions.database.providerRun.findFirstOrThrow({ where: { sessionId: c.sessionId, searchId: parent.id } })).toEqual(child);
        expect(await sessions.database.searchEventRecord.count({ where: { sessionId: c.sessionId, searchId: parent.id } })).toBe(eventsBefore);
        expect(await sessions.database.providerRun.count({ where: { sessionId: c.sessionId, status: { in: ['pending', 'running', 'collecting'] } } })).toBe(0);
        expect(await referrals.prepareReferral(c, selection(quote))).toMatchObject({ status: 'ready' });
    });
    it('bounds real recheck timers and reconciles an abandoned evidence operation on API restart', async () => {
        const { c, quote } = await setup();
        await sessions.database.providerOverride.update({ where: { sessionId_providerId: { sessionId: c.sessionId, providerId: 'demo-provider-04' } }, data: { payload: { latencyMs: 60000 } } });
        const started = Date.now();
        expect(await referrals.prepareReferral(c, selection(quote))).toMatchObject({ status: 'unavailable', retryable: true });
        expect(Date.now() - started).toBeLessThan(5000);
        const timed = await sessions.database.providerRun.findFirstOrThrow({ where: { sessionId: c.sessionId, search: { snapshot: { path: ['kind'], equals: 'referral-recheck' } } } });
        expect(timed.status).toBe('timeout');
        await sessions.database.providerOverride.update({ where: { sessionId_providerId: { sessionId: c.sessionId, providerId: 'demo-provider-04' } }, data: { payload: { latencyMs: 0 } } });
        const abandoned = await referrals.repository.admit(c.scope, selection(quote), sessions.realClock);
        const providerContext = await providers.createContext(c, abandoned.id, new AbortController().signal, new Date(now.getTime() + 5000), abandoned.operation.frozen);
        const batch = await new MockProvider('demo-provider-04').recheck({ query, serviceKey: abandoned.operation.previous.itinerary.itineraryId, previous: abandoned.operation.previous }, providerContext);
        expect(batch.status).toBe('success');
        const rawBefore = await sessions.database.rawRecord.findMany({ where: { sessionId: c.sessionId, providerRun: { searchId: abandoned.id } }, orderBy: { id: 'asc' } });
        expect(rawBefore.length).toBeGreaterThan(0);
        expect(await sessions.database.providerRun.findFirstOrThrow({ where: { sessionId: c.sessionId, searchId: abandoned.id } })).toMatchObject({ status: 'collecting' });
        // A mixed-state internal parent must retain an already-completed provider's evidence.
        const otherBatch = await new MockProvider('demo-provider-01').search(query, providerContext);
        expect(otherBatch.status).toBe('success');
        const completedChild = await sessions.database.providerRun.update({ where: { sessionId_searchId_providerId: { sessionId: c.sessionId, searchId: abandoned.id, providerId: 'demo-provider-01' } }, data: { status: 'complete', payload: { providerId: 'demo-provider-01', status: 'complete', offerCount: otherBatch.records.length } } });
        const replacement = new SessionService(sessions.realClock);
        try {
            await replacement.ensureReady();
            const parent = await sessions.database.searchRun.findUniqueOrThrow({ where: { sessionId_id: { sessionId: c.sessionId, id: abandoned.id } } });
            expect(parent.status).toBe('interrupted');
            const child = await sessions.database.providerRun.findUniqueOrThrow({ where: { sessionId_searchId_providerId: { sessionId: c.sessionId, searchId: abandoned.id, providerId: 'demo-provider-04' } } });
            expect(child).toMatchObject({ status: 'cancelled', payload: { status: 'cancelled', reason: 'interrupted' } });
            expect(await sessions.database.providerRun.findUniqueOrThrow({ where: { sessionId_id: { sessionId: c.sessionId, id: completedChild.id } } })).toEqual(completedChild);
            expect(await sessions.database.rawRecord.findMany({ where: { sessionId: c.sessionId, providerRun: { searchId: abandoned.id, providerId: 'demo-provider-04' } }, orderBy: { id: 'asc' } })).toEqual(rawBefore);
            await replacement.ensureReady();
            await search.repository.interruptUnfinished(now);
            await search.repository.interrupt(c.scope, abandoned.id, now);
            expect(await sessions.database.providerRun.findUniqueOrThrow({ where: { sessionId_id: { sessionId: c.sessionId, id: child.id } } })).toEqual(child);
            expect(await sessions.database.searchEventRecord.count({ where: { sessionId: c.sessionId, searchId: abandoned.id } })).toBe(1);
            expect(await sessions.database.providerRun.count({ where: { sessionId: c.sessionId, searchId: abandoned.id, status: { in: ['pending', 'running', 'collecting'] } } })).toBe(0);
            expect(await sessions.database.referralIntent.count({ where: { sessionId: c.sessionId } })).toBe(0);
            await expect(search.getSearch(c, abandoned.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
        }
        finally {
            await replacement.onModuleDestroy();
        }
    });
    it('shutdown terminalizes provider evidence already committed by a recheck sink', async () => {
        const { c, quote } = await setup();
        let entered!: () => void;
        const committed = new Promise<void>(resolve => { entered = resolve; });
        class PausingProviderService extends ProviderService {
            override async createContext(...args: Parameters<ProviderService['createContext']>) {
                const context = await super.createContext(...args);
                const sink = context.traceSink;
                context.traceSink = async evidence => {
                    await sink(evidence);
                    entered();
                    if (!context.signal.aborted) await new Promise<void>(resolve => context.signal.addEventListener('abort', () => resolve(), { once: true }));
                };
                return context;
            }
        }
        const controlled = new ReferralService(sessions, new PausingProviderService(() => new SearchRepository(sessions.database), sessions.realClock));
        const work = controlled.prepareReferral(c, selection(quote));
        try {
            await committed;
            const parent = await sessions.database.searchRun.findFirstOrThrow({ where: { sessionId: c.sessionId, status: 'collecting', snapshot: { path: ['kind'], equals: 'referral-recheck' } } });
            const rawBefore = await sessions.database.rawRecord.findMany({ where: { sessionId: c.sessionId, providerRun: { searchId: parent.id } } });
            expect(rawBefore).toHaveLength(1);
            await controlled.onModuleDestroy();
            expect(await work).toMatchObject({ status: 'unavailable' });
            expect(await sessions.database.searchRun.findUniqueOrThrow({ where: { sessionId_id: { sessionId: c.sessionId, id: parent.id } } })).toMatchObject({ status: 'interrupted' });
            expect(await sessions.database.providerRun.findFirstOrThrow({ where: { sessionId: c.sessionId, searchId: parent.id } })).toMatchObject({ status: 'cancelled', payload: { status: 'cancelled', reason: 'interrupted' } });
            expect(await sessions.database.rawRecord.findMany({ where: { sessionId: c.sessionId, providerRun: { searchId: parent.id } } })).toEqual(rawBefore);
            expect(await sessions.database.referralIntent.count({ where: { sessionId: c.sessionId } })).toBe(0);
            await search.repository.interrupt(c.scope, parent.id, now);
            expect(await sessions.database.searchEventRecord.count({ where: { sessionId: c.sessionId, searchId: parent.id } })).toBe(1);
        } finally {
            await controlled.onModuleDestroy();
            await work;
        }
    });

});
