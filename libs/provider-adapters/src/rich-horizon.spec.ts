import {afterEach,expect,it,vi} from 'vitest';
import {fixtureIdentity,generateProviderRecords,heroSearches,catalog,type FixtureQuery} from '@torob-ticket/fixtures';
import {localDateAt} from '@torob-ticket/domain';
import {decodeRawRecord} from './raw-codecs';
import {MockProvider} from './mock-provider';
import type {ProviderContext} from './provider-context';
const date=(offset:number)=>new Date(Date.UTC(2026,9,29+offset)).toISOString().slice(0,10);
const cls={flight:'economy',train:'sleeper-4',bus:'vip'};
function input(hero:typeof heroSearches[number],offset:number,roundTrip:boolean):FixtureQuery {
 return{...fixtureIdentity,seed:5151,anchorInstant:'2026-10-29T00:00:00Z',scenario:'normal',scenarioRevision:'scenario-v1',mappingRevision:'mapping-v1',query:{...hero,originCityId:'tehran',tripType:roundTrip?'round-trip':'one-way',departureDate:date(offset),...(roundTrip?{returnDate:date(offset+3)}:{}),party:{adults:9,children:0,infants:0},classCode:cls[hero.mode],filters:{},sort:'cheapest'}};
}
it('keeps twelve nine-seat services on every covered normal hero day and every feasible three-day return',()=>{
 for(const hero of heroSearches)for(let offset=0;offset<90;offset++)for(const roundTrip of offset<=86?[false,true]:[false]){
  const request=input(hero,offset,roundTrip),records=generateProviderRecords(request,'demo-provider-04');
  expect(records,`${hero.mode}/${hero.scope}/${offset}/${roundTrip}`).toHaveLength(12);
  const decoded=records.map(decodeRawRecord);expect(new Set(decoded.map(row=>row.serviceKey)).size).toBe(12);
  expect(decoded.every(row=>row.seats>=9&&row.available&&row.mandatoryCharge!==null)).toBe(true);
  expect(decoded.every(row=>localDateAt(row.outbound.segments[0]!.departureAt,row.outbound.segments[0]!.departureTimeZone)===date(offset))).toBe(true);
  if(roundTrip)expect(decoded.every(row=>row.inbound&&Date.parse(row.inbound.segments[0]!.departureAt)>Date.parse(row.outbound.segments.at(-1)!.arrivalAt))).toBe(true);
 }
},20000);
afterEach(()=>{vi.useRealTimers();});
it('rechecks the twelfth dated service and preserves fixed return/date-batch authority through the real adapter',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-29T12:00:00Z'));
 const request=input(heroSearches[0],3,true),provider=new MockProvider('demo-provider-04');
 const context=(scenario:ProviderContext['scenario']='normal'):ProviderContext=>({operationId:`current-${Date.now()}`,fixtureVersion:fixtureIdentity.fixtureVersion,seed:request.seed,scenario,scenarioRevision:'scenario-v1',mappingRevision:'mapping-v1',demoClock:{now:()=>new Date(request.anchorInstant)},realClock:{now:()=>new Date()},signal:new AbortController().signal,deadline:new Date(Date.now()+5000),catalog,aliases:[],overrides:{},traceSink:async()=>{}});
 const finish=async<T>(operation:Promise<T>)=>{await vi.advanceTimersByTimeAsync(900);return operation;};
 const search=await finish(provider.search(request.query,context()));expect(search.status).toBe('success');expect(search.records).toHaveLength(12);
 const last=search.records.at(-1)!.offer!,first=search.records[0]!.offer!;
 expect(last.itinerary.itineraryId).toMatch(/:11$/);
 const unchanged=await finish(provider.recheck({query:request.query,serviceKey:last.itinerary.itineraryId,previous:last},context('sold-out')));
 expect(unchanged.outcome).toBe('unchanged');expect(unchanged.record!.offer!.itinerary).toEqual(last.itinerary);
 const priceChange=await finish(provider.recheck({query:request.query,serviceKey:first.itinerary.itineraryId,previous:first},context('price-change')));expect(priceChange.outcome).toBe('changed');
 const soldOut=await finish(provider.recheck({query:request.query,serviceKey:first.itinerary.itineraryId,previous:first},context('sold-out')));expect(soldOut.outcome).toBe('sold-out');
 const batch=await finish(provider.dateInventory({query:request.query,leg:'outbound',dates:[date(3),date(4),date(5)],clientGeneration:'current-date-request'},context()));
 expect(batch.status).toBe('success');expect(batch.dates.map(row=>row.batch.records.length)).toEqual([12,12,12]);
 for(const row of batch.dates)for(const record of row.batch.records){expect(record.offer!.itinerary.return!.segments[0]!.departureAt.slice(0,10)).toBe('2026-11-04');expect(localDateAt(record.offer!.itinerary.outbound.segments[0]!.departureAt,'Asia/Tehran')).toBe(row.date);}
 expect(vi.getTimerCount()).toBe(0);
});
