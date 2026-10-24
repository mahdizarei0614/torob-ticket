import { describe, expect, it } from 'vitest';
import * as contracts from './index';
import { validSearchInput } from './test-inputs';

// The initial empty barrel must fail by naming the missing contract, not by
// failing module resolution. These assertions then exercise each real schema.
type RuntimeSchema = { safeParse(input: unknown): { success: boolean; data?: unknown } };
function schema(name: string): RuntimeSchema {
  const value = (contracts as Record<string, unknown>)[name];
  expect(value, `${name} must be exported`).toBeDefined();
  return value as RuntimeSchema;
}
const accepts = (name: string, input: unknown) => schema(name).safeParse(input).success;
const instant = '2026-10-24T08:00:00.000Z';
const coverage = { expectedProviderIds: ['p1'], successfulProviderIds: ['p1'], failedProviderIds: [], pendingProviderIds: [], complete: true };
const provenance = { rawRecordId: 'raw1', sourceNamespace: 'demo:p1', sourceValue: { amount: '10', unit: 'TOMAN', tax: null }, sourceRevision: 's1', mappingRevision: 'm1', fixtureVersion: 'f1' };
const snapshot = { searchId: 'search1', clientGeneration: 'g1', query: validSearchInput(), status: 'complete', groups: [], providerStatuses: [], coverage, observedAt: instant };

describe('checked wire primitives', () => {
  it.each([0, 1, Number.MAX_SAFE_INTEGER])('accepts integer rials %s', amountRial => {
    expect(accepts('MoneySchema', { amountRial, currency: 'IRR' })).toBe(true);
  });
  it.each([1.5, -1, Number.MAX_SAFE_INTEGER + 1, Infinity, NaN, '1'])('rejects unsafe money %s', amountRial => {
    expect(accepts('MoneySchema', { amountRial, currency: 'IRR' })).toBe(false);
  });
  it.each(['2026-02-29', '2026-04-31', '2024-13-01', '2026-1-02', '2026-10-24T00:00:00Z'])('rejects nonexistent/non-wire date %s', date => {
    expect(accepts('LocalDateSchema', date)).toBe(false);
  });
  it('accepts leap days and requires UTC instants', () => {
    expect(accepts('LocalDateSchema', '2024-02-29')).toBe(true);
    expect(accepts('ISOInstantSchema', instant)).toBe(true);
    expect(accepts('ISOInstantSchema', '2026-02-30T08:00:00Z')).toBe(false);
    expect(accepts('ISOInstantSchema', '2026-10-24T08:00:00+03:30')).toBe(false);
  });
  it.each([{ latitude: 91, longitude: 0 }, { latitude: 0, longitude: -181 }, { latitude: '1', longitude: 0 }])('rejects invalid coordinates %j', point => {
    expect(accepts('GeoPointSchema', point)).toBe(false);
  });
  it.each([
    { adults: 0, children: 1, infants: 0 }, { adults: 1, children: 9, infants: 0 },
    { adults: 1, children: 0, infants: 2 }, { adults: 1.5, children: 0, infants: 0 },
    { adults: 1, children: 1, infants: 0, childAges: [] },
    { adults: 1, children: 0, infants: 1, infantAgesMonths: [-1] },
  ])('rejects invalid party %j', party => expect(accepts('PartySchema', party)).toBe(false));
});

