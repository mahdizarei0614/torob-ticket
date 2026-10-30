import {expect, it, vi} from 'vitest';
import {hotelFingerprint, type HotelSource} from './hotel-repository';

// The digest is pure. Avoid loading a generated DB client through the unrelated
// session default while the PostgreSQL authority path is tested separately.
vi.mock('./prisma', () => ({FOUNDATION_IDENTITY: {fixtureVersion: 'foundation-v1', catalogRevision: 'foundation-catalog-v1'}}));

const legacy: HotelSource = {
    timeZone: 'Asia/Tehran',
    frozen: {
        info: {fixtureVersion: 'showcase-v3', catalogRevision: 'catalog-v3', seed: 8181, anchorInstant: '2026-10-29T00:00:00.000Z', scenario: 'normal', scenarioRevision: 'scenario-normal-v1', mappingRevision: 'mapping-v1', expiresAt: '2026-10-30T23:00:00.000Z', identity: null},
        mappings: [{}], overrides: [],
    },
    hotels: [], templates: [], rates: [], policies: {}, issues: {},
    engineRevision: 'hotel-engine-v1', policyRevision: 'hotel-policy-v1',
};

it('preserves the exact pre-directory fingerprint for a recorded legacy source', () => {
    // Captured using the old canonical authority shape, without a sourceRevision.
    expect(hotelFingerprint(legacy)).toBe('d2e482005815e39c62b185dc6d485ed25ae960185beab3f48d155313380a776d');
    expect(hotelFingerprint({...legacy, sourceRevision: undefined})).toBe(hotelFingerprint(legacy));
});

it('binds an explicit directory revision while retaining fresh mapping and scenario authority', () => {
    const modern = {...legacy, sourceRevision: 'hotel-directory-osm-2026-10-30'};
    expect(hotelFingerprint(modern)).not.toBe(hotelFingerprint(legacy));
    expect(hotelFingerprint({...modern, sourceRevision: 'next-directory'})).not.toBe(hotelFingerprint(modern));
    expect(hotelFingerprint({...modern, frozen: {...modern.frozen, mappings: [{sourceAuthorityChanged: true}]}})).not.toBe(hotelFingerprint(modern));
    expect(hotelFingerprint({...modern, frozen: {...modern.frozen, info: {...modern.frozen.info, scenarioRevision: 'next-scenario'}}})).not.toBe(hotelFingerprint(modern));
});
