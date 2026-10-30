import {createHash} from 'node:crypto';
import {expect,it} from 'vitest';
import baseline from './legacy-v4-source-replay.json';
import {catalog,farePoliciesForFixture,generateProviderRecords,type FixtureQuery} from './index';
import {connections} from './catalog/connections';
import {journey} from './schedules';
import {withScheduleTradeoffs} from './schedule-tradeoffs';
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
it('retains every pre-edit directional v4 source record, catalog and policy hash',()=>{
 expect(hash(catalog)).toBe(baseline.catalogSha256);
 expect(hash(farePoliciesForFixture('showcase-v3'))).toBe(baseline.farePoliciesSha256);
 expect(baseline.rows).toHaveLength(136);
 for(const row of baseline.rows)expect(hash(generateProviderRecords(row.input as FixtureQuery))).toBe(row.sha256);
});
it('retimes only supplied connection waits and dependent flight/stop identities without mutating the old leg',()=>{
 const connection=connections.find(row=>row.mode==='flight'&&row.originCityId==='tehran'&&row.destinationCityId==='london')!;
 for(const variant of [0,1,2]){
  const original=journey(connection,'2026-11-02',variant),before=structuredClone(original),next=withScheduleTradeoffs(original,connection,variant);
  expect(original).toEqual(before);expect(next.segments).toHaveLength(original.segments.length);expect(next.stops).toHaveLength(original.stops.length);
  expect(next.segments[0]).toEqual(original.segments[0]);
  for(const [index,segment]of next.segments.entries()){
   const old=original.segments[index]!;
   expect([segment.originPlaceId,segment.destinationPlaceId,segment.mode,segment.operatorId,segment.departureTimeZone,segment.arrivalTimeZone]).toEqual([old.originPlaceId,old.destinationPlaceId,old.mode,old.operatorId,old.departureTimeZone,old.arrivalTimeZone]);
   expect(Date.parse(segment.arrivalAt)-Date.parse(segment.departureAt)).toBe(Date.parse(old.arrivalAt)-Date.parse(old.departureAt));
   if(!index)continue;
   expect(segment.segmentId).not.toBe(old.segmentId);expect(segment.serviceId).not.toBe(old.serviceId);
   const stop=next.stops[index-1]!,oldStop=original.stops[index-1]!,previous=next.segments[index-1]!;
   expect([stop.placeId,stop.kind,stop.vehicleChange]).toEqual([oldStop.placeId,oldStop.kind,oldStop.vehicleChange]);
   expect(stop.arrivalAt).toBe(previous.arrivalAt);expect(stop.departureAt).toBe(segment.departureAt);
   expect(Date.parse(segment.departureAt)-Date.parse(previous.arrivalAt)).toBe(stop.waitMinutes*60000);
   expect(stop.waitMinutes).toBe(variant===0?540:90);
  }
 }
});
it('leaves domestic flights, direct ground services and the existing distant LAX itinerary untouched',()=>{
 for(const [mode,destination]of [['flight','mashhad'],['flight','los-angeles'],['train','mashhad'],['bus','isfahan']] as const){
  const connection=connections.find(row=>row.mode===mode&&row.originCityId==='tehran'&&row.destinationCityId===destination)!;
  for(const variant of [0,1,11]){const leg=journey(connection,'2026-11-02',variant,false,mode==='train'?'seat':mode==='bus'?'standard':'economy');expect(withScheduleTradeoffs(leg,connection,variant)).toBe(leg);}
 }
});