describe('search commands', () => {
  it('accepts one-way and same-day round-trip dates without inventing timing rules', () => {
    expect(accepts('TransportSearchQuerySchema', validSearchInput())).toBe(true);
    expect(accepts('TransportSearchQuerySchema', { ...validSearchInput(), tripType: 'round-trip', returnDate: '2026-10-24' })).toBe(true);
  });
  it.each([
    { tripType: 'round-trip' }, { tripType: 'round-trip', returnDate: '2026-10-23' },
    { returnDate: '2026-10-25' }, { mode: 'boat' }, { departureDate: 20261024 },
    { destinationCityId: 'tehran' }, { sessionId: 'another-reviewer' },
    { party: { adults: 1, children: 0, infants: 0, sessionId: 'other' } },
    { filters: { budgetMaxRial: 0.5 } }, { filters: { maxStopsOrTransfers: -1 } },
    { filters: { departureWindow: { startMinute: 1440, endMinute: 60 } } },
  ])('rejects invalid/unknown command fields %j', patch => {
    expect(accepts('TransportSearchQuerySchema', { ...validSearchInput(), ...patch })).toBe(false);
  });
  it('normalizes absent and empty restrictions identically and allows midnight-crossing windows', () => {
    const a = schema('EligibilityFiltersSchema').safeParse({});
    const b = schema('EligibilityFiltersSchema').safeParse({ providerIds: [], operatorIds: [] });
    expect(a.success).toBe(true); expect(b.data).toEqual(a.data);
    expect(accepts('EligibilityFiltersSchema', { departureWindow: { startMinute: 1380, endMinute: 120 } })).toBe(true);
  });
  it('accepts only explicit supersession and an atomic nonnegative recovery cursor', () => {
    expect(accepts('SearchRequestSchema', { query: validSearchInput(), clientGeneration: 'g', supersedesSearchId: 'previous' })).toBe(true);
    expect(accepts('SearchRequestSchema', { query: validSearchInput(), clientGeneration: 'g', supersedesSearchId: '' })).toBe(false);
    expect(accepts('SearchRecoverySchema', { snapshot, sequence: 0 })).toBe(true);
    expect(accepts('SearchRecoverySchema', { snapshot, sequence: -1 })).toBe(false);
    expect(accepts('SearchRecoverySchema', { snapshot, sequence: 1.5 })).toBe(false);
    expect(accepts('SearchRecoverySchema', { snapshot })).toBe(false);
  });
  it('requires a generation and rejects a session selector', () => {
    expect(accepts('SearchRequestSchema', { query: validSearchInput(), clientGeneration: 'g1' })).toBe(true);
    expect(accepts('SearchRequestSchema', { query: validSearchInput(), clientGeneration: '', sessionId: 'other' })).toBe(false);
  });
});

describe('event, price, and evidence unions', () => {
  it('couples event discriminants to their payload and terminal status', () => {
    const base = { searchId: 'search1', sequence: 1, clientGeneration: 'g1' };
    const status = { providerId: 'p1', status: 'complete', offerCount: 0 };
    expect(accepts('SearchEventSchema', { ...base, type: 'provider-status', payload: status })).toBe(true);
    expect(accepts('SearchEventSchema', { ...base, type: 'snapshot', payload: snapshot })).toBe(true);
    expect(accepts('SearchEventSchema', { ...base, type: 'terminal', payload: snapshot })).toBe(true);
    expect(accepts('SearchEventSchema', { ...base, type: 'provider-status', payload: snapshot })).toBe(false);
    expect(accepts('SearchEventSchema', { ...base, type: 'snapshot', payload: status })).toBe(false);
    expect(accepts('SearchEventSchema', { ...base, type: 'snapshot', payload: { ...snapshot, clientGeneration: 'other-generation' } })).toBe(false);
    expect(accepts('SearchEventSchema', { ...base, type: 'snapshot', payload: { ...snapshot, searchId: 'other-search' } })).toBe(false);
    expect(accepts('SearchEventSchema', { ...base, type: 'terminal', payload: { ...snapshot, status: 'collecting' } })).toBe(false);
    expect(accepts('SearchEventSchema', { ...base, sequence: 1.5, type: 'snapshot', payload: snapshot })).toBe(false);
  });
  it('represents missing price distinctly and requires evidence for priced cells', () => {
    const base = { date: '2026-10-24' };
    expect(accepts('DatePriceCellSchema', { ...base, status: 'checking' })).toBe(true);
    expect(accepts('DatePriceCellSchema', { ...base, status: 'invalid-date-pair', reason: 'return-before-departure' })).toBe(true);
    expect(accepts('DatePriceCellSchema', { ...base, status: 'invalid-date-pair', reason: 'retry' })).toBe(false);
    expect(accepts('DatePriceCellSchema', { ...base, status: 'unavailable', reason: 'incomplete-price', retryable: false, coverage })).toBe(true);
    expect(accepts('DatePriceCellSchema', { ...base, status: 'priced', minimum: { amountRial: 100, currency: 'IRR' }, quoteIds: ['q1'], offerIds: ['o1'], coverage, observedAt: instant })).toBe(true);
    expect(accepts('DatePriceCellSchema', { ...base, status: 'priced', minimum: null })).toBe(false);
    expect(accepts('DatePriceCellSchema', { ...base, status: 'no-match', coverage: { ...coverage, complete: false } })).toBe(false);
    expect(accepts('DatePriceCellSchema', { ...base, status: 'no-match', coverage: { ...coverage, expectedProviderIds: ['p1', 'p2'] } })).toBe(false);
  });
  it('keeps source unknown fields and explicit unknown conditions', () => {
    const raw = { rawRecordId: 'raw1', providerId: 'p1', observedAt: instant, sourceNamespace: 'demo:p1', payload: { alienField: { tax: null } }, fixtureVersion: 'f1' };
    expect(schema('RawProviderRecordSchema').safeParse(raw).data).toEqual(raw);
    const parsed = schema('ProvenanceSchema').safeParse(provenance);
    expect(parsed.data).toEqual(provenance);
    expect(accepts('KnownBooleanSchema', { status: 'unknown', reason: 'not-supplied' })).toBe(true);
    expect(accepts('KnownBooleanSchema', { status: 'unknown', value: true })).toBe(false);
  });
});

