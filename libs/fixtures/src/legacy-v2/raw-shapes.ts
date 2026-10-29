import type { JourneyLeg } from '@torob-ticket/contracts';
export interface AuthoredRecord {
  serviceKey:string; outbound:JourneyLeg; inbound?:JourneyLeg;
  originAlias:string; destinationAlias:string; classCode:string;
  value:number; unit:string; mandatoryFees:number|null; baggageKg:number|null;
  refundable:boolean|null; available:boolean; seats:number; party:{adults:number;children:number;infants:number};
  materialTerms?:string[];
  revision:{fixtureVersion:string;mappingRevision:string;sourceRevision:string};
}
/** Six source dialects, not a decoder or normalizer. Null remains unknown evidence. */
export function rawShape(provider:number,r:AuthoredRecord):unknown {
  switch(provider) {
    case 1:return {schema:'p01/v1',service:r.serviceKey,itinerary:{outbound:r.outbound,return:r.inbound},fare:{amount:r.value,currency:r.unit,mandatory:r.mandatoryFees,class:r.classCode},terms:{bag:r.baggageKg,refund:r.refundable,materialTerms:r.materialTerms},inventory:{available:r.available,seats:r.seats},passengers:r.party,labels:[r.originAlias,r.destinationAlias],revision:r.revision};
    case 2:return {format:'p02/1',ticket_id:r.serviceKey,trips:[r.outbound,...r.inbound?[r.inbound]:[]],ticket:{price:String(r.value),unit:r.unit,tax:r.mandatoryFees,cabin:r.classCode,luggage:r.baggageKg,cancellable:r.refundable,conditions:r.materialTerms},stock:r.available?r.seats:0,party:r.party,from_name:r.originAlias,to_name:r.destinationAlias,version:r.revision};
    case 3:return {dialect:'p03',key:r.serviceKey,journeys:{go:r.outbound,back:r.inbound},cost:{payable:r.value,moneyUnit:r.unit,fees:r.mandatoryFees},options:{classCode:r.classCode,checkedKg:r.baggageKg,refundAllowed:r.refundable,materialTerms:r.materialTerms},sale:{open:r.available,remaining:r.seats},travelers:r.party,names:{origin:r.originAlias,destination:r.destinationAlias},evidence:r.revision};
    case 4:return {schemaVersion:1,reference:r.serviceKey,legs:[{direction:'OUT',journey:r.outbound},...r.inbound?[{direction:'IN',journey:r.inbound}]:[]],pricing:[{value:r.value,unit:r.unit,mandatoryFees:r.mandatoryFees}],rules:{class:r.classCode,bagKg:r.baggageKg,refundable:r.refundable,materialTerms:r.materialTerms},availability:{enabled:r.available,count:r.seats},counts:r.party,cityAliases:[r.originAlias,r.destinationAlias],source:r.revision};
    case 5:return {api:'five-v1',service_ref:r.serviceKey,services:{out:r.outbound,in:r.inbound},payment:{total:String(r.value),denomination:r.unit,mandatory_charge:r.mandatoryFees},conditions:{seat_class:r.classCode,baggage:r.baggageKg,cancel:r.refundable,materialTerms:r.materialTerms},capacity:{saleable:r.available,seats:r.seats},group:r.party,endpoints:[r.originAlias,r.destinationAlias],revisions:r.revision};
    case 6:return {type:'six.inventory',id:r.serviceKey,route:{forward:r.outbound,reverse:r.inbound},amounts:{gross:r.value,unitAlias:r.unit,charges:r.mandatoryFees},attributes:[{class:r.classCode,luggageKg:r.baggageKg,refund:r.refundable,materialTerms:r.materialTerms}],remaining:r.available?r.seats:0,partyCounts:r.party,placeNames:[r.originAlias,r.destinationAlias],meta:r.revision};
    default:throw new RangeError('Unknown fictional provider');
  }
}
