import { describe, it, expect } from 'vitest';
import { materializeStoredHotelRate } from './hotel-source';
const raw = { roomRateId: 'r', hotelId: 'h', providerId: 'p', roomType: 'double', maxAdults: 2, maxChildren: 1, maxInfants: 1, infantCountsTowardOccupancy: { status: 'known', value: false }, terms: { breakfast: { status: 'unknown', reason: 'unpublished' }, refundable: { status: 'known', value: false }, cancellation: { status: 'unknown', reason: 'unpublished' }, fees: { status: 'complete' }, materialTerms: ['All known mandatory charges included in room-night total'] }, provenance: [{ rawRecordId: 'r', sourceNamespace: 'constructed-test', sourceValue: 'fiction', sourceRevision: 'h-v1', mappingRevision: 'm', fixtureVersion: 'f' }], nightlyTemplate: [{ offset: 119, amountRial: 321, availableRooms: 1 }], policy: { eachRoomRequiresAdult: true, childAgeRequired: true, maxChildAge: 11, checkInLocalTime: '14:00', earlyAccessPromised: false } };
describe('private stored hotel template authority', () => {
    it('decodes the actual stored policy and destination-local relative-night source', () => {
        const source = materializeStoredHotelRate(raw, '2026-10-25T23:00:00Z', 'Asia/Tehran');
        expect(source.rate.nightlyPrices).toEqual([{ date: '2027-02-22', total: { amountRial: 321, currency: 'IRR' }, availableRooms: 1 }]);
        expect(source.policy).toEqual({ ...raw.policy, revision: 'hotel-policy-v1' });
        expect(source.policy.maxOccupants).toBeUndefined();
        expect(source.rate.provenance).toEqual(raw.provenance);
    });
    it('fails closed on missing policy without importing a fallback', () => expect(() => materializeStoredHotelRate({ ...raw, policy: undefined }, '2026-10-25T00:00:00Z', 'UTC')).toThrow());
    it('rejects out-of-coverage offsets and malformed money or inventory', () => {
        for (const nightlyTemplate of [[{ offset: 120, amountRial: 1, availableRooms: 1 }], [{ offset: 0, amountRial: -1, availableRooms: 1 }], [{ offset: 0, amountRial: 1, availableRooms: 0.5 }]])
            expect(() => materializeStoredHotelRate({ ...raw, nightlyTemplate }, '2026-10-25T00:00:00Z', 'UTC')).toThrow();
    });
});