describe('hotel, referral, and administrative commands', () => {
  const hotel = { destinationCityId: 'mashhad', checkIn: '2026-10-24', checkOut: '2026-10-25', party: { adults: 1, children: 0, infants: 0 }, rooms: 1, sort: 'cheapest' };
  it('requires a positive stay, occupied-room adults, and a distance reference', () => {
    expect(accepts('HotelSearchQuerySchema', hotel)).toBe(true);
    for (const patch of [{ checkOut: hotel.checkIn }, { rooms: 2 }, { sort: 'location-distance' }, { sort: 'arrival-distance' }]) {
      expect(accepts('HotelSearchQuerySchema', { ...hotel, ...patch })).toBe(false);
    }
    expect(accepts('HotelSearchQuerySchema', { ...hotel, party: { adults: 1, children: 1, infants: 0 } })).toBe(true);
    expect(accepts('HotelSearchQuerySchema', { ...hotel, party: { adults: 1, children: 1, infants: 0 }, childAgesAtCheckIn: [7] })).toBe(true);
    expect(accepts('HotelSearchQuerySchema', { ...hotel, party: { adults: 1, children: 1, infants: 0 }, childAgesAtCheckIn: [] })).toBe(false);
  });
  it('requires positive quote versions and an explicit confirmation key', () => {
    expect(accepts('ReferralSelectionSchema', { kind: 'transport', quoteId: 'q1', quoteVersion: 1 })).toBe(true);
    expect(accepts('ReferralSelectionSchema', { kind: 'hotel', quoteId: 'q1', quoteVersion: 0 })).toBe(false);
    expect(accepts('ConfirmReferralInputSchema', { intentId: 'i1', acceptedQuoteVersion: 1, idempotencyKey: 'k1' })).toBe(true);
    expect(accepts('ConfirmReferralInputSchema', { intentId: 'i1', acceptedQuoteVersion: 1, idempotencyKey: 'k1', sessionId: 'other' })).toBe(false);
  });
  it('accepts reproducible session inputs but rejects unknown scenarios and selectors', () => {
    expect(accepts('CreateDemoSessionInputSchema', { seed: 42, anchorInstant: instant, scenario: 'price-change' })).toBe(true);
    for (const input of [{ seed: -1 }, { seed: 1.5 }, { scenario: 'live' }, { sessionId: 'other' }, { anchorInstant: 'tomorrow' }]) {
      expect(accepts('CreateDemoSessionInputSchema', input)).toBe(false);
    }
  });
  it('scopes mappings to entity and source and rejects behavior-changing extra fields', () => {
    const patch = { entityType: 'city', sourceNamespace: 'demo:p1', sourceValue: 'تهران', targetId: 'tehran', baseRevision: 'm1' };
    expect(accepts('MappingPatchSchema', patch)).toBe(true);
    expect(schema('MappingPatchSchema').safeParse({ ...patch, sourceValue: '  تهران  ' }).data).toEqual({ ...patch, sourceValue: '  تهران  ' });
    expect(accepts('MappingPatchSchema', { ...patch, entityType: 'anything' })).toBe(false);
    expect(accepts('MappingPatchSchema', { ...patch, sessionId: 'other' })).toBe(false);
    expect(accepts('ProviderOverridePatchSchema', { paused: true, latencyMs: -1 })).toBe(false);
  });
});

