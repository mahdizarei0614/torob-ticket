import {randomUUID} from 'node:crypto';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {HOTEL_DIRECTORY_SOURCE_REVISION, type HotelSearchQuery, type HotelQuoteSnapshot, type ReferralIntent} from '@torob-ticket/contracts';
import {SearchRepository, SessionRepository, sessionInfo, type HotelInventoryResolver, type HotelRun, type Prisma} from '@torob-ticket/data-access';
import {catalog, fixtureIdentity, realHotelInventory} from '@torob-ticket/fixtures';
import {requireTestDatabaseUrl} from '../../test/test-database.cjs';
import {FrozenDemoClock, SystemRealClock} from '../common/clocks';
import {CatalogService} from '../catalog/catalog.service';
import {ProviderService} from '../providers/provider.service';
import {ReferralService} from '../referrals/referral.service';
import type {SessionContext} from '../sessions/session-context';
import {SessionService} from '../sessions/session.service';
import {HotelService} from './hotel.service';

const query: HotelSearchQuery = {destinationCityId: 'mashhad', checkIn: '2026-11-02', checkOut: '2026-11-03', party: {adults: 1, children: 0, infants: 0}, rooms: 1, sort: 'cheapest'};
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
// Constructed source inputs prove version isolation without depending on the
// separately researched directory or pretending these are production locations.
const directory = {
    revision: HOTEL_DIRECTORY_SOURCE_REVISION, retrievedAt: '2026-10-30T00:00:00Z',
    license: 'ODbL-1.0', attribution: '© OpenStreetMap contributors', status: 'complete',
    hotels: catalog.cities.map((city, index) => ({
        hotelId: 'constructed-' + city.id, destinationCityId: city.id,
        name: 'Constructed source property ' + (index + 1), point: city.point,
        address: null, stars: null, osmType: 'node', osmId: index + 1,
        sourceUrl: 'https://www.openstreetmap.org/node/' + (index + 1),
    })),
};
const initialInventory: HotelInventoryResolver = input => realHotelInventory(input, directory);
const preFourAdultInventory: HotelInventoryResolver = input => {
    const inventory = initialInventory(input);
    return inventory ? {...inventory, templates: inventory.templates.filter(template => !template.id.endsWith('-rate-4'))} : inventory;
};
const replacementInventory: HotelInventoryResolver = input => {
    const inventory = initialInventory(input);
    if (!inventory) return inventory;
    return {
        ...inventory, sourceRevision: 'hotel-directory-next-constructed',
        hotels: inventory.hotels.map(hotel => ({...hotel, name: hotel.name + ' replacement'})),
        templates: inventory.templates.map(template => {
            const payload = template.payload as {nightlyTemplate: {amountRial: number}[]};
            return {...template, payload: {...payload, nightlyTemplate: payload.nightlyTemplate.map(night => ({...night, amountRial: night.amountRial + 1000000}))}};
        }),
    };
};

