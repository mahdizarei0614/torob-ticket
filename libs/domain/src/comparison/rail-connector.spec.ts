import {expect,it} from 'vitest';
import {comparisonCase,caseContext} from '../testing/comparison-cases';
import {quoteOffer} from './quote-offer';
function suppliedRailConnection(){
 const c=comparisonCase('train'),first=c.offer.itinerary.outbound.segments[0]!;
 first.destinationPlaceId='mid';first.arrivalTimeZone='Asia/Tehran';first.arrivalAt='2026-10-24T22:30:00Z';
 c.offer.itinerary.outbound.segments.push(
  {...first,mode:'bus',segmentId:'connector',serviceId:'source-connector',operatorId:'connector-owner',originPlaceId:'mid',destinationPlaceId:'d2',departureAt:'2026-10-24T23:00:00Z',arrivalAt:'2026-10-24T23:30:00Z',arrivalTimeZone:'Asia/Dubai'},
  {...first,segmentId:'onward',serviceId:'source-onward-rail',operatorId:'onward-rail-owner',originPlaceId:'d2',destinationPlaceId:'d',departureAt:'2026-10-25T00:00:00Z',arrivalAt:'2026-10-25T00:30:00Z',departureTimeZone:'Asia/Dubai',arrivalTimeZone:'Asia/Dubai'},
 );
 c.offer.itinerary.outbound.stops=[
  {placeId:'mid',kind:'ground-transfer',vehicleChange:true,waitMinutes:30,arrivalAt:first.arrivalAt,departureAt:'2026-10-24T23:00:00Z'},
  {placeId:'d2',kind:'ground-transfer',vehicleChange:true,waitMinutes:30,arrivalAt:'2026-10-24T23:30:00Z',departureAt:'2026-10-25T00:00:00Z'},
 ];
 const context=caseContext(c);context.places=context.places.map(place=>({...place,kind:'station'}));
 return{c,context};
}
it('quotes one complete supplied rail itinerary including a declared station connector without recomputing its gross',()=>{
 const {c,context}=suppliedRailConnection(),before=JSON.stringify(c.offer),result=quoteOffer(c.offer,c.query,context);
 expect(result.status).toBe('eligible');if(result.status==='eligible'){expect(result.quote.total).toEqual(c.offer.total);expect(result.quote.providerId).toBe(c.offer.providerId);expect(result.quote.provenance).toEqual(c.offer.provenance);}
 expect(JSON.stringify(c.offer)).toBe(before);
});
it.each(['missing-entry','missing-exit','dwell','no-change','wrong-wait','wrong-stamp','disconnected','reverse-time','airport','terminal','unknown-kind','source-missing'] as const)('rejects an undeclared or unbound rail road connector: %s',cause=>{
 const {c,context}=suppliedRailConnection(),leg=c.offer.itinerary.outbound;
 if(cause==='missing-entry')leg.stops.shift();if(cause==='missing-exit')leg.stops.pop();
 if(cause==='dwell')leg.stops[1]!.kind='dwell';if(cause==='no-change')leg.stops[0]!.vehicleChange=false;
 if(cause==='wrong-wait')leg.stops[1]!.waitMinutes=31;if(cause==='wrong-stamp')leg.stops[0]!.departureAt='2026-10-24T23:01:00Z';
 if(cause==='disconnected')leg.segments[1]!.originPlaceId='o';if(cause==='reverse-time')leg.segments[1]!.departureAt='2026-10-24T22:29:00Z';
 if(cause==='airport'||cause==='terminal'||cause==='unknown-kind')context.places=context.places.map(place=>place.id==='d2'?{...place,kind:cause==='unknown-kind'?undefined:cause}:place);
 if(cause==='source-missing')context.sourceByOfferId={};
 expect(quoteOffer(c.offer,c.query,context).status).toBe('rejected');
});
it.each(['first','last','main-bus','foreign-flight'] as const)('keeps unrelated mixed-mode packaging outside the new rail exception: %s',cause=>{
 const {c,context}=suppliedRailConnection(),leg=c.offer.itinerary.outbound;
 if(cause==='first')leg.segments[0]!.mode='bus';if(cause==='last')leg.segments[2]!.mode='bus';
 if(cause==='main-bus'){c.query.mode='bus';c.offer.itinerary.mode='bus';}
 if(cause==='foreign-flight')leg.segments[1]!.mode='flight';
 expect(quoteOffer(c.offer,c.query,context).status).toBe('rejected');
});