describe('complete public evidence vocabulary', () => {
  const unknown = { status: 'unknown', reason: 'not-supplied' };
  const money = { amountRial: 1000, currency: 'IRR' };
  const breakdown = [{ code: 'base', amount: money, mandatory: true }];
  const complete = { status: 'complete' };
  const eligible = { status: 'eligible' };
  const legTerms = { classCode: 'economy', checkedBaggageKg: unknown, cabinBaggageKg: unknown, refundable: unknown, cancellation: unknown, seatOrBerth: unknown, materialTerms: [] };
  const terms = { outbound: legTerms };
  const segment = { segmentId: 'sg1', mode: 'flight', serviceId: 'service1', operatorId: 'op1', originPlaceId: 'thr', destinationPlaceId: 'mhd', departureAt: instant, arrivalAt: '2026-10-24T09:30:00Z', departureTimeZone: 'Asia/Tehran', arrivalTimeZone: 'Asia/Tehran' };
  const leg = { segments: [segment], stops: [{ placeId: 'mhd', kind: 'technical-stop', waitMinutes: 5, vehicleChange: false }] };
  const itinerary = { itineraryId: 'it1', mode: 'flight', originPlaceId: 'thr', destinationPlaceId: 'mhd', outbound: leg };
  const offer = { offerId: 'o1', providerId: 'p1', fareId: 'fare1', itinerary, conditions: terms, total: money, breakdown, completeness: complete, eligibility: eligible, availability: unknown, observedAt: instant, provenance: [provenance], issues: [] };
  const quote = { quoteId: 'q1', version: 1, itineraryId: 'it1', fareId: 'fare1', providerId: 'p1', party: validSearchInput().party, total: money, breakdown, completeness: complete, eligibility: eligible, conditions: terms, observedAt: instant, expiresAt: '2026-10-24T08:10:00Z', sourceRevision: 's1', mappingRevision: 'm1', fixtureVersion: 'f1', provenance: [provenance] };
  const group = { groupId: 'group1', itinerary, eligibleQuotes: [quote], incompletePriceOffers: [], representativeQuoteId: 'q1', durationMinutes: 90, connectionCount: 0 };
  const hotelQuery = { destinationCityId: 'mashhad', checkIn: '2026-10-24', checkOut: '2026-10-25', party: validSearchInput().party, rooms: 1, sort: 'cheapest' };
  const hotelTerms = { breakfast: unknown, refundable: unknown, cancellation: unknown, fees: complete, materialTerms: [] };
  const allocation = { roomNumber: 1, roomRateId: 'rate1', adults: 1, children: 0, infants: 0, childAgesAtCheckIn: [], infantAgesMonths: [] };
  const hotelQuote = { quoteId: 'hq1', version: 1, hotelId: 'hotel1', providerId: 'p1', query: hotelQuery, roomAllocation: [allocation], total: money, breakdown, completeness: complete, eligibility: eligible, terms: hotelTerms, observedAt: instant, expiresAt: '2026-10-24T08:10:00Z', sourceRevision: 's1', mappingRevision: 'm1', fixtureVersion: 'f1', provenance: [provenance] };
  const transportPayload = { kind: 'transport', quote, itinerary };
  const selection = { kind: 'transport', quoteId: 'q1', quoteVersion: 1 };
  const intent = { intentId: 'intent1', selection, quote: transportPayload, createdAt: instant, expiresAt: '2026-10-24T08:02:00Z' };
  const trace = { traceId: 'trace1', rawRecordId: 'raw1', mappingRevision: 'm1', outcome: 'accepted', offerId: 'o1', decisions: [{ fieldPath: ['total'], ruleCode: 'toman-to-rial', sourceValue: { amount: '100', extra: true }, normalizedValue: money }], issues: [], observedAt: instant };
  const hotel = { hotelId: 'hotel1', destinationCityId: 'mashhad', name: 'Demo hotel', point: { latitude: 36.3, longitude: 59.6 }, stars: null, address: 'Demo address', provenance: [provenance] };
  const identity = { identityId: 'identity1', displayName: 'Demo reviewer', simulated: true };
  const patch = { entityType: 'city', sourceNamespace: 'demo:p1', sourceValue: 'تهران', targetId: 'tehran', baseRevision: 'm1' };

  it.each([
    ['PlaceSchema', { id: 'thr', cityId: 'tehran', name: 'Demo airport', kind: 'airport', code: 'THR', point: { latitude: 35.7, longitude: 51.4 }, timeZone: 'Asia/Tehran' }],
    ['SegmentSchema', segment], ['JourneyLegSchema', leg], ['ItinerarySchema', itinerary], ['FareConditionsSchema', terms],
    ['NormalizedOfferSchema', offer], ['QuoteSnapshotSchema', quote], ['ComparisonGroupSchema', group],
    ['ExplanationSchema', { reasonCode: 'price-difference', facts: { amountRial: 100, percentage: 10 }, baselineIds: ['q1'], coverage }],
    ['SuggestionSchema', { kind: 'nearby-date', alternativeId: 'date1', baselineId: 'q1', delta: { amountRial: -2000000, minutes: 0, priceRatio: -0.1 }, coverage, dismissalScope: { searchId: 's1' } }],
    ['DatePriceQuerySchema', { query: validSearchInput(), leg: 'outbound', dates: ['2026-10-24'], clientGeneration: 'g1' }],
    ['DatePriceSnapshotSchema', { datePriceId: 'dp1', clientGeneration: 'g1', query: { query: validSearchInput(), leg: 'outbound', dates: ['2026-10-24'], clientGeneration: 'g1' }, cells: [{ date: '2026-10-24', status: 'checking' }], status: 'checking', pollCursor: '1', observedAt: instant }],
    ['HotelSchema', hotel], ['RoomAllocationSchema', allocation],
    ['RoomRateSchema', { roomRateId: 'rate1', hotelId: 'hotel1', providerId: 'p1', roomType: 'double', maxAdults: 2, maxChildren: 1, maxInfants: 1, infantCountsTowardOccupancy: unknown, nightlyPrices: [{ date: '2026-10-24', total: money, availableRooms: 1 }], terms: hotelTerms, provenance: [provenance] }],
    ['HotelQuoteSnapshotSchema', hotelQuote], ['HotelSearchSnapshotSchema', { hotelSearchId: 'hs1', query: hotelQuery, status: 'complete', hotels: [hotel], quotes: [hotelQuote], observedAt: instant }],
    ['ReferralIntentSchema', intent], ['RecheckResultSchema', { status: 'changed', intent, previousQuoteVersion: 1, materialChanges: ['total'] }],
    ['ReferralReceiptSchema', { referralId: 'r1', intentId: 'intent1', selection, payload: transportPayload, confirmedAt: instant, handoffPath: '/provider-demo/r1' }],
    ['SessionInfoSchema', { seed: 42, anchorInstant: instant, scenario: 'normal', fixtureVersion: 'f1', catalogRevision: 'c1', mappingRevision: 'm1', scenarioRevision: 'sc1', expiresAt: '2026-10-25T08:00:00Z', identity }],
    ['NormalizationTraceSchema', trace], ['MappingPreviewSchema', { patch, valid: true, collisions: [], affectedRawRecordIds: ['raw1'], affectedSearchIds: ['s1'], issues: [] }],
    ['AdminSearchDetailSchema', { snapshot: { ...snapshot, groups: [group] }, providerRuns: [], rawRecords: [], normalizationTraces: [trace] }],
    ['ReferralMetricsSchema', { prepared: 0, changed: 0, unavailable: 0, confirmed: 0, byProvider: [] }],
    ['DemoIdentitySchema', identity], ['SaveSearchInputSchema', { name: 'Trip', query: validSearchInput() }],
    ['SavedSearchSchema', { savedSearchId: 'saved1', identityId: 'identity1', name: 'Trip', query: validSearchInput(), createdAt: instant }],
    ['ProviderCapabilitiesSchema', { providerId: 'p1', name: 'Demo One', fictional: true, modes: ['flight'], scopes: ['domestic'], classCodes: ['economy'], requiresChildAges: false, requiresInfantAges: false }],
    ['CatalogSnapshotSchema', { fixtureVersion: 'f1', catalogRevision: 'c1', cities: [{ id: 'tehran', name: 'Tehran', countryCode: 'IR', point: { latitude: 35.7, longitude: 51.4 }, timeZone: 'Asia/Tehran' }], places: [], supportedConnections: [{ mode: 'flight', scope: 'domestic', originCityId: 'tehran', destinationCityId: 'mashhad' }], classChoices: [{ code: 'economy', mode: 'flight', name: 'Economy' }], providerCapabilities: [] }],
  ])('accepts complete %s wire evidence', (name, input) => expect(accepts(name as string, input)).toBe(true));

  it('rejects incomplete and ineligible representative quotes', () => {
    expect(accepts('ComparisonGroupSchema', { ...group, eligibleQuotes: [{ ...quote, completeness: { status: 'incomplete', missing: ['tax'] } }] })).toBe(false);
    expect(accepts('ComparisonGroupSchema', { ...group, eligibleQuotes: [{ ...quote, eligibility: { status: 'unknown', reasons: ['baggage'] } }] })).toBe(false);
  });
  it('allows completely unknown source prices as incomplete offers', () => {
    expect(accepts('NormalizedOfferSchema', { ...offer, total: undefined, breakdown: [], completeness: { status: 'incomplete', missing: ['base', 'tax'] } })).toBe(true);
    expect(accepts('NormalizedOfferSchema', { ...offer, total: undefined })).toBe(false);
  });
  it('rejects reversed instants, bad zones, expired quotes, and unsafe public counts', () => {
    expect(accepts('SegmentSchema', { ...segment, arrivalAt: '2026-10-24T07:00:00Z' })).toBe(false);
    expect(accepts('SegmentSchema', { ...segment, arrivalAt: '2026-10-24T08:00:00Z' })).toBe(false);
    expect(accepts('SegmentSchema', { ...segment, arrivalTimeZone: 'Not/AZone' })).toBe(false);
    expect(accepts('SegmentSchema', { ...segment, arrivalTimeZone: '+03:30' })).toBe(false);
    expect(accepts('QuoteSnapshotSchema', { ...quote, expiresAt: instant })).toBe(false);
    expect(accepts('HotelQuoteSnapshotSchema', { ...hotelQuote, version: 0 })).toBe(false);
    expect(accepts('RoomAllocationSchema', { ...allocation, adults: 0 })).toBe(false);
    expect(accepts('ReferralMetricsSchema', { prepared: -1, changed: 0, unavailable: 0, confirmed: 0, byProvider: [] })).toBe(false);
    expect(accepts('DemoIdentitySchema', { ...identity, simulated: false })).toBe(false);
    expect(accepts('SaveSearchInputSchema', { name: 'Trip', query: validSearchInput(), identityId: 'other' })).toBe(false);
    expect(accepts('ReferralReceiptSchema', { referralId: 'r1', intentId: 'intent1', selection, payload: transportPayload, confirmedAt: instant, handoffPath: 'https://external.example' })).toBe(false);
  });
  it('allocates infants by count without requiring unknown ages', () => {
    expect(accepts('RoomAllocationSchema', { roomNumber: 1, roomRateId: 'rate1', adults: 1, children: 1, infants: 1 })).toBe(true);
    expect(accepts('RoomAllocationSchema', { roomNumber: 1, roomRateId: 'rate1', adults: 1, children: 0, infants: 2 })).toBe(true);
    expect(accepts('RoomAllocationSchema', { ...allocation, children: 1, childAgesAtCheckIn: [] })).toBe(false);
  });
  it('retains per-leg fare differences and normalization source evidence', () => {
    expect(schema('FareConditionsSchema').safeParse({ outbound: legTerms, return: { ...legTerms, refundable: { status: 'known', value: false } } }).data).toEqual({ outbound: legTerms, return: { ...legTerms, refundable: { status: 'known', value: false } } });
    expect(schema('NormalizationTraceSchema').safeParse(trace).data).toEqual(trace);
  });
});


describe('session anchor storage precision', () => {
  it.each(['2026-10-24T00:00:00Z', '2026-10-24T00:00:00.0Z', '2026-10-24T00:00:00.12Z', '2026-10-24T00:00:00.123Z'])('accepts UTC anchor with seconds through millisecond precision %s', anchorInstant => {
    expect(accepts('CreateDemoSessionInputSchema', { anchorInstant })).toBe(true);
  });
  it.each(['2026-10-24T00:00Z', '2026-10-24T00:00:00.0001Z', '2026-10-24T00:00:00.1230Z', '2026-10-24T00:00:00.123456Z', '2026-10-24T00:00:00+00:00', '2026-02-30T00:00:00Z'])('rejects unsupported session anchor %s', anchorInstant => {
    expect(accepts('CreateDemoSessionInputSchema', { anchorInstant })).toBe(false);
  });
  it('preserves higher precision for unrelated wire instants', () => {
    expect(accepts('ISOInstantSchema', '2026-10-24T00:00:00.123456Z')).toBe(true);
  });
});
