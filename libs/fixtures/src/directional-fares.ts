import {createHash} from 'node:crypto';
import type {TransportSearchQuery} from '@torob-ticket/contracts';
import {adultFareRial} from './catalog/pricing';
import {servicesPerRoute} from './schedules';

/** Some supplied services share a route; others use a different return service family. */
export function directionalReturnVariant(variant:number):number {
 return variant%3===0?variant:(variant+1)%servicesPerRoute;
}
function dayFactor(seed:number,mode:TransportSearchQuery['mode'],from:string,to:string,date:string):number {
 const hash=createHash('sha256').update(JSON.stringify([seed,mode,from,to,date])).digest('hex');
 // A bounded authored calendar-demand band, not live price movement or a conversion rate.
 return (90+Number.parseInt(hash.slice(0,8),16)%25)/100;
}
/** One source-owned complete fare. This never joins independently offered seller quotes. */
export function directionalRoundTripGross(query:TransportSearchQuery,variant:number,inboundVariant:number,seed:number):number {
 if(!query.returnDate)throw new RangeError('Complete return date required');
 const returning:TransportSearchQuery={...query,tripType:'one-way',originCityId:query.destinationCityId,destinationCityId:query.originCityId,departureDate:query.returnDate};
 delete returning.returnDate;
 const outbound=adultFareRial(query,variant)*dayFactor(seed,query.mode,query.originCityId,query.destinationCityId,query.departureDate);
 const inbound=adultFareRial(returning,inboundVariant)*dayFactor(seed,query.mode,query.destinationCityId,query.originCityId,query.returnDate);
 return (outbound+inbound)*.94;
}
