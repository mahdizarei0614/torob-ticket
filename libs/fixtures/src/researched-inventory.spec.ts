import {createHash} from 'node:crypto';
import {expect,it} from 'vitest';
import {JourneyLegSchema,type JourneyLeg,type RawProviderRecord} from '@torob-ticket/contracts';
import {localDateAt} from '@torob-ticket/domain';
import {catalog,catalogForIdentity,fixtureIdentity,fixtureBundles,fixtureSourceRevision,farePoliciesForFixture,generateProviderRecords,materializeRoomRates,type FixtureQuery} from './index';
import {flightProfiles} from './catalog/flight-profiles';
import legacySnapshots from './legacy-v1/replay-snapshots.json';

const query=(destinationCityId:string,reverse=false):FixtureQuery=>({...fixtureIdentity,seed:49,anchorInstant:'2026-10-29T00:00:00.000Z',scenario:'normal',scenarioRevision:'scenario-v1',mappingRevision:'mapping-v1',query:{mode:'flight',scope:'international',originCityId:reverse?destinationCityId:'tehran',destinationCityId:reverse?'tehran':destinationCityId,tripType:'round-trip',departureDate:'2026-11-01',returnDate:'2026-11-05',party:{adults:1,children:0,infants:0},classCode:'economy',filters:{},sort:'cheapest'}});
function allObjects(value:unknown):Record<string,unknown>[] {if(!value||typeof value!=='object')return[];return Array.isArray(value)?value.flatMap(allObjects):[value as Record<string,unknown>,...Object.values(value).flatMap(allObjects)];}
function legs(record:RawProviderRecord):JourneyLeg[]{return allObjects(record.payload).filter(item=>Array.isArray(item.segments)).map(item=>JourneyLegSchema.parse(item));}

it('replays the exact frozen v1 raw evidence across all hero modes, dialects, parties and both trip types',()=>{
 for(const row of legacySnapshots){const records=generateProviderRecords(row.input as FixtureQuery);expect(records).toHaveLength(row.recordCount);expect(createHash('sha256').update(JSON.stringify(records)).digest('hex')).toBe(row.sha256);}
 expect(catalogForIdentity('showcase-v1','catalog-v1').cities).toHaveLength(22);
 expect(catalogForIdentity('showcase-v1','catalog-v1').classChoices.some(item=>item.code==='sleeper-6')).toBe(false);
 expect(catalogForIdentity('showcase-v2','catalog-v2').cities).toHaveLength(33);
 expect(()=>catalogForIdentity('showcase-v2','catalog-v1')).toThrow(/version/i);
 expect(fixtureBundles.map(bundle=>bundle.identity.fixtureVersion)).toEqual(['showcase-v1','showcase-v2']);
});

it('keeps legacy hotel templates, provenance, prices and local dates separate from v2',()=>{
 const old=materializeRoomRates('2026-10-24T00:00:00Z','mashhad','showcase-v1');
 expect(old).toHaveLength(42);expect(old[0]!.provenance[0]!.fixtureVersion).toBe('showcase-v1');
 expect(old[0]!.nightlyPrices[0]!.total.amountRial).toBe(18000000);
 expect(fixtureBundles[0]!.hotels).toHaveLength(308);expect(fixtureBundles[0]!.roomRateTemplates).toHaveLength(924);
 expect(fixtureBundles[1]!.hotels).toHaveLength(462);expect(fixtureBundles[1]!.roomRateTemplates).toHaveLength(1386);
 for(const destination of Object.keys(flightProfiles)){const rates=materializeRoomRates('2026-10-29T23:00:00Z',destination);expect(rates).toHaveLength(42);expect(rates[0]!.nightlyPrices[0]!.date).toBe(localDateAt('2026-10-29T23:00:00Z',catalog.cities.find(city=>city.id===destination)!.timeZone));expect(rates[0]!.nightlyPrices).toHaveLength(120);}
});

it('resolves exact source and fare-policy revisions without mutating historical or shared applicability',()=>{
 expect(fixtureSourceRevision('showcase-v1')).toBe('source-v1');expect(fixtureSourceRevision('showcase-v2')).toBe('source-v2-travel-research-2026-10-29');
 expect(fixtureSourceRevision('foundation-v1')).toBe('source-v1');expect(farePoliciesForFixture('foundation-v1')).toEqual(farePoliciesForFixture('showcase-v1'));
 const old=farePoliciesForFixture('showcase-v1'),current=farePoliciesForFixture('showcase-v2');
 expect(old['demo-provider-02']!.revision).toBe('mock-fares-v1');expect(old['demo-provider-02']!.classCodes).not.toContain('sleeper-6');
 expect(current['demo-provider-02']!.revision).toBe('mock-fares-v2');expect(current['demo-provider-02']!.classCodes).toContain('sleeper-6');
 current['demo-provider-02']!.classCodes.length=0;expect(farePoliciesForFixture('showcase-v2')['demo-provider-02']!.classCodes).toContain('sleeper-6');
 expect(()=>farePoliciesForFixture('missing')).toThrow(/version/);expect(()=>fixtureSourceRevision('missing')).toThrow(/version/);
});

