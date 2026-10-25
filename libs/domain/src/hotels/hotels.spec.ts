import { describe, it, expect } from 'vitest';
import { HotelQuoteSnapshotSchema, type Hotel, type HotelSearchQuery, type Itinerary, type RoomRate, type RoomAllocation } from '@torob-ticket/contracts';
import { allocateRooms } from './allocate-rooms';
import { allocationEligibility } from './rate-authority';
import { priceStay } from './price-stay';
import { straightLineKm } from './distance';
import { rankHotels } from './rank-hotels';
import { suggestHotelStay } from './stay-suggestions';
import type { HotelRoomPolicy } from './types';
const query: HotelSearchQuery = { destinationCityId: 'city', checkIn: '2026-10-25', checkOut: '2026-10-27', party: { adults: 2, children: 0, infants: 0 }, rooms: 1, sort: 'cheapest' };
const provenance = [{ rawRecordId: 'r', sourceNamespace: 'constructed-hotel-test', sourceValue: 'test', sourceRevision: 'hotel-v1', mappingRevision: 'm', fixtureVersion: 'f' }];
const rate = (id: string, prices = [100, 900]): RoomRate => ({ roomRateId: id, hotelId: 'h', providerId: 'p', roomType: id, maxAdults: 2, maxChildren: 1, maxInfants: 1, infantCountsTowardOccupancy: { status: 'known', value: false }, nightlyPrices: prices.map((amountRial, i) => ({ date: '2026-10-' + (25 + i), total: { amountRial, currency: 'IRR' }, availableRooms: 2 })), terms: { breakfast: { status: 'unknown', reason: 'not supplied' }, refundable: { status: 'known', value: false }, cancellation: { status: 'unknown', reason: 'not supplied' }, fees: { status: 'complete' }, materialTerms: ['All known mandatory charges included in room-night total'] }, provenance });
const policy: HotelRoomPolicy = { revision: 'policy-v1', eachRoomRequiresAdult: true, childAgeRequired: true, maxChildAge: 11, checkInLocalTime: '14:00', earlyAccessPromised: false };
const context = { quoteId: 'q', observedAt: '2026-10-25T07:00:00Z', sourceRevision: 'hotel-v1', mappingRevision: 'm', fixtureVersion: 'f' };
describe('whole-party hotel allocation and complete stay authority', () => {
    it('rejects five adults requested in one cheap two-adult room', () => expect(allocateRooms({ ...query, party: { adults: 5, children: 0, infants: 0 } }, [rate('a')], { a: policy }).status).toBe('ineligible'));
    it('returns an exact eligible party and room allocation', () => {
        const r = allocateRooms(query, [rate('a')], { a: policy });
        expect(r.status).toBe('eligible');
        expect(r.allocations).toEqual([[{ roomNumber: 1, roomRateId: 'a', adults: 2, children: 0, infants: 0 }]]);
    });
    it('the cheaper first nightly amount need not be the cheaper whole-stay total', () => {
        const a = priceStay(query, [{ roomNumber: 1, roomRateId: 'a', adults: 2, children: 0, infants: 0 }], [rate('a')], { a: policy }, context);
        const b = priceStay(query, [{ roomNumber: 1, roomRateId: 'b', adults: 2, children: 0, infants: 0 }], [rate('b', [350, 350])], { b: policy }, context);
        expect(a.status).toBe('priced');
        expect(b.status).toBe('priced');
        if (a.status === 'priced' && b.status === 'priced') {
            expect(a.quote.total.amountRial).toBe(1000);
            expect(b.quote.total.amountRial).toBe(700);
        }
    });
    it('does not turn missing mandatory fees into a final quote', () => {
        const r = rate('a');
        r.terms.fees = { status: 'incomplete', missing: ['city-tax'] };
        expect(priceStay(query, [{ roomNumber: 1, roomRateId: 'a', adults: 2, children: 0, infants: 0 }], [r], { a: policy }, context).status).toBe('incomplete');
    });
    it('distance zero is a known zero, and the dateline uses the short arc', () => {
        expect(straightLineKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0 })).toBe(0);
        expect(straightLineKm({ latitude: 0, longitude: 179 }, { latitude: 0, longitude: -179 })).toBeCloseTo(222.39016, 3);
    });
    it('known stars sort descending and unknown stars remain last', () => {
        const hotel = (id: string, stars: number | null): Hotel => ({ hotelId: id, destinationCityId: 'city', name: id, point: { latitude: 0, longitude: 0 }, stars, address: 'fiction', provenance });
        const entries = [{ hotel: hotel('unknown', null), arrivalDistanceKm: null, locationDistanceKm: null }, { hotel: hotel('five', 5), arrivalDistanceKm: 0, locationDistanceKm: 0 }, { hotel: hotel('four', 4), arrivalDistanceKm: 1, locationDistanceKm: 1 }];
        expect(rankHotels(entries, 'stars').map(x => x.hotel.hotelId)).toEqual(['five', 'four', 'unknown']);
    });
    it('same local day round trip never invents a hotel night', () => {
        const segment = { segmentId: 's', mode: 'flight' as const, serviceId: 'svc', operatorId: 'op', originPlaceId: 'a', destinationPlaceId: 'b', departureAt: '2026-10-25T20:00:00Z', arrivalAt: '2026-10-25T23:30:00Z', departureTimeZone: 'UTC', arrivalTimeZone: 'Asia/Tehran' };
        const itinerary: Itinerary = { itineraryId: 'i', mode: 'flight', originPlaceId: 'a', destinationPlaceId: 'b', outbound: { segments: [segment], stops: [] }, return: { segments: [{ ...segment, segmentId: 'back', originPlaceId: 'b', destinationPlaceId: 'a', departureAt: '2026-10-26T15:00:00Z', arrivalAt: '2026-10-26T17:00:00Z' }], stops: [] } };
        const result = suggestHotelStay(itinerary, 'Asia/Tehran', '14:00');
        expect(result.checkIn).toBe('2026-10-26');
        expect(result.checkOut).toBe('2026-10-26');
        expect(result.needsCheckOut).toBe(true);
        expect(result.earlyArrival).toBe(true);
        expect(result.earlyAccessPromised).toBe(false);
    });
});
const room = (id = 'a', adults = 2, children = 0, infants = 0): RoomAllocation => ({ roomNumber: 1, roomRateId: id, adults, children, infants });
describe('bounded canonical allocation and authored policy edge cases', () => {
    it('allocates exact multi-room parties and child ages without duplicating travelers or room permutations', () => {
        const q = { ...query, rooms: 2, party: { adults: 3, children: 2, infants: 1, infantAgesMonths: [7] }, childAgesAtCheckIn: [3, 11] };
        const a = rate('a'), b = rate('b');
        const result = allocateRooms(q, [b, a], { a: policy, b: policy });
        expect(result.status).toBe('eligible');
        expect(result.allocations).toHaveLength(3);
        for (const rooms of result.allocations) {
            expect(allocationEligibility(q, rooms, [a, b], { a: policy, b: policy }).status).toBe('eligible');
            expect(rooms.flatMap(r => r.childAgesAtCheckIn ?? []).sort((a, b) => a - b)).toEqual([3, 11]);
            expect(rooms.flatMap(r => r.infantAgesMonths ?? [])).toEqual([7]);
        }
        expect(allocateRooms(q, [a, b], { a: policy, b: policy })).toEqual(result);
    });
    it('uses aggregate inventory for the same rate on every night', () => {
        const r = rate('a');
        r.nightlyPrices[1]!.availableRooms = 1;
        const q = { ...query, rooms: 2, party: { adults: 4, children: 0, infants: 0 } };
        expect(allocateRooms(q, [r], { a: policy }).status).toBe('ineligible');
        expect(priceStay(q, [room('a'), { ...room('a'), roomNumber: 2 }], [r], { a: policy }, context).status).toBe('ineligible');
    });
    it('prices every room for every requested night exactly once', () => {
        const q = { ...query, rooms: 2, party: { adults: 4, children: 0, infants: 0 } };
        const r = priceStay(q, [room(), { ...room(), roomNumber: 2 }], [rate('a')], { a: policy }, context);
        expect(r.status).toBe('priced');
        if (r.status === 'priced') {
            expect(r.quote.total.amountRial).toBe(2000);
            expect(r.quote.breakdown.map(l => l.amount.amountRial)).toEqual([1000, 1000]);
        }
    });
    it('rejects absent last-night inventory and treats duplicate records as unknown', () => {
        const r = rate('a');
        r.nightlyPrices.pop();
        expect(priceStay(query, [room()], [r], { a: policy }, context).status).toBe('ineligible');
        r.nightlyPrices.push(...rate('a').nightlyPrices);
        expect(priceStay(query, [room()], [r], { a: policy }, context).status).toBe('unknown');
    });
    it('requires explicit stay ages and never borrows transport party ages', () => {
        const q = { ...query, party: { adults: 2, children: 1, childAges: [8], infants: 0 } };
        expect(allocateRooms(q, [rate('a')], { a: policy }).status).toBe('unknown');
        expect(allocateRooms({ ...q, childAgesAtCheckIn: [12] }, [rate('a')], { a: policy }).status).toBe('ineligible');
        expect(allocateRooms({ ...q, childAgesAtCheckIn: [11] }, [rate('a')], { a: policy }).status).toBe('eligible');
    });
    it('keeps missing policy unknown without hiding independently impossible capacity or zero inventory', () => {
        expect(allocateRooms(query, [rate('a')], {}).status).toBe('unknown');
        expect(allocateRooms({ ...query, party: { adults: 5, children: 0, infants: 0 } }, [rate('a')], {}).status).toBe('ineligible');
        const r = rate('a');
        r.nightlyPrices[1]!.availableRooms = 0;
        expect(priceStay(query, [room()], [r], {}, context).status).toBe('ineligible');
    });
    it('distinguishes independent infant caps, unknown counting, and explicit combined occupancy', () => {
        const q = { ...query, party: { adults: 2, children: 0, infants: 1 } }, r = rate('a');
        expect(allocateRooms(q, [r], { a: policy }).status).toBe('eligible');
        r.infantCountsTowardOccupancy = { status: 'unknown', reason: 'unpublished' };
        expect(allocateRooms(q, [r], { a: policy }).status).toBe('unknown');
        r.infantCountsTowardOccupancy = { status: 'known', value: true };
        expect(allocateRooms(q, [r], { a: policy }).status).toBe('unknown');
        expect(allocateRooms(q, [r], { a: { ...policy, maxOccupants: 2 } }).status).toBe('ineligible');
        expect(allocateRooms(q, [r], { a: { ...policy, maxOccupants: 3 } }).status).toBe('eligible');
        r.maxInfants = 0;
        expect(allocateRooms(q, [r], { a: policy }).status).toBe('ineligible');
    });
    it('preserves all materially distinct rate combinations and proves minimum stay cost', () => {
        const q = { ...query, rooms: 2, party: { adults: 4, children: 0, infants: 0 } }, rates = [rate('expensive', [1, 999]), rate('cheap', [300, 300]), rate('mid', [200, 500])], policies = Object.fromEntries(rates.map(r => [r.roomRateId, policy]));
        const allocations = allocateRooms(q, rates, policies).allocations;
        expect(allocations).toHaveLength(6);
        const totals = allocations.map(a => priceStay(q, a, rates, policies, context)).map(r => r.status === 'priced' ? r.quote.total.amountRial : Infinity);
        expect(Math.min(...totals)).toBe(1200);
    });
    it('handles the nine-person bound without truncating feasible rate combinations', () => {
        const q = { ...query, rooms: 9, party: { adults: 9, children: 0, infants: 0 } }, r = rate('a');
        r.nightlyPrices.forEach(n => n.availableRooms = 9);
        const result = allocateRooms(q, [r], { a: policy });
        expect(result.allocations).toHaveLength(1);
        expect(result.allocations[0]).toHaveLength(9);
    });
    it('never mixes hotel/provider inventory to rescue an impossible stay', () => {
        const q = { ...query, rooms: 2, party: { adults: 4, children: 0, infants: 0 } }, a = rate('a'), b = { ...rate('b'), providerId: 'other' };
        a.nightlyPrices.forEach(n => n.availableRooms = 1);
        b.nightlyPrices.forEach(n => n.availableRooms = 1);
        expect(allocateRooms(q, [a, b], { a: policy, b: policy }).status).toBe('ineligible');
        expect(priceStay(q, [room(), { ...room('b'), roomNumber: 2 }], [a, b], { a: policy, b: policy }, context).status).toBe('ineligible');
    });
    it('fails closed for invalid allocation numbers and ambiguous rate identity', () => {
        expect(priceStay(query, [{ ...room(), children: -1 }], [rate('a')], { a: policy }, context).status).toBe('ineligible');
        expect(priceStay(query, [room()], [rate('a'), rate('a')], { a: policy }, context).status).toBe('unknown');
    });
    it('reports only a known subtotal for incomplete charges, never an actionable quote', () => {
        const r = rate('a');
        r.terms.fees = { status: 'incomplete', missing: ['mandatory-tax'] };
        expect(priceStay(query, [room()], [r], { a: policy }, context)).toEqual({ status: 'incomplete', reasons: ['mandatory-tax'], knownSubtotal: { amountRial: 1000, currency: 'IRR' } });
    });
    it('preserves mixed per-room terms and uses conservative aggregate promises', () => {
        const q = { ...query, rooms: 2, party: { adults: 4, children: 0, infants: 0 } }, a = rate('a'), b = rate('b');
        a.terms.breakfast = { status: 'known', value: true };
        a.terms.refundable = { status: 'known', value: true };
        a.terms.cancellation = { status: 'known', policyCode: 'flex' };
        b.terms.breakfast = { status: 'known', value: false };
        b.terms.refundable = { status: 'unknown', reason: 'unpublished' };
        const result = priceStay(q, [room(), { ...room('b'), roomNumber: 2 }], [a, b], { a: policy, b: policy }, context);
        expect(result.status).toBe('priced');
        if (result.status === 'priced') {
            expect(result.quote.terms.breakfast).toEqual({ status: 'known', value: false });
            expect(result.quote.terms.refundable.status).toBe('unknown');
            expect(result.quote.terms.cancellation.status).toBe('unknown');
            expect(result.quote.roomDetails?.map(d => d.terms)).toEqual([a.terms, b.terms]);
            expect(Date.parse(result.quote.expiresAt) - Date.parse(result.quote.observedAt)).toBe(600000);
        }
    });
    it('refuses integer-rial overflow across both nights and rooms', () => {
        const r = rate('a', [Number.MAX_SAFE_INTEGER, 1]);
        expect(() => priceStay(query, [room()], [r], { a: policy }, context)).toThrow(RangeError);
        const q = { ...query, rooms: 2, party: { adults: 4, children: 0, infants: 0 } }, b = rate('b', [Number.MAX_SAFE_INTEGER - 1, 0]);
        expect(() => priceStay(q, [room('b'), { ...room('b'), roomNumber: 2 }], [b], { b: policy }, context)).toThrow(RangeError);
    });
    it('prices the final available night119 with checkout at day120', () => {
        const r = rate('a');
        r.nightlyPrices = [{ date: '2027-02-22', total: { amountRial: 321, currency: 'IRR' }, availableRooms: 1 }];
        const q = { ...query, checkIn: '2027-02-22', checkOut: '2027-02-23' };
        const result = priceStay(q, [room()], [r], { a: policy }, context);
        expect(result.status).toBe('priced');
        if (result.status === 'priced')
            expect(result.quote.total.amountRial).toBe(321);
    });
    it('validates quote breakdown and exact per-room detail linkage', () => {
        const r = priceStay(query, [room()], [rate('a')], { a: policy }, context);
        if (r.status !== 'priced')
            throw Error('expected price');
        expect(HotelQuoteSnapshotSchema.safeParse({ ...r.quote, total: { amountRial: 1, currency: 'IRR' } }).success).toBe(false);
        expect(HotelQuoteSnapshotSchema.safeParse({ ...r.quote, roomDetails: [{ ...r.quote.roomDetails![0], roomRateId: 'other' }] }).success).toBe(false);
    });
});
describe('hotel ranking and independent stay suggestions', () => {
    const hotel = (id: string, stars: number | null): Hotel => ({ hotelId: id, destinationCityId: 'city', name: id, point: { latitude: 0, longitude: 0 }, stars, address: 'fiction', provenance });
    const priced = priceStay(query, [room()], [rate('a')], { a: policy }, context);
    if (priced.status !== 'priced')
        throw Error('expected price');
    const entry = (id: string, total: number | null, stars: number | null = 3, km: number | null = 1) => ({ hotel: hotel(id, stars), quote: total === null ? undefined : { ...priced.quote, hotelId: id, total: { amountRial: total, currency: 'IRR' as const } }, arrivalDistanceKm: km, locationDistanceKm: km });
    it('puts complete actionable stays ahead of unpriced five-star diagnostics and breaks ties by hotelID', () => {
        const input = [entry('unpriced', null, 5, 0), entry('b', 100, 3), entry('a', 100, 3), entry('c', 99, null)];
        expect(rankHotels(input, 'cheapest').map(e => e.hotel.hotelId)).toEqual(['c', 'a', 'b', 'unpriced']);
        expect(rankHotels(input, 'stars').map(e => e.hotel.hotelId)).toEqual(['a', 'b', 'c', 'unpriced']);
        expect(input[0]!.hotel.hotelId).toBe('unpriced');
    });
    it('uses unrounded distance then whole stay total, retaining known zero and unknown last', () => {
        const input = [entry('unknown', 1, 3, null), entry('close', 100, 3, 0.0001), entry('zero', 200, 3, 0), entry('near', 99, 3, 0.0002)];
        for (const sort of ['arrival-distance', 'location-distance'] as const)
            expect(rankHotels(input, sort).map(e => e.hotel.hotelId)).toEqual(['zero', 'close', 'near', 'unknown']);
    });
    it('handles high latitudes and rejects invalid coordinates instead of inventing zero', () => {
        expect(straightLineKm({ latitude: 89, longitude: 0 }, { latitude: 89, longitude: 180 })).toBeCloseTo(222.39016, 3);
        expect(() => straightLineKm({ latitude: NaN, longitude: 0 }, { latitude: 0, longitude: 0 })).toThrow();
    });
    it('one-way or unchosen itineraries never invent checkout, checkin or early access', () => {
        expect(suggestHotelStay(undefined, 'Asia/Tehran')).toEqual({ checkIn: undefined, checkOut: undefined, arrivalPlaceId: undefined, needsArrivalConfirmation: true, needsCheckOut: true, earlyArrival: false, earlyAccessPromised: false });
        const segment = { segmentId: 's', mode: 'flight' as const, serviceId: 'svc', operatorId: 'op', originPlaceId: 'a', destinationPlaceId: 'b', departureAt: '2026-10-25T20:00:00Z', arrivalAt: '2026-10-25T23:30:00Z', departureTimeZone: 'UTC', arrivalTimeZone: 'UTC' };
        const result = suggestHotelStay({ itineraryId: 'i', mode: 'flight', originPlaceId: 'a', destinationPlaceId: 'b', outbound: { segments: [segment], stops: [] } }, 'Asia/Tehran', '14:00');
        expect(result.checkIn).toBe('2026-10-26');
        expect(result.checkOut).toBeUndefined();
        expect(result.needsCheckOut).toBe(true);
        expect(result.earlyArrival).toBe(true);
    });
});
it('cannot price fabricated allocated child ages when the stay query omitted them', () => {
    const q = { ...query, party: { adults: 2, children: 1, childAges: [8], infants: 0 } };
    expect(priceStay(q, [{ ...room('a', 2, 1), childAgesAtCheckIn: [8] }], [rate('a')], { a: policy }, context).status).toBe('unknown');
});
