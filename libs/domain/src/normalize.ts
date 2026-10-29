import { comparisonId } from './comparison/itinerary-key';
import { isSupportedSegmentMode } from './comparison/round-trip';
import { NormalizedOfferSchema, type FareConditions, type NormalizationTrace } from '@torob-ticket/contracts';
import { resolveAlias } from './aliases';
import { normalizeMoney } from './money';
import { localDateAt } from './time';
import type { DecodedProviderRecord, NormalizationContext, NormalizationResult } from './normalization-types';
export function normalizeRecord(r:DecodedProviderRecord,c:NormalizationContext):NormalizationResult {
  const trace:NormalizationTrace={traceId:`trace-${r.raw.rawRecordId}`,rawRecordId:r.raw.rawRecordId,mappingRevision:c.mappingRevision,outcome:'accepted',decisions:[],issues:[],observedAt:c.realClock.now().toISOString()};
  const decision=(field:string,ruleCode:string,sourceValue:unknown,normalizedValue?:unknown)=>trace.decisions.push({fieldPath:field.split('.'),ruleCode,sourceValue,...(normalizedValue===undefined?{}:{normalizedValue})});
  const reject=(code:string,field:string|(string|number)[],outcome:'rejected'|'ambiguous'='rejected'):NormalizationResult=>{
    trace.outcome=outcome; trace.issues.push({code,fieldPath:typeof field==='string'?field.split('.'):field,severity:outcome,rawRecordId:r.raw.rawRecordId}); return {trace};
  };
  decision('source','source-provenance',{sourceRawRecordId:r.sourceRawRecordId,sourceRevision:r.sourceRevision,fixtureVersion:r.fixtureVersion,mappingRevision:r.mappingRevision});
  if(r.fixtureVersion!==r.raw.fixtureVersion||r.fixtureVersion!==c.catalog.fixtureVersion||r.mappingRevision!==c.mappingRevision) return reject('REVISION_MISMATCH','source');
  for(const [field,value,expected] of [['originAlias',r.originAlias,c.query.originCityId],['destinationAlias',r.destinationAlias,c.query.destinationCityId]] as const) {
    const ids=resolveAlias(value,r.raw.sourceNamespace,'city',c.catalog.cities,c.aliases);
    decision(field,'namespace-city-resolution',value,ids);
    if(ids.length>1) return reject('AMBIGUOUS_ALIAS',field,'ambiguous');
    if(ids.length!==1||ids[0]!==expected) return reject('UNRESOLVED_IDENTITY',field);
  }
  if((c.query.tripType==='round-trip')!==Boolean(r.inbound)) return reject('INCOMPLETE_ITINERARY','inbound');
  if(!c.catalog.classChoices.some(k=>k.mode===c.query.mode&&k.code===r.classCode)) return reject('UNKNOWN_CLASS','classCode');
  const legs=[r.outbound,...r.inbound?[r.inbound]:[]];
  for(const [index,leg] of legs.entries()) {
    const origin=index===0?c.query.originCityId:c.query.destinationCityId;
    const destination=index===0?c.query.destinationCityId:c.query.originCityId;
    for(const [segmentIndex,segment] of leg.segments.entries()) {
      const previous=leg.segments[segmentIndex-1];
      if(!isSupportedSegmentMode(leg,c.query.mode,segmentIndex,c.catalog.places)) return reject('UNSUPPORTED_SEGMENT_MODE','outbound.segments');
      if(previous&&(previous.destinationPlaceId!==segment.originPlaceId||Date.parse(previous.arrivalAt)>Date.parse(segment.departureAt))) return reject('DISCONTINUOUS_JOURNEY','outbound.segments');
      const from=c.catalog.places.find(p=>p.id===segment.originPlaceId);
      const to=c.catalog.places.find(p=>p.id===segment.destinationPlaceId);
      if(!from||!to||from.timeZone!==segment.departureTimeZone||to.timeZone!==segment.arrivalTimeZone) return reject('UNKNOWN_PLACE_OR_ZONE','outbound.segments');
    }
    const first=leg.segments[0]!; const last=leg.segments.at(-1)!;
    if(c.catalog.places.find(p=>p.id===first.originPlaceId)?.cityId!==origin||c.catalog.places.find(p=>p.id===last.destinationPlaceId)?.cityId!==destination) return reject('ENDPOINT_MISMATCH','outbound');
    if(localDateAt(first.departureAt,first.departureTimeZone)!==(index===0?c.query.departureDate:c.query.returnDate)) return reject('DATE_MISMATCH','outbound');
    decision(index===0?'outbound':'inbound','preserve-supplied-schedule',leg,leg);
  }
  if(r.inbound && Date.parse(r.inbound.segments[0]!.departureAt)<Date.parse(r.outbound.segments.at(-1)!.arrivalAt)) {
    return reject('RETURN_BEFORE_OUTBOUND_ARRIVAL',['inbound','segments',0,'departureAt']);
  }
  const unit=r.unit==='IRR'||r.unit==='ریال'?'IRR':r.unit==='TOMAN'||r.unit==='تومان'?'TOMAN':undefined;
  if(!unit) return reject('AMBIGUOUS_MONEY_UNIT','unit');
  try {
    const total=normalizeMoney(r.amount,unit);
    const fee=r.mandatoryCharge===null?null:normalizeMoney(r.mandatoryCharge,unit);
    if(fee&&fee.amountRial>total.amountRial) return reject('CHARGE_EXCEEDS_GROSS','mandatoryCharge');
    decision('amount','whole-party-gross-to-rials',{value:r.amount,unit:r.unit},total);
    decision('mandatoryCharge',fee?'included-charge-not-added':'unknown-mandatory-charge',r.mandatoryCharge,fee);
    const unknown={status:'unknown' as const,reason:'not-supplied'};
    const conditions:FareConditions['outbound']={classCode:r.classCode,checkedBaggageKg:r.baggageKg===null?unknown:{status:'known',value:r.baggageKg},cabinBaggageKg:unknown,refundable:r.refundable===null?unknown:{status:'known',value:r.refundable},cancellation:unknown,seatOrBerth:unknown,materialTerms:[...(r.materialTerms??[])]};
    decision('conditions','preserve-known-and-unknown',{classCode:r.classCode,baggageKg:r.baggageKg,refundable:r.refundable},conditions);
    decision('inventory','preserve-source-stock',{available:r.available,seats:r.seats,party:r.party});
    const issues=r.mandatoryCharge===null?[{code:'INCOMPLETE_PRICE',fieldPath:['mandatoryCharge'],severity:'warning' as const,rawRecordId:r.raw.rawRecordId}]:[];
    trace.issues.push(...issues);
    const offer=NormalizedOfferSchema.parse({offerId:`offer-${r.raw.rawRecordId}`,providerId:r.raw.providerId,fareId:comparisonId('fare',{providerId:r.raw.providerId,sourceNamespace:r.raw.sourceNamespace,serviceKey:r.serviceKey,classCode:r.classCode}),itinerary:{itineraryId:r.serviceKey,mode:c.query.mode,originPlaceId:r.outbound.segments[0]!.originPlaceId,destinationPlaceId:r.outbound.segments.at(-1)!.destinationPlaceId,outbound:r.outbound,...r.inbound?{return:r.inbound}:{}},conditions:{outbound:conditions,...r.inbound?{return:conditions}:{}},total,breakdown:fee?[{code:'base',amount:{amountRial:total.amountRial-fee.amountRial,currency:'IRR'},mandatory:true},{code:'mandatory-charge',amount:fee,mandatory:true}]:[{code:'reported-gross',amount:total,mandatory:true}],completeness:fee?{status:'complete'}:{status:'incomplete',missing:['mandatory-charge']},eligibility:{status:'unknown',reasons:['fare-evaluation-required']},availability:{status:'known',value:r.available},observedAt:r.raw.observedAt,provenance:[{rawRecordId:r.raw.rawRecordId,sourceNamespace:r.raw.sourceNamespace,sourceValue:{sourceRawRecordId:r.sourceRawRecordId,payload:r.raw.payload},sourceRevision:r.sourceRevision,mappingRevision:c.mappingRevision,fixtureVersion:r.fixtureVersion}],issues});
    trace.offerId=offer.offerId;
    return {trace,offer,source:{sourceRawRecordId:r.sourceRawRecordId,sourceRevision:r.sourceRevision,party:r.party,seats:r.seats,pricingBasis:'whole-party-gross'}};
  } catch { return reject('INVALID_MONEY_OR_OFFER','amount'); }
}
