import {expect,it} from 'vitest';
import type {TransportSearchQuery} from '@torob-ticket/contracts';
import {catalog,classChoices,fixtureIdentity,fixtureSourceRevision,farePoliciesForFixture,generateProviderRecords,heroSearches,type FixtureQuery} from '@torob-ticket/fixtures';
import {groupOffers,normalizeRecord,quoteOffer,type ComparisonContext} from '@torob-ticket/domain';
import {decodeRawRecord} from './raw-codecs';
const realClock={now:()=>new Date('2026-10-29T12:00:00Z')};
function request(mode:TransportSearchQuery['mode'],scope:TransportSearchQuery['scope'],originCityId:string,destinationCityId:string,classCode:string,departureDate='2026-11-01',roundTrip=true):FixtureQuery {
 return{...fixtureIdentity,seed:5151,anchorInstant:'2026-10-29T00:00:00Z',scenario:'normal',scenarioRevision:'scenario-v1',mappingRevision:'mapping-v1',query:{mode,scope,originCityId,destinationCityId,classCode,tripType:roundTrip?'round-trip':'one-way',departureDate,...(roundTrip?{returnDate:'2026-11-04'}:{}),party:{adults:2,children:1,infants:1,childAges:[8],infantAgesMonths:[6]},filters:{},sort:'cheapest'}};
}
function collect(input:FixtureQuery){
 const raw=generateProviderRecords(input),rows=raw.map(record=>normalizeRecord(decodeRawRecord(record),{query:input.query,catalog,mappingRevision:input.mappingRevision,aliases:[],realClock}));
 const context:ComparisonContext={realClock,places:catalog.places,policiesByProviderId:farePoliciesForFixture(input.fixtureVersion),sourceByOfferId:Object.fromEntries(rows.flatMap((row,index)=>row.offer&&row.source?[[row.offer.offerId,{rawRecordId:raw[index]!.rawRecordId,source:row.source}]]:[]))};
 return{raw,rows,context,groups:groupOffers(rows.flatMap(row=>row.offer?[row.offer]:[]),input.query,context)};
}
it('offers twelve distinct family journeys and four complete sellers for every hero class, direction and trip type',()=>{
 for(const hero of heroSearches)for(const cls of classChoices.filter(cls=>cls.mode===hero.mode))for(const reverse of [false,true])for(const roundTrip of [false,true]){
  const input=request(hero.mode,hero.scope,reverse?hero.destinationCityId:'tehran',reverse?'tehran':hero.destinationCityId,cls.code,'2026-11-01',roundTrip);
  const result=collect(input);expect(result.raw).toHaveLength(48);expect(result.rows.every(row=>row.trace.outcome==='accepted')).toBe(true);
  expect(result.groups).toHaveLength(12);
  for(const group of result.groups){expect(group.eligibleQuotes).toHaveLength(4);expect(group.incompletePriceOffers).toEqual([]);expect(new Set(group.eligibleQuotes.map(quote=>quote.providerId)).size).toBe(4);expect(group.eligibleQuotes.every(quote=>quote.party.adults===2&&quote.party.children===1&&quote.completeness.status==='complete'&&quote.sourceRevision===fixtureSourceRevision(fixtureIdentity.fixtureVersion))).toBe(true);}
 }
},20000);
it.each(['ankara','istanbul'])('preserves complete source ownership and explicit station connector evidence for Tehran–%s in both directions',destination=>{
 for(const reverse of [false,true])for(const classCode of ['seat','sleeper-4','sleeper-6']){
  const input=request('train','international',reverse?destination:'tehran',reverse?'tehran':destination,classCode),result=collect(input);
  expect(result.groups).toHaveLength(12);
  for(const row of result.rows){expect(row.offer).toBeDefined();const offer=row.offer!;expect(quoteOffer(offer,input.query,result.context).status).toBe('eligible');
   for(const leg of [offer.itinerary.outbound,offer.itinerary.return!]){
    const connector=leg.segments.findIndex(segment=>segment.mode==='bus');expect(connector).toBeGreaterThan(0);expect(leg.segments[connector-1]!.mode).toBe('train');expect(leg.segments[connector+1]!.mode).toBe('train');
    expect([leg.segments[connector]!.originPlaceId,leg.segments[connector]!.destinationPlaceId].sort()).toEqual(['tatvan-station','van-station']);
    for(const placeId of [leg.segments[connector]!.originPlaceId,leg.segments[connector]!.destinationPlaceId])expect(leg.stops.some(stop=>stop.placeId===placeId&&stop.kind==='ground-transfer'&&stop.vehicleChange)).toBe(true);
   }
   expect(offer.conditions.outbound.checkedBaggageKg.status).toBe('unknown');expect(offer.conditions.outbound.materialTerms.some(term=>term.includes('حفاظت اتصال'))).toBe(true);
  }
 }
},20000);
it('keeps meaningful explicit no-timetable/unknown-price/limited-stock cases without starving normal inventory',()=>{
 const input=request('flight','domestic','tehran','mashhad','economy');
 expect(generateProviderRecords({...input,caseId:'no-timetable'})).toEqual([]);expect(generateProviderRecords({...input,scenario:'no-eligible-results'})).toEqual([]);
 const incomplete=collect({...input,caseId:'unknown-fees'});expect(incomplete.groups).toHaveLength(12);expect(incomplete.groups.every(group=>group.eligibleQuotes.length===0&&group.incompletePriceOffers.length===4)).toBe(true);
 const limited=collect({...input,caseId:'limited-stock'});expect(limited.groups).toHaveLength(11);expect(collect(input).groups).toHaveLength(12);
});
it('keeps whole-family source totals, return gross, class tradeoffs and route-distance price relationships',()=>{
 const input=request('bus','domestic','tehran','isfahan','vip', '2026-11-01',false),base=collect(input);
 const doubled=collect({...input,query:{...input.query,party:{adults:4,children:2,infants:2,childAges:[8,8],infantAgesMonths:[6,6]}}});
 for(let i=0;i<base.rows.length;i++)expect(doubled.rows[i]!.offer!.total!.amountRial).toBe(base.rows[i]!.offer!.total!.amountRial*2);
 const long=collect(request('bus','domestic','tehran','bandar-abbas','vip','2026-11-01',false)),short=collect(request('bus','domestic','tehran','rasht','vip','2026-11-01',false));
 expect(Math.min(...long.groups.flatMap(group=>group.eligibleQuotes.map(quote=>quote.total.amountRial)))).toBeGreaterThan(Math.max(...short.groups.flatMap(group=>group.eligibleQuotes.map(quote=>quote.total.amountRial))));
 expect(Math.min(...long.groups.map(group=>group.durationMinutes))).toBeGreaterThan(Math.max(...short.groups.map(group=>group.durationMinutes)));
 const round=collect(request('bus','domestic','tehran','isfahan','vip'));
 for(let i=0;i<base.rows.length;i++){expect(round.rows[i]!.offer!.total!.amountRial).toBeGreaterThan(base.rows[i]!.offer!.total!.amountRial);expect(round.rows[i]!.offer!.total!.amountRial).toBeLessThan(base.rows[i]!.offer!.total!.amountRial*2);}
});
it('does not expand geography into unsupported ocean ground routes or change immutable source records by seller projection',()=>{
 expect(catalog.supportedConnections.some(route=>route.mode==='bus'&&route.destinationCityId==='los-angeles')).toBe(false);
 expect(catalog.supportedConnections.some(route=>route.mode==='train'&&route.destinationCityId==='london')).toBe(false);
 for(const mode of ['flight','train','bus'] as const){const hero=heroSearches.find(hero=>hero.mode===mode)!,input=request(mode,hero.scope,'tehran',hero.destinationCityId,mode==='flight'?'economy':mode==='train'?'sleeper-4':'vip');const all=generateProviderRecords(input);for(const caseId of [undefined,'duplicate','unknown-fees','limited-stock'] as const){const projectedInput={...input,...(caseId?{caseId}:{})},allCases=generateProviderRecords(projectedInput);for(const providerId of new Set(all.map(row=>row.providerId)))expect(generateProviderRecords(projectedInput,providerId)).toEqual(allCases.filter(row=>row.providerId===providerId));}}
});
