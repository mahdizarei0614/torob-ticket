import { describe, expect, it } from 'vitest';
import * as fixtures from './index';
import { RawProviderRecordSchema, type RawProviderRecord, type TransportSearchQuery } from '@torob-ticket/contracts';
const generate = (input: unknown): RawProviderRecord[] => (fixtures as unknown as {generateProviderRecords?: (input: unknown) => RawProviderRecord[]}).generateProviderRecords?.(input) ?? [];
const base = { fixtureVersion: 'showcase-v1', seed: 73, anchorInstant: '2026-10-24T00:00:00.000Z', scenario: 'normal', scenarioRevision: 'scenario-v1', mappingRevision: 'mapping-v1' };
const query: TransportSearchQuery = {mode:'flight',scope:'domestic',originCityId:'tehran',destinationCityId:'mashhad',tripType:'round-trip',departureDate:'2026-10-24',returnDate:'2026-10-27',party:{adults:2,children:1,infants:1,childAges:[8],infantAgesMonths:[6]},classCode:'economy',filters:{},sort:'cheapest'};
function payloads(input = {...base,query}) { return generate(input).map(r => r.payload); }
describe('replayable raw inventories', () => {
  it('supplies distinct raw shapes for all participating providers with immutable evidence', () => {
    const records = generate({...base,query});
    expect(new Set(records.map(r=>r.providerId)).size).toBeGreaterThanOrEqual(3);
    expect(records.length).toBeGreaterThanOrEqual(9);
    for (const record of records) expect(RawProviderRecordSchema.safeParse(record).success).toBe(true);
    expect(new Set(records.map(r=>Object.keys(r.payload as object).sort().join(','))).size).toBeGreaterThanOrEqual(3);
  });
  it('replays exactly and timing scenarios do not change quote values', () => {
    const original = payloads();
    expect(original.length).toBeGreaterThan(0);
    expect(payloads()).toEqual(original);
    expect(payloads({...base,query,scenario:'slow-provider'})).toEqual(original);
    expect(payloads({...base,query,scenario:'provider-timeout'})).toEqual(original);
    expect(payloads({...base,query,scenarioRevision:'scenario-v2'})).toEqual(original);
    expect(payloads({...base,query,seed:74})).not.toEqual(original);
  });
  it('has genuine gaps, never zero quotes, and enforces the 90-day window', () => {
    expect(generate({...base,query:{...query,tripType:'one-way',returnDate:undefined,departureDate:'2026-10-30'}})).toEqual([]);
    expect(generate({...base,query,scenario:'no-eligible-results'})).toEqual([]);
    expect(()=>generate({...base,query:{...query,departureDate:'2027-01-22',returnDate:'2027-01-22'}})).toThrow(/coverage/i);
    expect(()=>generate({...base,fixtureVersion:'unknown',query})).toThrow(/version/i);
    expect(()=>generate({...base,query:{...query,destinationCityId:'missing'}})).toThrow(/route/i);
  });
});
