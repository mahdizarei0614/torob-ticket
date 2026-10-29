import {expect,it} from 'vitest';
import {catalogForIdentity,farePoliciesForFixture,generateProviderRecords,type FixtureQuery} from '@torob-ticket/fixtures';
import {groupOffers,normalizeRecord,type ComparisonContext,type NormalizationResult} from '@torob-ticket/domain';
import {decodeRawRecord} from './raw-codecs';
const catalog=catalogForIdentity('showcase-v2','catalog-v2'),mockFarePolicies=farePoliciesForFixture('showcase-v2');
const request:FixtureQuery={fixtureVersion:'showcase-v2',seed:49,anchorInstant:'2026-10-29T00:00:00Z',scenario:'normal',scenarioRevision:'scenario-v1',mappingRevision:'mapping-v1',query:{mode:'flight',scope:'international',originCityId:'tehran',destinationCityId:'los-angeles',tripType:'round-trip',departureDate:'2026-11-01',returnDate:'2026-11-05',party:{adults:1,children:0,infants:0},classCode:'economy',filters:{},sort:'cheapest'}};
const realClock={now:()=>new Date('2026-10-29T12:00:00Z')};
function collect(input:FixtureQuery){
 const rows=generateProviderRecords(input).map(raw=>normalizeRecord(decodeRawRecord(raw),{query:input.query,catalog,mappingRevision:input.mappingRevision,aliases:[],realClock}));
 const context:ComparisonContext={realClock,places:catalog.places,policiesByProviderId:mockFarePolicies,sourceByOfferId:Object.fromEntries(rows.filter((row):row is NormalizationResult&Required<Pick<NormalizationResult,'offer'|'source'>>=>Boolean(row.offer&&row.source)).map(row=>[row.offer.offerId,{rawRecordId:row.offer.provenance[0]!.rawRecordId,source:row.source}]))};
 return{rows,context,offers:rows.flatMap(row=>row.offer?[row.offer]:[])};
}
it('quotes complete provider-supplied v2 round trips and retains per-journey total stop counts/unknown terms',()=>{
 const {rows,context,offers}=collect(request);expect(rows).toHaveLength(12);expect(rows.every(row=>row.trace.outcome==='accepted')).toBe(true);
 const groups=groupOffers(offers,request.query,context);expect(groups).toHaveLength(3);expect(groups.map(group=>group.connectionCount).sort()).toEqual([2,4,6]);
 expect(groups.every(group=>group.eligibleQuotes.length>=3)).toBe(true);
 for(const quote of groups.flatMap(group=>group.eligibleQuotes)){expect(quote.party).toEqual(request.query.party);expect(quote.completeness.status).toBe('complete');expect(quote.provenance.every(item=>item.fixtureVersion==='showcase-v2')).toBe(true);expect(quote.conditions.outbound.checkedBaggageKg.status).toBe('unknown');expect(quote.conditions.return!.materialTerms).toContain('حفاظت اتصال و انتقال بار بین شرکت‌ها اعلام نشده است.');}
 expect(groupOffers([...offers].reverse(),request.query,context)).toEqual(groups);
 expect(groupOffers(offers,{...request.query,filters:{maxStopsOrTransfers:3}},context).map(group=>group.connectionCount)).toEqual([2]);
 expect(groupOffers(offers,{...request.query,filters:{checkedBaggageMinKg:1}},context)).toEqual([]);
});
it('keeps incomplete mandatory prices out of complete claims and doubles whole-party gross without merging sellers',()=>{
 const one=collect(request),two=collect({...request,query:{...request.query,party:{adults:2,children:0,infants:0}}});
 expect(two.offers[0]!.total!.amountRial).toBe(one.offers[0]!.total!.amountRial*2);
 const groups=groupOffers(one.offers,request.query,one.context);
 expect(groups.flatMap(group=>group.incompletePriceOffers).map(offer=>offer.providerId)).toEqual(['demo-provider-03']);
 for(const group of groups)expect(group.eligibleQuotes.every(quote=>quote.completeness.status==='complete'&&quote.total.amountRial>0)).toBe(true);
 const partyGroups=groupOffers(two.offers,{...request.query,party:{adults:2,children:0,infants:0}},two.context);expect(partyGroups.every(group=>group.eligibleQuotes.every(quote=>quote.party.adults===2))).toBe(true);
});
