import {createHash} from 'node:crypto';
import {expect,it} from 'vitest';
import baseline from './legacy-v3-source-replay.json';
import {catalog,fixtureIdentity,fixtureSourceRevision,DIRECTIONAL_TRANSPORT_SOURCE_REVISION,SCHEDULE_TRADEOFF_SOURCE_REVISION,activeTransportSourceRevision,farePoliciesForFixture,generateProviderRecords,type FixtureQuery} from './index';
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
it('retains the exact original v3 catalog, policy and112 captured search/recheck source payloads',()=>{
 expect(hash(catalog)).toBe(baseline.catalogSha256);
 expect(hash(farePoliciesForFixture('showcase-v3'))).toBe(baseline.farePoliciesSha256);
 for(const row of baseline.rows){
  const input=row.input as FixtureQuery;
  expect(hash(generateProviderRecords(input))).toBe(row.sha256);
  expect(hash(generateProviderRecords({...input,sourceRevision:baseline.sourceRevision}))).toBe(row.sha256);
 }
});
it('selects a separately named active transport source without advancing the immutable fixture/catalog',()=>{
 expect(fixtureIdentity).toEqual({fixtureVersion:'showcase-v3',catalogRevision:'catalog-v3'});
 expect(activeTransportSourceRevision('showcase-v3')).toBe(SCHEDULE_TRADEOFF_SOURCE_REVISION);
 for(const fixture of ['showcase-v1','showcase-v2'])expect(activeTransportSourceRevision(fixture)).toBe(fixtureSourceRevision(fixture));
 const original=baseline.rows.find(row=>row.input.query.mode==='flight'&&row.input.query.scope==='international'&&row.input.query.tripType==='round-trip')!.input as FixtureQuery;
 const current={...original,sourceRevision:DIRECTIONAL_TRANSPORT_SOURCE_REVISION};
 const records=generateProviderRecords(current);
 expect(records).toHaveLength(48);
 for(const record of records)expect(JSON.stringify(record.payload)).toContain(`"sourceRevision":"${DIRECTIONAL_TRANSPORT_SOURCE_REVISION}"`);
 const old=generateProviderRecords(original);expect(records).not.toEqual(old);
 for(const provider of new Set(records.map(row=>row.providerId)))expect(generateProviderRecords(current,provider)).toEqual(records.filter(row=>row.providerId===provider));
 expect(()=>generateProviderRecords({...current,sourceRevision:'source-unknown'})).toThrow('Unsupported transport source revision');
});
