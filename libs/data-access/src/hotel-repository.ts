import { createHash, randomUUID } from 'node:crypto';
import { parseDate } from '@internationalized/date';
import { HotelSchema, HotelSearchQuerySchema, HotelSearchSnapshotSchema, HotelQuoteSnapshotSchema, ReferralIntentSchema, type Hotel, type RoomRate, type HotelRoomPolicy, type HotelSearchQuery, type HotelSearchSnapshot, type HotelQuoteSnapshot, type ReferralSelection, type ReferralIntent, type RecheckResult, type HotelComparisonResult } from '@torob-ticket/contracts';
import { allocateRooms, priceStay, rankHotels, straightLineKm, localDateAt, canonicalValue, hotelIdentity, HOTEL_ENGINE_REVISION, HOTEL_POLICY_REVISION, type RealClock, type HotelRankInput } from '@torob-ticket/domain';
import type { Prisma, PrismaClient } from './generated/client';
import { RepositoryError, scopedTransaction, type DataScope } from './scope';
import { readProviderContext, type ProviderContextSnapshot } from './search-repository';
import { assertSearchAdmission } from './admission';
import { materializeStoredHotelRate } from './hotel-source';
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const digest = (v: unknown) => createHash('sha256').update(canonicalValue(v)).digest('hex');
export interface HotelSource {
    timeZone: string;
    frozen: ProviderContextSnapshot;
    hotels: Hotel[];
    templates: {
        id: string;
        hotelId: string;
        payload: unknown;
    }[];
    rates: RoomRate[];
    policies: Record<string, HotelRoomPolicy>;
    issues: Record<string, string[]>;
    engineRevision: string;
    policyRevision: string;
}
export interface HotelRun {
    kind: 'hotel-search' | 'hotel-referral-recheck';
    phase: 'running' | 'complete' | 'failed';
    query: HotelSearchQuery;
    source: HotelSource;
    fingerprint: string;
    startedAt: string;
    snapshot?: HotelSearchSnapshot;
    originHotelSearchId?: string;
    selection?: ReferralSelection;
    result?: RecheckResult;
    failure?: string;
    profile?: {
        revision: string;
        scenario: string;
        phase: 'search' | 'recheck';
        targetQuoteId?: string;
        selectedQuoteId?: string;
        rule: string;
    };
}
export function hotelFingerprint(source: HotelSource) {
    const i = source.frozen.info;
    return digest({ fixtureVersion: i.fixtureVersion, catalogRevision: i.catalogRevision, seed: i.seed, anchorInstant: i.anchorInstant, scenario: i.scenario, scenarioRevision: i.scenarioRevision, mappingRevision: i.mappingRevision, mappings: source.frozen.mappings, overrides: source.frozen.overrides.slice().sort((a, b) => a.providerId.localeCompare(b.providerId, 'en')), timeZone: source.timeZone, hotels: source.hotels, templates: source.templates, engineRevision: source.engineRevision, policyRevision: source.policyRevision });
}
/** Hotel source and lineage authority. All writes/read-confirmation share the session lock. */
export class HotelRepository {
    constructor(private readonly db: PrismaClient) {
    }
    private async source(tx: Prisma.TransactionClient, scope: DataScope, destinationCityId: string, timeZone: string): Promise<HotelSource> {
        const session = await tx.demoSession.findUniqueOrThrow({ where: { id: scope.sessionId } });
        const frozen = await readProviderContext(tx, scope, session);
        const hotelRows = await tx.hotel.findMany({ where: { fixtureVersion: session.fixtureVersion }, orderBy: { id: 'asc' } });
        const hotels = hotelRows.map(row => HotelSchema.parse(row.payload)).filter(h => h.destinationCityId === destinationCityId);
        const templates = await tx.roomRate.findMany({ where: { fixtureVersion: session.fixtureVersion, hotelId: { in: hotels.map(h => h.hotelId) } }, orderBy: { id: 'asc' } });
        const rates: RoomRate[] = [], policies: Record<string, HotelRoomPolicy> = {}, issues: Record<string, string[]> = {};
        for (const row of templates) {
            try {
                const item = materializeStoredHotelRate(row.payload, frozen.info.anchorInstant, timeZone);
                if (item.rate.hotelId !== row.hotelId || item.rate.roomRateId !== row.id)
                    throw new Error('identity mismatch');
                rates.push(item.rate);
                policies[row.id] = item.policy;
            }
            catch {
                issues[row.hotelId] = [...(issues[row.hotelId] ?? []), 'invalid-stored-room-source'];
            }
        }
        return { timeZone, frozen, hotels, templates: templates.map(row => ({ id: row.id, hotelId: row.hotelId, payload: row.payload })), rates, policies, issues, engineRevision: HOTEL_ENGINE_REVISION, policyRevision: HOTEL_POLICY_REVISION };
    }
    async admitSearch(scope: DataScope, input: HotelSearchQuery, timeZone: string, now: Date) {
        return scopedTransaction(this.db, scope, async (tx) => {
            await assertSearchAdmission(tx, scope);
            const query = HotelSearchQuerySchema.parse(input), source = await this.source(tx, scope, query.destinationCityId, timeZone);
            const min = localDateAt(source.frozen.info.anchorInstant, timeZone), max = parseDate(min).add({ days: 120 }).toString();
            if (query.checkIn < min || query.checkOut > max)
                throw new RepositoryError('INVALID_QUERY');
            const id = randomUUID();
            const run: HotelRun = { kind: 'hotel-search', phase: 'running', query, source, fingerprint: hotelFingerprint(source), startedAt: now.toISOString() };
            await tx.hotelSearchRun.create({ data: { sessionId: scope.sessionId, id, queryKey: hotelIdentity(query, { fingerprint: run.fingerprint }), payload: json(run), createdAt: now } });
            await this.audit(tx, scope, 'hotel-search-started', { hotelSearchId: id, query, fingerprint: run.fingerprint, source }, now);
            return { id, run };
        });
    }
    private profiled(source: HotelSource, phase: 'search' | 'recheck', quoteId?: string, targetQuoteId?: string) {
        const scenario = source.frozen.info.scenario;
        const failures = new Map(source.frozen.overrides.map(row => [row.providerId, row.payload as {
                paused?: boolean;
                failureProfile?: string;
            }]));
        const issues = { ...source.issues };
        const rates = source.rates.flatMap(rate => {
            const override = failures.get(rate.providerId);
            if (override?.paused || override?.failureProfile && override.failureProfile !== 'none') {
                issues[rate.hotelId] = [...(issues[rate.hotelId] ?? []), override.paused ? 'provider-paused' : 'provider-source-failed'];
                return [];
            }
            const next = structuredClone(rate);
            if (scenario === 'no-eligible-results' || phase === 'recheck' && scenario === 'sold-out' && quoteId === targetQuoteId)
                next.nightlyPrices = next.nightlyPrices.map(n => ({ ...n, availableRooms: 0 }));
            if (phase === 'recheck' && scenario === 'price-change') {
                next.nightlyPrices = next.nightlyPrices.map(n => {
                    const value = BigInt(n.total.amountRial) * 110n / 100n;
                    if (value > BigInt(Number.MAX_SAFE_INTEGER))
                        throw new RangeError('Hotel profile exceeds safe rial range');
                    return { ...n, total: { amountRial: Number(value), currency: 'IRR' } };
                });
                next.terms = { ...next.terms, breakfast: { status: 'known', value: !(next.terms.breakfast.status === 'known' && next.terms.breakfast.value) } };
                next.provenance = [...next.provenance, { rawRecordId: 'hotel-profile-' + rate.roomRateId, sourceNamespace: 'authored-fiction/hotel-recheck', sourceValue: { profile: scenario, rule: 'base110percent-and-breakfast-toggle', roomRateId: rate.roomRateId }, sourceRevision: 'hotel-recheck-v1', mappingRevision: source.frozen.info.mappingRevision, fixtureVersion: source.frozen.info.fixtureVersion }];
            }
            return [next];
        });
        return { rates, issues };
    }
    buildSnapshot(id: string, run: HotelRun, timeZone: string, arrivalPoint: {
        latitude: number;
        longitude: number;
    } | undefined, now: Date): HotelSearchSnapshot {
        void timeZone;
        const source = run.source, { rates, issues } = this.profiled(source, 'search');
        const quotes: HotelQuoteSnapshot[] = [], results: HotelComparisonResult[] = [], ranks: HotelRankInput[] = [];
        for (const hotel of source.hotels) {
            const hotelRates = rates.filter(r => r.hotelId === hotel.hotelId), allocations = allocateRooms(run.query, hotelRates, source.policies);
            const priced: HotelQuoteSnapshot[] = [], states: {
                status: string;
                reasons: string[];
                knownSubtotal?: {
                    amountRial: number;
                    currency: 'IRR';
                };
            }[] = [];
            for (const allocation of allocations.allocations) {
                const candidate = priceStay(run.query, allocation, hotelRates, source.policies, this.priceContext(run.source, id + '|' + canonicalValue(allocation), now));
                if (candidate.status === 'priced')
                    priced.push(candidate.quote);
                else
                    states.push(candidate);
            }
            priced.sort((a, b) => a.total.amountRial - b.total.amountRial || canonicalValue(a.roomAllocation).localeCompare(canonicalValue(b.roomAllocation), 'en'));
            quotes.push(...priced);
            const status: HotelComparisonResult['status'] = priced.length ? 'priced' : states.some(s => s.status === 'incomplete') ? 'incomplete' : issues[hotel.hotelId]?.length ? 'failed' : allocations.status === 'unknown' ? 'unknown' : hotelRates.length ? 'ineligible' : 'unavailable';
            const reasons = priced.length ? [] : [...new Set([...allocations.reasons, ...states.flatMap(s => s.reasons), ...(issues[hotel.hotelId] ?? []), ...(!hotelRates.length ? ['hotel-rates-unavailable'] : [])])].sort();
            const subtotal = states.flatMap(s => s.knownSubtotal ? [s.knownSubtotal] : []).sort((a, b) => a.amountRial - b.amountRial)[0];
            const arrivalDistanceKm = arrivalPoint ? straightLineKm(hotel.point, arrivalPoint) : null, locationDistanceKm = run.query.customPoint ? straightLineKm(hotel.point, run.query.customPoint) : null;
            results.push({ hotelId: hotel.hotelId, status, reasons, representativeQuoteId: priced[0]?.quoteId ?? null, quoteIds: priced.map(q => q.quoteId), arrivalDistanceKm, locationDistanceKm, distanceKind: 'straight-line', ...(subtotal ? { knownSubtotal: subtotal } : {}) });
            ranks.push({ hotel, quote: priced[0], arrivalDistanceKm, locationDistanceKm });
        }
        const ranked = rankHotels(ranks, run.query.sort), order = ranked.map(r => r.hotel.hotelId);
        return HotelSearchSnapshotSchema.parse({ hotelSearchId: id, query: run.query, status: quotes.length ? 'complete' : results.length && results.every(r => r.status === 'failed') ? 'failed' : 'empty', hotels: ranked.map(r => r.hotel), quotes: order.flatMap(h => quotes.filter(q => q.hotelId === h)), results: order.map(h => results.find(r => r.hotelId === h)!), observedAt: now.toISOString() });
    }
    private priceContext(source: HotelSource, key: string, now: Date, quoteId?: string, version = 1) {
        return { quoteId: quoteId ?? 'hotel-quote-' + digest(key).slice(0, 40), version, observedAt: now.toISOString(), sourceRevision: 'hotel-v1', mappingRevision: source.frozen.info.mappingRevision, fixtureVersion: source.frozen.info.fixtureVersion };
    }
    completeSearch(scope: DataScope, id: string, snapshot: HotelSearchSnapshot, timeZone: string) {
        return scopedTransaction(this.db, scope, async (tx) => {
            const run = await this.running(tx, scope, id);
            const current = await this.source(tx, scope, run.query.destinationCityId, timeZone);
            if (hotelFingerprint(current) !== run.fingerprint)
                throw new RepositoryError('QUOTE_CHANGED');
            for (const quote of snapshot.quotes)
                await tx.quote.create({ data: { sessionId: scope.sessionId, id: quote.quoteId, version: quote.version, hotelSearchId: id, payload: json(quote), observedAt: new Date(quote.observedAt), expiresAt: new Date(quote.expiresAt) } });
            await tx.hotelSearchRun.update({ where: { sessionId_id: { sessionId: scope.sessionId, id } }, data: { payload: json({ ...run, phase: 'complete', snapshot, profile: this.profile(run.source, 'search') }) } });
            await this.audit(tx, scope, 'hotel-search-completed', { hotelSearchId: id, snapshot }, new Date(snapshot.observedAt));
            return snapshot;
        });
    }
    get(scope: DataScope, id: string) {
        return scopedTransaction(this.db, scope, async (tx) => {
            const row = await tx.hotelSearchRun.findUnique({ where: { sessionId_id: { sessionId: scope.sessionId, id } } }), run = row?.payload as unknown as HotelRun;
            if (!row || run.kind !== 'hotel-search' || !run.snapshot)
                throw new RepositoryError('NOT_FOUND');
            return HotelSearchSnapshotSchema.parse(run.snapshot);
        });
    }
    private async running(tx: Prisma.TransactionClient, scope: DataScope, id: string) {
        const row = await tx.hotelSearchRun.findUnique({ where: { sessionId_id: { sessionId: scope.sessionId, id } } }), run = row?.payload as unknown as HotelRun;
        if (!row || run.phase !== 'running')
            throw new RepositoryError('NOT_FOUND');
        return run;
    }
    async fail(scope: DataScope, id: string, reason: string, now: Date) {
        return scopedTransaction(this.db, scope, async (tx) => {
            const row = await tx.hotelSearchRun.findUnique({ where: { sessionId_id: { sessionId: scope.sessionId, id } } }), run = row?.payload as unknown as HotelRun;
            if (!row || run.phase !== 'running')
                return;
            const snapshot = run.kind === 'hotel-search' ? HotelSearchSnapshotSchema.parse({ hotelSearchId: id, query: run.query, status: 'failed', hotels: [], quotes: [], results: [], observedAt: run.startedAt }) : undefined;
            await tx.hotelSearchRun.update({ where: { sessionId_id: { sessionId: scope.sessionId, id } }, data: { payload: json({ ...run, phase: 'failed', failure: reason, ...(snapshot ? { snapshot } : {}) }) } });
            await this.audit(tx, scope, 'hotel-work-failed', { hotelSearchId: id, reason }, now);
        });
    }
    async interruptUnfinished(now: Date) {
        const rows = await this.db.hotelSearchRun.findMany({ where: { payload: { path: ['phase'], equals: 'running' } }, select: { sessionId: true, id: true } });
        for (const row of rows)
            try {
                await this.fail({ sessionId: row.sessionId }, row.id, 'interrupted', now);
            }
            catch (e) {
                if (!(e instanceof RepositoryError && e.code === 'SESSION_EXPIRED'))
                    throw e;
            }
    }
    private async selected(tx: Prisma.TransactionClient, scope: DataScope, selection: ReferralSelection, now: Date) {
        if (selection.kind !== 'hotel')
            throw new RepositoryError('OFFER_UNAVAILABLE');
        const row = await tx.quote.findUnique({ where: { sessionId_id_version: { sessionId: scope.sessionId, id: selection.quoteId, version: selection.quoteVersion } } });
        if (!row)
            throw new RepositoryError('NOT_FOUND');
        if (!row.hotelSearchId)
            throw new RepositoryError('OFFER_UNAVAILABLE');
        if (row.expiresAt <= now)
            throw new RepositoryError('QUOTE_EXPIRED');
        const quote = HotelQuoteSnapshotSchema.parse(row.payload);
        if (quote.completeness.status !== 'complete')
            throw new RepositoryError('INCOMPLETE_PRICE');
        if (quote.eligibility.status !== 'eligible')
            throw new RepositoryError('OFFER_UNAVAILABLE');
        const latest = await tx.quote.findFirst({ where: { sessionId: scope.sessionId, id: selection.quoteId }, orderBy: { version: 'desc' } });
        if (latest?.version !== selection.quoteVersion)
            throw new RepositoryError('QUOTE_CHANGED');
        const original = await tx.quote.findUnique({ where: { sessionId_id_version: { sessionId: scope.sessionId, id: selection.quoteId, version: 1 } }, include: { hotelSearch: true } });
        const origin = original?.hotelSearch?.payload as unknown as HotelRun;
        if (!original?.hotelSearch || canonicalValue(quote.query) !== canonicalValue(origin.query) || origin.kind !== 'hotel-search' || origin.phase !== 'complete' || !origin.snapshot?.quotes.some(q => q.quoteId === selection.quoteId && canonicalValue(q) === canonicalValue(original.payload)))
            throw new RepositoryError('NOT_FOUND');
        let parent = origin;
        if (row.version > 1) {
            const record = await tx.hotelSearchRun.findUnique({ where: { sessionId_id: { sessionId: scope.sessionId, id: row.hotelSearchId } } });
            parent = record?.payload as unknown as HotelRun;
            if (parent?.kind !== 'hotel-referral-recheck' || parent.phase !== 'complete' || parent.originHotelSearchId !== original.hotelSearchId || parent.selection?.quoteId !== selection.quoteId || parent.selection.quoteVersion !== row.version - 1 || parent.result?.status === 'unavailable' || !parent.result || canonicalValue(parent.result.intent.quote.quote) !== canonicalValue(quote))
                throw new RepositoryError('NOT_FOUND');
        }
        const expected = this.evaluate(parent.source, quote, origin, 'historical', new Date(quote.observedAt));
        if (expected.status !== 'priced' || canonicalValue(expected.quote) !== canonicalValue(quote))
            throw new RepositoryError('QUOTE_CHANGED');
        return { row, quote, origin, originId: original.hotelSearchId!, parent };
    }
    private profile(source: HotelSource, phase: 'search' | 'recheck', origin?: HotelRun, selectedQuoteId?: string): NonNullable<HotelRun['profile']> {
        return { revision: 'hotel-profile-v1', scenario: source.frozen.info.scenario, phase, ...(origin ? { targetQuoteId: this.target(origin) } : {}), ...(selectedQuoteId ? { selectedQuoteId } : {}), rule: phase === 'recheck' && source.frozen.info.scenario === 'price-change' ? 'base110percent-and-breakfast-toggle' : phase === 'recheck' && source.frozen.info.scenario === 'sold-out' ? 'origin-first-complete-representative-unavailable' : source.frozen.info.scenario === 'no-eligible-results' ? 'all-night-inventory-zero' : 'unchanged-base' };
    }
    private target(origin: HotelRun) {
        return origin.snapshot?.results?.find(r => r.status === 'priced')?.representativeQuoteId ?? origin.snapshot?.quotes[0]?.quoteId;
    }
    private evaluate(source: HotelSource, quote: HotelQuoteSnapshot, origin: HotelRun, phase: 'historical' | 'fresh', now: Date) {
        const recheck = phase === 'fresh' || quote.version > 1;
        const { rates } = this.profiled(source, recheck ? 'recheck' : 'search', quote.quoteId, this.target(origin));
        return priceStay(quote.query, quote.roomAllocation, rates.filter(r => r.hotelId === quote.hotelId && r.providerId === quote.providerId), source.policies, this.priceContext(source, '', now, quote.quoteId, phase === 'fresh' ? quote.version + 1 : quote.version));
    }
    queryForSelection(scope: DataScope, selection: ReferralSelection, clock: RealClock) {
        return scopedTransaction(this.db, scope, async (tx) => (await this.selected(tx, scope, selection, clock.now())).quote.query);
    }
    admitRecheck(scope: DataScope, selection: ReferralSelection, timeZone: string, clock: RealClock) {
        return scopedTransaction(this.db, scope, async (tx) => {
            const now = clock.now(), selected = await this.selected(tx, scope, selection, now);
            const source = await this.source(tx, scope, selected.quote.query.destinationCityId, timeZone);
            await assertSearchAdmission(tx, scope);
            const id = randomUUID(), run: HotelRun = { kind: 'hotel-referral-recheck', phase: 'running', query: selected.quote.query, source, fingerprint: hotelFingerprint(source), startedAt: now.toISOString(), originHotelSearchId: selected.originId, selection };
            await tx.hotelSearchRun.create({ data: { sessionId: scope.sessionId, id, queryKey: hotelIdentity(run.query, { fingerprint: run.fingerprint }), payload: json(run), createdAt: now } });
            await this.audit(tx, scope, 'hotel-recheck-started', { hotelSearchId: id, originHotelSearchId: selected.originId, selection, fingerprint: run.fingerprint }, now);
            return { id, run, previous: selected.quote, origin: selected.origin };
        });
    }
    finishRecheck(scope: DataScope, id: string, timeZone: string, clock: RealClock) {
        return scopedTransaction(this.db, scope, async (tx) => {
            const now = clock.now(), run = await this.running(tx, scope, id);
            if (run.kind !== 'hotel-referral-recheck' || !run.selection)
                throw new RepositoryError('NOT_FOUND');
            const source = await this.source(tx, scope, run.query.destinationCityId, timeZone);
            if (hotelFingerprint(source) !== run.fingerprint)
                throw new RepositoryError('QUOTE_CHANGED');
            const selected = await this.selected(tx, scope, run.selection, now), fresh = this.evaluate(source, selected.quote, selected.origin, 'fresh', now);
            let result: RecheckResult;
            if (fresh.status !== 'priced') {
                const alternativeQuoteIds: string[] = [];
                for (const alternative of selected.origin.snapshot!.quotes) {
                    if (alternative.quoteId === selected.quote.quoteId)
                        continue;
                    try {
                        const existing = await this.selected(tx, scope, { kind: 'hotel', quoteId: alternative.quoteId, quoteVersion: alternative.version }, now);
                        if (this.evaluate(source, existing.quote, selected.origin, 'fresh', now).status === 'priced')
                            alternativeQuoteIds.push(alternative.quoteId);
                    }
                    catch (e) {
                        if (!(e instanceof RepositoryError))
                            throw e;
                    }
                }
                result = { status: 'unavailable', reason: fresh.status === 'incomplete' ? 'INCOMPLETE_PRICE' : 'OFFER_UNAVAILABLE', retryable: fresh.status === 'unknown', alternativeQuoteIds: [...new Set(alternativeQuoteIds)] };
            }
            else {
                const quote = fresh.quote;
                await tx.quote.create({ data: { sessionId: scope.sessionId, id: quote.quoteId, version: quote.version, hotelSearchId: id, payload: json(quote), observedAt: now, expiresAt: new Date(quote.expiresAt) } });
                const intent = ReferralIntentSchema.parse({ intentId: randomUUID(), selection: { kind: 'hotel', quoteId: quote.quoteId, quoteVersion: quote.version }, quote: { kind: 'hotel', quote }, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + 120000).toISOString() });
                const payload = { intent, fingerprint: run.fingerprint, digest: digest(intent) };
                await tx.referralIntent.create({ data: { sessionId: scope.sessionId, id: intent.intentId, quoteId: quote.quoteId, quoteVersion: quote.version, payload: json(payload), createdAt: now, expiresAt: new Date(intent.expiresAt) } });
                const materialChanges = (['total', 'breakdown', 'roomAllocation', 'terms', 'roomDetails'] as const).filter(key => canonicalValue(selected.quote[key]) !== canonicalValue(quote[key]));
                result = materialChanges.length ? { status: 'changed', intent, previousQuoteVersion: selected.quote.version, previousQuote: { kind: 'hotel', quote: selected.quote }, materialChanges } : { status: 'ready', intent };
            }
            await tx.hotelSearchRun.update({ where: { sessionId_id: { sessionId: scope.sessionId, id } }, data: { payload: json({ ...run, phase: 'complete', source, result, profile: this.profile(source, 'recheck', selected.origin, selected.quote.quoteId) }) } });
            await this.audit(tx, scope, 'hotel-rechecked', { hotelSearchId: id, result }, now);
            return result;
        });
    }
    async assertHotelIntent(tx: Prisma.TransactionClient, scope: DataScope, intent: ReferralIntent, fingerprint: string, now: Date) {
        if (intent.selection.kind !== 'hotel' || intent.quote.kind !== 'hotel')
            throw new RepositoryError('QUOTE_CHANGED');
        const selected = await this.selected(tx, scope, intent.selection, now), source = await this.source(tx, scope, selected.quote.query.destinationCityId, selected.origin.source.timeZone);
        if (hotelFingerprint(source) !== fingerprint)
            throw new RepositoryError('QUOTE_CHANGED');
        const expected = this.evaluate(source, selected.quote, selected.origin, 'historical', new Date(selected.quote.observedAt));
        if (expected.status !== 'priced' || canonicalValue(expected.quote) !== canonicalValue(intent.quote.quote) || canonicalValue(selected.quote) !== canonicalValue(intent.quote.quote))
            throw new RepositoryError('QUOTE_CHANGED');
    }
    private audit(tx: Prisma.TransactionClient, scope: DataScope, kind: string, payload: unknown, now: Date) {
        return tx.auditEvent.create({ data: { sessionId: scope.sessionId, id: randomUUID(), kind, payload: json(payload), createdAt: now } });
    }
}
