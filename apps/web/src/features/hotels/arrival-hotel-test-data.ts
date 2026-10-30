import type {CatalogSnapshot,HotelSearchQuery,HotelSearchSnapshot,Itinerary} from '@torob-ticket/contracts';
import {catalog,query} from '../search/search-test-data';
import {group} from '../results/results-test-data';
import {hotelFixture,hotelQuote} from './hotel-test-data';
import {tripKey,type HotelTrip} from './hotel-state';
export const arrivalCatalog:CatalogSnapshot={...catalog,places:[{id:'MHD',cityId:'b',kind:'airport',name:'فرودگاه رسیدن',code:'MHD',point:{latitude:30,longitude:50},timeZone:'Asia/Tehran'}]};
export function arrivingTrip(arrivalAt='2026-10-25T07:30:00.000Z',id='arrival'):HotelTrip{
 const itinerary:Itinerary={...group(id).itinerary,outbound:{segments:[{...group(id).itinerary.outbound.segments[0]!,arrivalAt}],stops:[]}};
 return {query,draftKey:tripKey(query),available:true,itinerary};
}
export function arrivalSnapshot(input:HotelSearchQuery,now=Date.now()):HotelSearchSnapshot{
 const hotels=['hotel-a','hotel-b'].map((id,index)=>({...hotelFixture,hotelId:id,name:`اقامتگاه ${index+1}`,stars:index+3}));
 const quotes=hotels.map((hotel,index)=>{
  const q=hotelQuote(now);
  return {...q,quoteId:hotel.hotelId+'-quote',hotelId:hotel.hotelId,query:input,total:{...q.total,amountRial:(index+1)*10000000},breakdown:[{code:'stay',mandatory:true,amount:{...q.total,amountRial:(index+1)*10000000}}],roomAllocation:[{...q.roomAllocation[0]!,adults:input.party.adults}],roomDetails:[q.roomDetails![0]!]};
 });
 return {hotelSearchId:'arrival-search',query:input,status:'complete',hotels,quotes,results:hotels.map((hotel,index)=>({hotelId:hotel.hotelId,status:'priced',reasons:[],representativeQuoteId:quotes[index]!.quoteId,quoteIds:[quotes[index]!.quoteId],arrivalDistanceKm:index+1,locationDistanceKm:input.customPoint?index+2:null,distanceKind:'straight-line'})),observedAt:new Date(now).toISOString()};
}
