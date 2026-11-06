import {parseDate} from '@internationalized/date';
import {setImmediate} from 'node:timers/promises';
import {SearchSnapshotSchema,HotelSearchSnapshotSchema,type CatalogSnapshot,type RawProviderRecord,type HotelSearchQuery,type TransportSearchQuery} from '@torob-ticket/contracts';
import {groupOffers,normalizeRecord,localDateAt,priceStay,type ComparisonContext} from '@torob-ticket/domain';
import {fixtureBundles,generateProviderRecords,farePoliciesForFixture,realHotelInventory,type FixtureQuery} from '@torob-ticket/fixtures';
import {decodeRawRecord} from '@torob-ticket/provider-adapters';
import {activityId,materializeStoredHotelRate,type ActivitySource,type TrafficActivityPlan,type ActivityVisit} from '@torob-ticket/data-access';

/** Representative source templates are rebuilt offline, not through HTTP/provider
 * delivery timers. The import marker records that this is authored history. */
export async function trafficActivitySources(plan:TrafficActivityPlan,catalog:CatalogSnapshot,mappingRevision:string):Promise<ActivitySource[]>{
 const grouped=new Map<string,ActivityVisit>();for(const visit of plan.visits)if(!grouped.has(visit.templateKey))grouped.set(visit.templateKey,visit);
 const policies=farePoliciesForFixture(catalog.fixtureVersion),recordCache=new Map<string,RawProviderRecord>(),rejectedSources=new Set<string>();
 const bundle=fixtureBundles.find(b=>b.identity.fixtureVersion===catalog.fixtureVersion);
 const legacyHotels=bundle?.hotels.filter(h=>h.destinationCityId==='mashhad');
 const legacyIds=new Set(legacyHotels?.map(h=>h.hotelId));
 const hotelDefinition=realHotelInventory({fixtureVersion:catalog.fixtureVersion,destinationCityId:'mashhad'})??(bundle&&legacyHotels?{sourceRevision:bundle.sourceRevision,hotels:legacyHotels,templates:bundle.roomRateTemplates.filter(r=>legacyIds.has(r.hotelId)).map(r=>({id:r.roomRateId,hotelId:r.hotelId,payload:r}))}:undefined);
 if(!hotelDefinition)throw new Error('Activity history requires current property inventory');
 const build=(visit:ActivityVisit):ActivitySource=>{
  const observedAt=new Date(Math.floor(visit.at.getTime()/600000)*600000),instant=observedAt.toISOString(),day=localDateAt(instant,'Asia/Tehran');
  const searchId=activityId('search',visit.templateKey),quoteId=activityId('hotel-quote',visit.templateKey);
  if(visit.kind==='hotel'){
   const query:HotelSearchQuery={destinationCityId:'mashhad',checkIn:parseDate(day).add({days:3}).toString(),checkOut:parseDate(day).add({days:4}).toString(),party:{adults:1,children:0,infants:0},rooms:1,sort:'cheapest'};
   for(const template of hotelDefinition.templates){
    const item=materializeStoredHotelRate(template.payload,instant,'Asia/Tehran');
    if(item.rate.providerId!==visit.providerId||item.rate.maxAdults!==1)continue;
    const allocation=[{roomNumber:1,roomRateId:item.rate.roomRateId,adults:1,children:0,infants:0}];
    const priced=priceStay(query,allocation,[item.rate],{[item.rate.roomRateId]:item.policy},{quoteId,observedAt:instant,fixtureVersion:catalog.fixtureVersion,mappingRevision,sourceRevision:hotelDefinition.sourceRevision});
    if(priced.status!=='priced')continue;
    const hotel=hotelDefinition.hotels.find(h=>h.hotelId===priced.quote.hotelId)!;
    const snapshot=HotelSearchSnapshotSchema.parse({hotelSearchId:searchId,query,status:'complete',hotels:[hotel],quotes:[priced.quote],observedAt:instant,sourceRevision:hotelDefinition.sourceRevision});
    return {key:visit.templateKey,searchId,query,payload:{kind:'hotel' as const,quote:priced.quote},snapshot};
   }
   throw new Error('No eligible room source for activity provider');
  }
  const connections=catalog.supportedConnections.filter(c=>c.mode===visit.mode&&c.originCityId==='tehran');
  const choice=parseInt(visit.templateKey.slice(-6),16)%connections.length;
  for(let offset=0;offset<connections.length;offset++){
   const index=(choice+offset)%connections.length,connection=connections[index]!,tripType=index%4===0?'round-trip' as const:'one-way' as const;
   const query:TransportSearchQuery={...connection,tripType,departureDate:parseDate(day).add({days:5}).toString(),...(tripType==='round-trip'?{returnDate:parseDate(day).add({days:9}).toString()}:{}),party:{adults:1,children:0,infants:0},classCode:visit.mode==='flight'?'economy':visit.mode==='train'?'seat':'standard',filters:{},sort:'cheapest'};
   const cacheKey=JSON.stringify([visit.providerId,day,query]);if(rejectedSources.has(cacheKey))continue;
   const cached=recordCache.get(cacheKey),input:FixtureQuery={fixtureVersion:catalog.fixtureVersion,seed:73,anchorInstant:instant,scenario:'normal',scenarioRevision:'scenario-v1',mappingRevision,query};
   // Legacy fixtures intentionally include unresolved aliases. Choose another
   // eligible authored record/route; never invent a mapping or weaken validation.
   for(const original of cached?[cached]:generateProviderRecords(input,visit.providerId)){
    const raw={...original,rawRecordId:activityId('raw',visit.templateKey),observedAt:instant};
    const decoded=decodeRawRecord(raw),normalized=normalizeRecord(decoded,{query,catalog,mappingRevision,aliases:[],realClock:{now:()=>observedAt}});
    if(!normalized.offer||!normalized.source)continue;
    const context:ComparisonContext={realClock:{now:()=>observedAt},places:catalog.places,policiesByProviderId:policies,sourceByOfferId:{[normalized.offer.offerId]:{rawRecordId:raw.rawRecordId,source:normalized.source}}};
    const group=groupOffers([normalized.offer],query,context)[0],quote=group?.eligibleQuotes[0];if(!quote||!group)continue;
    recordCache.set(cacheKey,original);
    const snapshot=SearchSnapshotSchema.parse({searchId,clientGeneration:activityId('generation',visit.templateKey),query,status:'complete',groups:[group],providerStatuses:[{providerId:visit.providerId,status:'complete',offerCount:1}],coverage:{expectedProviderIds:[visit.providerId],successfulProviderIds:[visit.providerId],failedProviderIds:[],pendingProviderIds:[],complete:true},observedAt:instant});
    return {key:visit.templateKey,searchId,query,payload:{kind:'transport' as const,quote,itinerary:group.itinerary},snapshot,raw,trace:normalized.trace,offer:normalized.offer,fareSource:normalized.source};
   }
   rejectedSources.add(cacheKey);
  }
  throw new Error('No eligible activity source for provider and mode');
 };
 const sources:ActivitySource[]=[];
 for(const visit of grouped.values()){
  // Source preparation is deliberately outside the write transaction. Yield
  // between bounded chunks so other requests can finish session authentication.
  if(sources.length%32===0)await setImmediate();
  sources.push(build(visit));
 }
 return sources;
}