it('uses real airport codes/valid zones while leaving ground station and terminal codes absent',()=>{
 for(const code of ['LHR','CDG','FRA','JFK','LAX','YYZ','SIN','BKK','HND','SYD','AKL']){const place=catalog.places.find(place=>place.code===code)!;expect(place.kind).toBe('airport');expect(Number.isFinite(place.point.longitude)).toBe(true);expect(new Intl.DateTimeFormat('en',{timeZone:place.timeZone}).format(new Date())).toBeTruthy();}
 for(const place of catalog.places.filter(place=>place.kind==='station'||place.kind==='terminal'))expect(place.code).toBeUndefined();
 expect(catalog.supportedConnections.filter(connection=>connection.mode==='train'&&connection.scope==='international').map(connection=>[connection.originCityId,connection.destinationCityId])).toEqual([['tehran','van'],['van','tehran']]);
});

it.each(Object.keys(flightProfiles))('supplies coherent reversible one/two/three-stop complete-provider journeys to %s',destination=>{
 for(const reverse of [false,true]){
  const input=query(destination,reverse),records=generateProviderRecords(input);expect(records).toHaveLength(12);
  const firstSeller=records.filter(record=>record.providerId==='demo-provider-01');
  expect(firstSeller.map(record=>legs(record)[0]!.stops.length)).toEqual([1,2,3]);
  for(const record of records){const [out,back]=legs(record);expect(out).toBeDefined();expect(back).toBeDefined();
   const end=out!.segments.at(-1)!,returnStart=back!.segments[0]!;
   expect(returnStart.originPlaceId).toBe(end.destinationPlaceId);expect(back!.segments.at(-1)!.destinationPlaceId).toBe(out!.segments[0]!.originPlaceId);
   expect(Date.parse(returnStart.departureAt)).toBeGreaterThan(Date.parse(end.arrivalAt));
   for(const leg of [out!,back!])for(const [index,segment] of leg.segments.entries()){
    expect(segment.operatorId).toMatch(/^airline:/);expect(Date.parse(segment.arrivalAt)).toBeGreaterThan(Date.parse(segment.departureAt));
    expect(segment.departureTimeZone).toBe(catalog.places.find(place=>place.id===segment.originPlaceId)!.timeZone);
    if(index){const previous=leg.segments[index-1]!,stop=leg.stops[index-1]!;expect(segment.originPlaceId).toBe(previous.destinationPlaceId);expect((Date.parse(segment.departureAt)-Date.parse(previous.arrivalAt))/60000).toBe(stop.waitMinutes);expect(stop.kind).toBe('connection');expect(stop.vehicleChange).toBe(true);expect(stop.waitMinutes).toBeGreaterThanOrEqual(100);}
   }
   expect(allObjects(record.payload).some(item=>[item.materialTerms,item.conditions].some(terms=>Array.isArray(terms)&&terms.includes('حفاظت اتصال و انتقال بار بین شرکت‌ها اعلام نشده است.')))).toBe(true);
  }
 }
});

it('carries a genuine local-date reversal across HND→LAX without reversing absolute chronology',()=>{
 const record=generateProviderRecords(query('los-angeles'))[2]!,out=legs(record)[0]!;
 expect(out.segments.map(segment=>segment.originPlaceId)).toEqual(['ika','dxb','sin','hnd']);expect(out.segments.at(-1)!.destinationPlaceId).toBe('lax');
 const transpacific=out.segments.at(-1)!;expect(localDateAt(transpacific.arrivalAt,transpacific.arrivalTimeZone)<localDateAt(transpacific.departureAt,transpacific.departureTimeZone)).toBe(true);
 expect(Date.parse(transpacific.arrivalAt)-Date.parse(transpacific.departureAt)).toBe(600*60000);
});

it('distinguishes researched saloon, four-berth and six-berth services with immutable dated segment IDs',()=>{
 const all=[];
 for(const classCode of ['seat','sleeper-4','sleeper-6']){const input=query('mashhad');input.query={...input.query,mode:'train',scope:'domestic',classCode};const record=generateProviderRecords(input)[0]!,leg=legs(record)[0]!;expect(leg.segments[0]!.operatorId).toMatch(/^rail:/);all.push(leg.segments[0]!);}
 expect(new Set(all.map(segment=>segment.serviceId)).size).toBe(3);expect(new Set(all.map(segment=>segment.segmentId)).size).toBe(3);
 expect(all.map(segment=>(Date.parse(segment.arrivalAt)-Date.parse(segment.departureAt))/60000)).toEqual([525,660,660]);
});
