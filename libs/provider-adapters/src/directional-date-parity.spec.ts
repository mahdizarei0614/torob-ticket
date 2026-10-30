import {expect,it} from 'vitest';
import type {DatePriceQuery,NormalizedOffer,TransportSearchQuery} from '@torob-ticket/contracts';
import {catalog,fixtureIdentity,farePoliciesForFixture,heroSearches,DIRECTIONAL_TRANSPORT_SOURCE_REVISION,fixtureSourceRevision} from '@torob-ticket/fixtures';
import {groupOffers,projectDatePrices,type ComparisonContext} from '@torob-ticket/domain';
import {MockProvider} from './mock-provider';
import type {ProviderContext,ProviderEvidence} from './provider-context';
const clock={now:()=>new Date('2026-10-30T12:00:00Z')};
const dates=['2026-11-07','2026-11-08','2026-11-09'];
function context(sourceRevision:string):ProviderContext{
 return{operationId:'directional-pricing',fixtureVersion:fixtureIdentity.fixtureVersion,sourceRevisions:Object.fromEntries(catalog.providerCapabilities.map(row=>[row.providerId,sourceRevision])),seed:6161,scenario:'normal',scenarioRevision:'scenario-v1',mappingRevision:'mapping-v1',demoClock:{now:()=>new Date('2026-10-29T00:00:00Z')},realClock:clock,signal:new AbortController().signal,deadline:new Date(clock.now().getTime()+5000),catalog,aliases:[],overrides:Object.fromEntries(catalog.providerCapabilities.map(row=>[row.providerId,{latencyMs:0}])),traceSink:async()=>{}};
}
function comparison(rows:ProviderEvidence[]):ComparisonContext{
 return{realClock:clock,places:catalog.places,policiesByProviderId:farePoliciesForFixture(fixtureIdentity.fixtureVersion),sourceByOfferId:Object.fromEntries(rows.flatMap(row=>row.offer&&row.source?[[row.offer.offerId,{rawRecordId:row.raw.rawRecordId,source:row.source}]]:[]))};
}
for(const hero of heroSearches)it(`${hero.mode}/${hero.scope} return-day minima vary and equal selected-date complete tickets for the identical fixed departure`,async()=>{
 const query:TransportSearchQuery={...hero,originCityId:'tehran',departureDate:'2026-11-02',returnDate:dates[0],tripType:'round-trip',classCode:hero.mode==='flight'?'economy':hero.mode==='train'?'sleeper-4':'vip',party:{adults:2,children:1,infants:1,childAges:[8],infantAgesMonths:[6]},filters:{},sort:'cheapest'};
 const request:DatePriceQuery={query,leg:'return',dates,clientGeneration:'directional-return'};
 const c=context(DIRECTIONAL_TRANSPORT_SOURCE_REVISION);
 const adapters=catalog.providerCapabilities.filter(row=>row.modes.includes(query.mode)&&row.scopes.includes(query.scope)).map(row=>new MockProvider(row.providerId));
 const batches=await Promise.all(adapters.map(adapter=>adapter.dateInventory(request,c)));
 expect(batches.every(batch=>batch.status==='success')).toBe(true);
 const rows=batches.flatMap(batch=>batch.dates.flatMap(row=>row.batch.records));
 const offers=rows.flatMap(row=>row.offer?[row.offer]:[]);
 const expectedProviderIds=adapters.map(adapter=>adapter.providerId);
 const coverage={expectedProviderIds,successfulProviderIds:expectedProviderIds,failedProviderIds:[],pendingProviderIds:[],complete:true};
 const projected=projectDatePrices({request,anchorInstant:c.demoClock.now().toISOString(),originTimeZone:'Asia/Tehran',destinationTimeZone:catalog.cities.find(city=>city.id===query.destinationCityId)!.timeZone,offers,comparison:comparison(rows),coverageByDate:Object.fromEntries(dates.map(date=>[date,coverage])),observationsByOfferId:Object.fromEntries(offers.map(offer=>[offer.offerId,offer.observedAt])),persistedQuotes:[]});
 expect(projected.cells.every(cell=>cell.status==='priced')).toBe(true);
 const minima:number[]=[];
 for(const [index,date]of dates.entries()){
  const selected={...query,returnDate:date};
  const results=await Promise.all(adapters.map(adapter=>adapter.search(selected,{...c,operationId:'selected-'+date})));
  const selectedRows=results.flatMap(row=>row.records),selectedOffers=selectedRows.flatMap(row=>row.offer?[row.offer]:[]);
  const minimum=Math.min(...groupOffers(selectedOffers,selected,comparison(selectedRows)).flatMap(group=>group.eligibleQuotes.map(quote=>quote.total.amountRial)));
  expect(projected.cells[index]).toMatchObject({date,status:'priced',minimum:{amountRial:minimum}});minima.push(minimum);
  const reordered=groupOffers(selectedOffers,{...selected,sort:'fastest'},comparison(selectedRows));expect(Math.min(...reordered.flatMap(group=>group.eligibleQuotes.map(quote=>quote.total.amountRial)))).toBe(minimum);
 }
 expect(new Set(minima).size).toBeGreaterThan(1);
 expect(query.departureDate).toBe('2026-11-02');
},15000);
it('new complete supplied returns can use different hubs, stop counts and operators while old-source rechecks retain old material',async()=>{
 const query:TransportSearchQuery={mode:'flight',scope:'international',tripType:'round-trip',originCityId:'tehran',destinationCityId:'los-angeles',departureDate:'2026-11-02',returnDate:'2026-11-09',party:{adults:1,children:0,infants:0},classCode:'economy',filters:{},sort:'cheapest'};
 const adapter=new MockProvider('demo-provider-01');
 for(const revision of [fixtureSourceRevision('showcase-v3'),DIRECTIONAL_TRANSPORT_SOURCE_REVISION]){
  const c=context(revision),first=await adapter.search(query,c);expect(first.status).toBe('success');
  const offers=first.records.flatMap(row=>row.offer?[row.offer]:[]);expect(offers).toHaveLength(12);
  const chosen=offers[1] as NormalizedOffer;
  expect(chosen.provenance[0]!.sourceRevision).toBe(revision);
  if(revision===DIRECTIONAL_TRANSPORT_SOURCE_REVISION){
   expect(chosen.itinerary.outbound.segments.map(segment=>segment.originPlaceId).concat('lax')).toEqual(['ika','ist','fra','lax']);
   expect(chosen.itinerary.return!.segments.map(segment=>segment.originPlaceId).concat('ika')).toEqual(['lax','hnd','sin','dxb','ika']);
   expect(chosen.itinerary.outbound.stops).toHaveLength(2);expect(chosen.itinerary.return!.stops).toHaveLength(3);
   expect(chosen.itinerary.outbound.segments.map(segment=>segment.operatorId)).not.toEqual(chosen.itinerary.return!.segments.map(segment=>segment.operatorId).reverse());
  }
  // A new active search in the same owner does not change an old selection's source.
  await adapter.search(query,context(DIRECTIONAL_TRANSPORT_SOURCE_REVISION));
  const recheck=await adapter.recheck({query,serviceKey:chosen.itinerary.itineraryId,previous:chosen},{...c,sourceRevisions:{[chosen.providerId]:chosen.provenance[0]!.sourceRevision}});
  expect(recheck.outcome).toBe('unchanged');expect(recheck.record?.offer?.total).toEqual(chosen.total);expect(recheck.record?.offer?.itinerary).toEqual(chosen.itinerary);
 }
});
