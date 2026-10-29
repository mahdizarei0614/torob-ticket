import {createHash} from 'node:crypto';
import {expect,it} from 'vitest';
import {catalogForIdentity,farePoliciesForFixture,fixtureBundles,fixtureSourceRevision,generateProviderRecords,materializeRoomRates,type FixtureQuery} from '@torob-ticket/fixtures';
import {normalizeRecord,quoteOffer,type ComparisonContext} from '@torob-ticket/domain';
import {readFileSync} from 'node:fs';
interface V2Snapshots{clock:string;catalogSha256:string;hotelsSha256:string;roomRateTemplatesSha256:string;farePoliciesSha256:string;sourceRevision:string;materializedRatesSha256:string;rows:{input:FixtureQuery;recordCount:number;rawSha256:string;normalSha256:string;quoteSha256:string}[]}
const snapshots=JSON.parse(readFileSync(new URL('../../fixtures/src/legacy-v2/replay-snapshots.json',import.meta.url),'utf8')) as V2Snapshots;
import {decodeRawRecord} from './raw-codecs';
const sha=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const catalog=catalogForIdentity('showcase-v2','catalog-v2'),policies=farePoliciesForFixture('showcase-v2');
it('replays the pre-v3 v2 catalog, hotel templates, policy and all destination nightly inventory exactly',()=>{
 const bundle=fixtureBundles.find(bundle=>bundle.identity.fixtureVersion==='showcase-v2')!;
 expect(sha(catalog)).toBe(snapshots.catalogSha256);expect(sha(bundle.hotels)).toBe(snapshots.hotelsSha256);
 expect(sha(bundle.roomRateTemplates)).toBe(snapshots.roomRateTemplatesSha256);expect(sha(policies)).toBe(snapshots.farePoliciesSha256);
 expect(fixtureSourceRevision('showcase-v2')).toBe(snapshots.sourceRevision);
 expect(sha(catalog.cities.map(city=>materializeRoomRates('2026-10-29T23:00:00.000Z',city.id,'showcase-v2')))).toBe(snapshots.materializedRatesSha256);
},10000);
it('replays 106 frozen v2 raw/normalized/quote cases through current decoders and domain rules',()=>{
 const realClock={now:()=>new Date(snapshots.clock)};
 for(const row of snapshots.rows){
  const input=row.input as FixtureQuery,raw=generateProviderRecords(input);
  expect(raw).toHaveLength(row.recordCount);expect(sha(raw)).toBe(row.rawSha256);
  const normalized=raw.map(record=>normalizeRecord(decodeRawRecord(record),{query:input.query,catalog,mappingRevision:input.mappingRevision,aliases:[],realClock}));
  expect(sha(normalized)).toBe(row.normalSha256);
  const sourceByOfferId:ComparisonContext['sourceByOfferId']=Object.fromEntries(normalized.flatMap((record,index)=>record.offer&&record.source?[[record.offer.offerId,{rawRecordId:raw[index]!.rawRecordId,source:record.source}]]:[]));
  const quotes=normalized.map(record=>record.offer?quoteOffer(record.offer,input.query,{realClock,places:catalog.places,sourceByOfferId,policiesByProviderId:policies}):record.trace.issues);
  expect(sha(quotes)).toBe(row.quoteSha256);
 }
},20000);
