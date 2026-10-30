import {expect,it} from 'vitest';
import {writeFileSync} from 'node:fs';
import type {DatePriceQuery,TransportSearchQuery} from '@torob-ticket/contracts';
import {catalog,fixtureIdentity,farePoliciesForFixture,heroSearches,DIRECTIONAL_TRANSPORT_SOURCE_REVISION,SCHEDULE_TRADEOFF_SOURCE_REVISION,fixtureSourceRevision} from '@torob-ticket/fixtures';
import {groupOffers,rankGroups,projectDatePrices,localDateAt,type ComparisonContext} from '@torob-ticket/domain';
import {MockProvider} from './mock-provider';
import type {ProviderContext,ProviderEvidence} from './provider-context';
const clock={now:()=>new Date('2026-10-30T12:00:00Z')};
function context(sourceRevision=SCHEDULE_TRADEOFF_SOURCE_REVISION):ProviderContext{return{operationId:'ranking-tradeoffs',fixtureVersion:fixtureIdentity.fixtureVersion,sourceRevisions:Object.fromEntries(catalog.providerCapabilities.map(row=>[row.providerId,sourceRevision])),seed:6161,scenario:'normal',scenarioRevision:'scenario-v1',mappingRevision:'mapping-v1',demoClock:{now:()=>new Date('2026-10-29T00:00:00Z')},realClock:clock,signal:new AbortController().signal,deadline:new Date(clock.now().getTime()+5000),catalog,aliases:[],overrides:Object.fromEntries(catalog.providerCapabilities.map(row=>[row.providerId,{latencyMs:0}])),traceSink:async()=>{}};}
function comparison(rows:ProviderEvidence[]):ComparisonContext{return{realClock:clock,places:catalog.places,policiesByProviderId:farePoliciesForFixture(fixtureIdentity.fixtureVersion),sourceByOfferId:Object.fromEntries(rows.flatMap(row=>row.offer&&row.source?[[row.offer.offerId,{rawRecordId:row.raw.rawRecordId,source:row.source}]]:[]))};}
const base:TransportSearchQuery={mode:'flight',scope:'international',originCityId:'tehran',destinationCityId:'london',departureDate:'2026-11-02',tripType:'one-way',classCode:'economy',party:{adults:1,children:0,infants:0},filters:{},sort:'cheapest'};
async function collect(query:TransportSearchQuery,c=context()){
 const adapters=catalog.providerCapabilities.filter(p=>p.modes.includes(query.mode)&&p.scopes.includes(query.scope)).map(p=>new MockProvider(p.providerId));
 const batches=await Promise.all(adapters.map(adapter=>adapter.search(query,c)));expect(batches.every(batch=>batch.status==='success')).toBe(true);
 const rows=batches.flatMap(batch=>batch.records),offers=rows.flatMap(row=>row.offer?[row.offer]:[]);
 return{adapters,rows,offers,groups:groupOffers(offers,query,comparison(rows)).filter(group=>group.eligibleQuotes.length)};
}
for(const tripType of ['one-way','round-trip'] as const)it(`ranks genuinely quicker multistop London ${tripType} ahead of fewer-stop overnight connections without changing the offer set`,async()=>{
 const query={...base,tripType,...tripType==='round-trip'?{returnDate:'2026-11-09'}:{}};
 const {groups,offers}=await collect(query);expect(groups).toHaveLength(12);expect(offers).toHaveLength(48);
 const fastest=rankGroups(groups,'fastest'),fewest=rankGroups(groups,'fewest-connections');
 expect(fastest[0]!.durationMinutes).toBeLessThan(fewest[0]!.durationMinutes);expect(fastest[0]!.connectionCount).toBeGreaterThan(fewest[0]!.connectionCount);
 expect(fastest.map(g=>g.groupId)).not.toEqual(fewest.map(g=>g.groupId));expect(fastest.map(g=>g.groupId).sort()).toEqual(fewest.map(g=>g.groupId).sort());
 const old=await collect(query,context(DIRECTIONAL_TRANSPORT_SOURCE_REVISION));
 for(const group of groups){
  const outbound=group.itinerary.outbound,back=group.itinerary.return;
  expect(localDateAt(outbound.segments[0]!.departureAt,outbound.segments[0]!.departureTimeZone)).toBe(query.departureDate);
  if(back){expect(localDateAt(back.segments[0]!.departureAt,back.segments[0]!.departureTimeZone)).toBe('2026-11-09');expect(Date.parse(back.segments[0]!.departureAt)).toBeGreaterThan(Date.parse(outbound.segments.at(-1)!.arrivalAt));}
 }
 expect(new Set(groups.map(g=>g.eligibleQuotes[0]!.total.amountRial))).toEqual(new Set(old.groups.map(g=>g.eligibleQuotes[0]!.total.amountRial)));
 if(process.env.TOROBTICKET_CAPTURE_RANKING_PROOF==='1')writeFileSync(`docs/evidence/adjustments/ranking-tradeoffs/v5-${tripType}.json`,JSON.stringify({query,fastest:fastest.map(g=>({groupId:g.groupId,duration:g.durationMinutes,connections:g.connectionCount,quote:g.eligibleQuotes[0],itinerary:g.itinerary})),fewest:fewest.map(g=>({groupId:g.groupId,duration:g.durationMinutes,connections:g.connectionCount}))},null,2)+'\n');
});
it('keeps legitimate same-count direct train ordering identical and retains all twelve services',async()=>{
 const query:TransportSearchQuery={...base,mode:'train',scope:'domestic',destinationCityId:'mashhad',classCode:'seat'};
 const {groups,offers}=await collect(query);expect(groups).toHaveLength(12);expect(offers).toHaveLength(48);expect(groups.every(g=>g.connectionCount===0)).toBe(true);
 expect(rankGroups(groups,'fastest').map(g=>g.groupId)).toEqual(rankGroups(groups,'fewest-connections').map(g=>g.groupId));
});
it('filters actual retimed same-day returns before offering complete inventory',async()=>{
 const query:TransportSearchQuery={...base,tripType:'round-trip',returnDate:base.departureDate};
 const {offers,groups}=await collect(query);expect(offers.length).toBeGreaterThan(0);expect(offers.length).toBeLessThan(48);expect(groups.length).toBeGreaterThan(0);
 for(const offer of offers){const back=offer.itinerary.return!;expect(Date.parse(back.segments[0]!.departureAt)).toBeGreaterThan(Date.parse(offer.itinerary.outbound.segments.at(-1)!.arrivalAt));expect(localDateAt(back.segments[0]!.departureAt,back.segments[0]!.departureTimeZone)).toBe(query.returnDate);}
});
for(const hero of [...heroSearches,{mode:'flight' as const,scope:'international' as const,destinationCityId:'london'}])it(`keeps v5 ${hero.mode}/${hero.destinationCityId} return-day minima equal exact complete selected-date search totals`,async()=>{
 const query:TransportSearchQuery={...base,...hero,tripType:'round-trip',returnDate:'2026-11-07',classCode:hero.mode==='flight'?'economy':hero.mode==='train'?'seat':'standard',party:{adults:2,children:1,infants:1,childAges:[8],infantAgesMonths:[6]}};
 const dates=['2026-11-07','2026-11-08','2026-11-09'],request:DatePriceQuery={query,leg:'return',dates,clientGeneration:'ranking-return-prices'},c=context();
 const adapters=catalog.providerCapabilities.filter(p=>p.modes.includes(query.mode)&&p.scopes.includes(query.scope)).map(p=>new MockProvider(p.providerId));
 const batches=await Promise.all(adapters.map(adapter=>adapter.dateInventory(request,c)));expect(batches.every(batch=>batch.status==='success')).toBe(true);
 const rows=batches.flatMap(batch=>batch.dates.flatMap(row=>row.batch.records)),offers=rows.flatMap(row=>row.offer?[row.offer]:[]),providerIds=adapters.map(adapter=>adapter.providerId),coverage={expectedProviderIds:providerIds,successfulProviderIds:providerIds,failedProviderIds:[],pendingProviderIds:[],complete:true};
 const cells=projectDatePrices({request,anchorInstant:c.demoClock.now().toISOString(),originTimeZone:'Asia/Tehran',destinationTimeZone:catalog.cities.find(city=>city.id===query.destinationCityId)!.timeZone,offers,comparison:comparison(rows),coverageByDate:Object.fromEntries(dates.map(date=>[date,coverage])),observationsByOfferId:Object.fromEntries(offers.map(offer=>[offer.offerId,offer.observedAt])),persistedQuotes:[]}).cells;
 expect(cells.every(cell=>cell.status==='priced')).toBe(true);
 for(const [index,date]of dates.entries()){
  const selected=await collect({...query,returnDate:date},context()),minimum=Math.min(...selected.groups.flatMap(group=>group.eligibleQuotes.map(quote=>quote.total.amountRial)));
  expect(cells[index]).toMatchObject({date,status:'priced',minimum:{amountRial:minimum}});
 }
});
it('rechecks recorded base, v4 and v5 selections against their own exact source after the active source advances',async()=>{
 const adapter=new MockProvider('demo-provider-01');
 for(const revision of [fixtureSourceRevision('showcase-v3'),DIRECTIONAL_TRANSPORT_SOURCE_REVISION,SCHEDULE_TRADEOFF_SOURCE_REVISION]){
  const c=context(revision),first=await adapter.search(base,c);expect(first.status).toBe('success');const chosen=first.records[0]!.offer!;
  await adapter.search(base,context());
  const checked=await adapter.recheck({query:base,serviceKey:chosen.itinerary.itineraryId,previous:chosen},{...c,sourceRevisions:{[chosen.providerId]:revision}});
  expect(checked.outcome).toBe('unchanged');expect(checked.record?.offer?.total).toEqual(chosen.total);expect(checked.record?.offer?.itinerary).toEqual(chosen.itinerary);expect(checked.record?.offer?.provenance[0]?.sourceRevision).toBe(revision);
 }
});