describe('real hotel source upgrade preserves PostgreSQL history and current authority', () => {
    let sessions: SessionService;
    const owners: SessionContext[] = [], hotelServices: HotelService[] = [], referralServices: ReferralService[] = [];
    let original: HotelService, current: HotelService, replacement: HotelService, published: HotelService, preFourAdult: HotelService;
    let oldReferrals: ReferralService, currentReferrals: ReferralService, replacementReferrals: ReferralService;
    beforeAll(async () => {
        process.env.DATABASE_URL = requireTestDatabaseUrl(process.env.TEST_DATABASE_URL);
        sessions = new SessionService(new SystemRealClock());
        await sessions.ensureReady();
        const providers = new ProviderService(() => new SearchRepository(sessions.database), sessions.realClock);
        const service = (inventory: HotelInventoryResolver) => {
            const referrals = new ReferralService(sessions, providers);
            const hotels = new HotelService(sessions, new CatalogService(), referrals, inventory);
            referralServices.push(referrals); hotelServices.push(hotels);
            return {referrals, hotels};
        };
        ({referrals: oldReferrals, hotels: original} = service(() => undefined));
        ({referrals: currentReferrals, hotels: current} = service(initialInventory));
        ({hotels: preFourAdult} = service(preFourAdultInventory));
        ({referrals: replacementReferrals, hotels: replacement} = service(replacementInventory));
        ({hotels: published} = service(realHotelInventory));
    });
    afterAll(async () => {
        for (const service of hotelServices) await service.onModuleDestroy();
        for (const service of referralServices) await service.onModuleDestroy();
        if (sessions) {
            await sessions.database.demoSession.deleteMany({where: {id: {in: owners.map(owner => owner.sessionId)}}});
            await sessions.onModuleDestroy();
        }
    });
    async function owner() {
        const row = await new SessionRepository(sessions.database, fixtureIdentity).create(randomUUID(), {seed: 8181, anchorInstant: '2026-10-29T00:00:00Z'}, new Date());
        const value: SessionContext = {sessionId: row.id, scope: {sessionId: row.id}, info: sessionInfo(row), demoClock: new FrozenDemoClock(row.anchorInstant.toISOString())};
        owners.push(value); return value;
    }
    async function ready(referrals: ReferralService, context: SessionContext, quote: HotelQuoteSnapshot) {
        const result = await referrals.prepareReferral(context, {kind: 'hotel', quoteId: quote.quoteId, quoteVersion: quote.version});
        expect(result.status).toBe('ready');
        if (result.status !== 'ready' || result.intent.quote.kind !== 'hotel') throw new Error('Expected unchanged hotel source');
        return result.intent;
    }
    const accepted = (intent: ReferralIntent) => ({intentId: intent.intentId, acceptedQuoteVersion: intent.selection.quoteVersion, idempotencyKey: randomUUID()});
    async function stored(context: SessionContext, id: string) {
        return sessions.database.hotelSearchRun.findUniqueOrThrow({where: {sessionId_id: {sessionId: context.sessionId, id}}});
    }

    it('retains legacy quote identities, source facts and receipts after current-source searches in the same owner', async () => {
        const context = await owner(), info = structuredClone(context.info);
        const historic = await original.searchHotels(context, query), oldQuote = historic.quotes[0]!;
        expect(historic).not.toHaveProperty('sourceRevision');
        expect(oldQuote.sourceRevision).toBe('hotel-v1');
        const oldSearchBytes = JSON.stringify((await stored(context, historic.hotelSearchId)).payload);
        const oldQuoteBytes = JSON.stringify((await sessions.database.quote.findUniqueOrThrow({where: {sessionId_id_version: {sessionId: context.sessionId, id: oldQuote.quoteId, version: 1}}})).payload);
        const oldIntent = await ready(oldReferrals, context, oldQuote);
        const input = accepted(oldIntent), receipt = await oldReferrals.confirmReferral(context, input);
        const fresh = await current.searchHotels(context, query);
        expect(fresh.sourceRevision).toBe(HOTEL_DIRECTORY_SOURCE_REVISION);
        expect(fresh.hotels).toHaveLength(1);
        expect(fresh.hotels[0]).toMatchObject({hotelId: 'constructed-mashhad', stars: null, point: directory.hotels.find(hotel => hotel.destinationCityId === 'mashhad')!.point});
        expect(fresh.quotes.length).toBeGreaterThan(0);
        expect(fresh.quotes.every(quote => quote.sourceRevision === HOTEL_DIRECTORY_SOURCE_REVISION && quote.roomDetails?.every(detail => detail.terms.breakfast.status === 'unknown' && !('checkInLocalTime' in detail.policy)))).toBe(true);
        expect(await current.get(context, historic.hotelSearchId)).toEqual(historic);
        expect(await currentReferrals.getReferral(context, receipt.referralId)).toEqual(receipt);
        expect(await currentReferrals.confirmReferral(context, input)).toEqual(receipt);
        const again = await ready(currentReferrals, context, oldIntent.quote.kind === 'hotel' ? oldIntent.quote.quote : oldQuote);
        expect(again.quote.kind).toBe('hotel');
        if (again.quote.kind !== 'hotel') throw new Error('Expected historical hotel quote');
        expect(again.quote.quote.total).toEqual(oldQuote.total);
        expect(again.quote.quote.sourceRevision).toBe('hotel-v1');
        expect(JSON.stringify((await stored(context, historic.hotelSearchId)).payload)).toBe(oldSearchBytes);
        expect(JSON.stringify((await sessions.database.quote.findUniqueOrThrow({where: {sessionId_id_version: {sessionId: context.sessionId, id: oldQuote.quoteId, version: 1}}})).payload)).toBe(oldQuoteBytes);
        expect(context.info).toEqual(info);
    });

    it('rechecks recorded new-source facts and confirms through the default repository after the active resolver changes', async () => {
        const context = await owner(), historic = await current.searchHotels(context, query), selected = historic.quotes[0]!;
        const historicBytes = JSON.stringify((await stored(context, historic.hotelSearchId)).payload);
        const fresh = await replacement.searchHotels(context, query);
        expect(fresh.sourceRevision).toBe('hotel-directory-next-constructed');
        expect(fresh.hotels[0]!.name).not.toBe(historic.hotels[0]!.name);
        expect(fresh.quotes[0]!.total).not.toEqual(selected.total);
        const intent = await ready(replacementReferrals, context, selected);
        if (intent.quote.kind !== 'hotel') throw new Error('Expected hotel quote');
        expect(intent.quote.quote.sourceRevision).toBe(HOTEL_DIRECTORY_SOURCE_REVISION);
        expect(intent.quote.quote.total).toEqual(selected.total);
        // ReferralRepository.confirm creates HotelRepository(db) without a source
        // resolver. It must reconstruct this exact recorded directory version.
        const receipt = await replacementReferrals.confirmReferral(context, accepted(intent));
        expect(receipt.payload).toEqual(intent.quote);
        expect(JSON.stringify((await stored(context, historic.hotelSearchId)).payload)).toBe(historicBytes);
        expect(await replacement.get(context, historic.hotelSearchId)).toEqual(historic);
    });

    it('adds a real eligible four-adult one-room rate while retaining exact pre-change sources, quotes and referral recheck', async () => {
        const context = await owner(), historic = await preFourAdult.searchHotels(context, query), selected = historic.quotes[0]!;
        const oldRun = (await stored(context, historic.hotelSearchId)).payload as unknown as HotelRun, oldSearchBytes = JSON.stringify(oldRun);
        const oldQuoteKey = {sessionId_id_version: {sessionId: context.sessionId, id: selected.quoteId, version: selected.version}};
        const oldQuoteBytes = JSON.stringify((await sessions.database.quote.findUniqueOrThrow({where: oldQuoteKey})).payload);
        expect(oldRun.source.templates).toHaveLength(3);
        const fresh = await current.searchHotels(context, {...query, party: {adults: 4, children: 0, infants: 0}});
        expect(fresh.status).toBe('complete');expect(fresh.quotes.length).toBeGreaterThan(0);
        const nextRun = (await stored(context, fresh.hotelSearchId)).payload as unknown as HotelRun;
        expect(nextRun.source.templates).toHaveLength(4);expect(nextRun.fingerprint).not.toBe(oldRun.fingerprint);
        expect(JSON.stringify(nextRun.source.templates.filter(template => !template.id.endsWith('-rate-4')))).toBe(JSON.stringify(oldRun.source.templates));
        for (const quote of fresh.quotes) {
            expect(quote.query).toMatchObject({rooms: 1, party: {adults: 4, children: 0, infants: 0}});
            expect(quote.eligibility.status).toBe('eligible');expect(quote.roomAllocation).toHaveLength(1);
            expect(quote.roomAllocation[0]).toMatchObject({adults: 4, children: 0, infants: 0, roomRateId: expect.stringContaining('-rate-4')});
            expect(quote.roomDetails?.[0]).toMatchObject({roomType: 'اتاق چهار‌نفره', maxAdults: 4});
            const rate = nextRun.source.rates.find(rate => rate.roomRateId === quote.roomAllocation[0]!.roomRateId)!;
            expect(quote.total).toEqual(rate.nightlyPrices.find(night => night.date === query.checkIn)!.total);
        }
        const intent = await ready(currentReferrals, context, selected);
        if (intent.quote.kind !== 'hotel') throw new Error('Expected historical hotel quote');
        expect(intent.quote.quote.total).toEqual(selected.total);expect(intent.quote.quote.roomAllocation).toEqual(selected.roomAllocation);
        const receipt = await currentReferrals.confirmReferral(context, accepted(intent));expect(receipt.payload).toEqual(intent.quote);
        expect(JSON.stringify((await stored(context, historic.hotelSearchId)).payload)).toBe(oldSearchBytes);
        expect(JSON.stringify((await sessions.database.quote.findUniqueOrThrow({where: oldQuoteKey})).payload)).toBe(oldQuoteBytes);
        expect(await current.get(context, historic.hotelSearchId)).toEqual(historic);
    });

    it('keeps current provider, mapping and scenario authority fenced for recorded new-source intents', async () => {
        for (const change of ['provider', 'mapping', 'scenario'] as const) {
            const context = await owner(), snapshot = await current.searchHotels(context, query), intent = await ready(currentReferrals, context, snapshot.quotes[0]!);
            if (change === 'provider') await sessions.database.providerOverride.create({data: {sessionId: context.sessionId, providerId: snapshot.quotes[0]!.providerId, payload: {paused: true}}});
            if (change === 'mapping') await new SessionRepository(sessions.database, fixtureIdentity).applyMapping(context.scope, context.info.mappingRevision, {sourceAuthorityTest: true}, new Date());
            if (change === 'scenario') await sessions.database.demoSession.update({where: {id: context.sessionId}, data: {scenario: 'sold-out', scenarioRevision: 'changed-scenario-authority'}});
            await expect(currentReferrals.confirmReferral(context, accepted(intent))).rejects.toMatchObject({code: 'QUOTE_CHANGED'});
        }
    });

    it('keeps legacy stored rates immutable and confirms unchanged original source facts', async () => {
        const context = await owner(), legacy = await original.searchHotels(context, query), intent = await ready(oldReferrals, context, legacy.quotes[0]!);
        const source = (await stored(context, legacy.hotelSearchId)).payload as unknown as HotelRun;
        const rateId = source.source.templates.find(template => template.id === legacy.quotes[0]!.roomAllocation[0]!.roomRateId)!.id;
        const key = {fixtureVersion_hotelId_id: {fixtureVersion: fixtureIdentity.fixtureVersion, hotelId: legacy.quotes[0]!.hotelId, id: rateId}};
        const row = await sessions.database.roomRate.findUniqueOrThrow({where: key});
        const originalBytes = JSON.stringify(row.payload);
        await expect(sessions.database.roomRate.update({where: key, data: {payload: json({...row.payload as object, sourceChangedDuringIntent: true})}})).rejects.toThrow(/immutable fixture: RoomRate/);
        expect(JSON.stringify((await sessions.database.roomRate.findUniqueOrThrow({where: key})).payload)).toBe(originalBytes);
        expect((await oldReferrals.confirmReferral(context, accepted(intent))).payload).toEqual(intent.quote);
    });

    it('prices the complete published real directory through the service for all current destinations', async () => {
        const context = await owner();
        for (const city of catalog.cities) {
            const expected = realHotelInventory({fixtureVersion: fixtureIdentity.fixtureVersion, destinationCityId: city.id})!;
            const snapshot = await published.searchHotels(context, {...query, destinationCityId: city.id});
            expect(snapshot.sourceRevision).toBe(HOTEL_DIRECTORY_SOURCE_REVISION);
            expect(snapshot.status).toBe('complete');
            expect(snapshot.hotels).toHaveLength(expected.hotels.length);
            expect(snapshot.results).toHaveLength(expected.hotels.length);
            expect(snapshot.quotes.length).toBeGreaterThan(0);
            for (const hotel of snapshot.hotels) expect(hotel).toEqual(expected.hotels.find(row => row.hotelId === hotel.hotelId));
            expect(snapshot.quotes.every(quote => quote.sourceRevision === HOTEL_DIRECTORY_SOURCE_REVISION && quote.total.amountRial > 0 && quote.roomDetails?.every(detail => !('checkInLocalTime' in detail.policy) && detail.terms.breakfast.status === 'unknown'))).toBe(true);
            expect(await published.get(context, snapshot.hotelSearchId)).toEqual(snapshot);
        }
    }, 30000);
});
