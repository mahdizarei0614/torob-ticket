import type {ApiClient} from '@torob-ticket/client';
import type {SearchRecovery,ReferralReceipt,Hotel,QuoteSnapshot,Itinerary} from '@torob-ticket/contracts';
import type {HotelRestore} from '../hotels/use-hotel-discovery';
import {canonical,sameLineage,complete,type ReferralPayload} from './referral-facts';
import {serializeSearchUrl} from '../search/search-url';
import type {ReturnCheckpoint} from './return-checkpoint';
export interface HydratedReturn {checkpoint:ReturnCheckpoint;recovery:SearchRecovery;hotel?:HotelRestore;hotelMetadata?:Hotel;transportReceipt?:ReferralReceipt;hotelReceipt?:ReferralReceipt;transportOrigin?:{quote:QuoteSnapshot;itinerary:Itinerary}}
function eventLineage(origin:ReferralPayload,receipt:ReferralReceipt){
 const at=Date.parse(receipt.confirmedAt);return receipt.selection.kind===receipt.payload.kind&&receipt.selection.quoteId===receipt.payload.quote.quoteId&&receipt.selection.quoteVersion===receipt.payload.quote.version&&receipt.handoffPath===`/provider-demo/${receipt.referralId}`&&at<=Date.now()&&complete(receipt.payload,at)&&(sameLineage(origin,receipt.payload)||canonical(origin)===canonical(receipt.payload));
}
/** Every price/condition comes from a cookie-scoped GET. Storage supplies IDs and reversible UI intent only. */
export async function hydrateReturn(checkpoint:ReturnCheckpoint,receipt:ReferralReceipt,client:ApiClient,signal?:AbortSignal):Promise<HydratedReturn>{
 const fail=()=>{throw Error('return-evidence-unavailable');};
 if(checkpoint.referralId!==receipt.referralId)fail();
 const recovery=await client.snapshot(checkpoint.searchId,signal),snapshot=recovery.snapshot;
 if(snapshot.searchId!==checkpoint.searchId||snapshot.clientGeneration!==checkpoint.generation||recovery.sequence!==checkpoint.adoptedSequence||serializeSearchUrl(snapshot.query)!==checkpoint.returnSearch)fail();
 const selection=checkpoint.selected;
 if(selection&&!snapshot.groups.some(g=>g.groupId===selection.groupId&&g.eligibleQuotes.some(q=>q.quoteId===selection.quoteId&&q.version===selection.version)))fail();
 if(checkpoint.pinItineraryId&&!snapshot.groups.some(g=>g.itinerary.itineraryId===checkpoint.pinItineraryId))fail();
 if(checkpoint.direction==='return'&&!snapshot.groups.some(g=>g.itinerary.itineraryId===checkpoint.pinItineraryId&&g.itinerary.return))fail();
 const result:HydratedReturn={checkpoint,recovery};
 const transport=receipt.payload.kind==='transport'?receipt:checkpoint.transportReferralId?await client.getReferral(checkpoint.transportReferralId,signal):undefined;
 if(transport){
  if(transport.payload.kind!=='transport')fail();const payload=transport.payload;
  if(payload.kind!=='transport')return fail();
  const member=snapshot.groups.find(g=>canonical(g.itinerary)===canonical(payload.itinerary));const quote=member?.eligibleQuotes.find(q=>q.quoteId===payload.quote.quoteId);
  if(!quote||!member||!selection||selection.quoteId!==quote.quoteId||!eventLineage({kind:'transport',quote,itinerary:member.itinerary},transport))return fail();
  result.transportReceipt=transport;result.transportOrigin={quote,itinerary:member.itinerary};
 }
 const h=checkpoint.hotel;
 if(h?.hotelSearchId){
  const source=await client.getHotelSearch(h.hotelSearchId,signal);
  if(source.hotelSearchId!==h.hotelSearchId||source.query.destinationCityId!==snapshot.query.destinationCityId||canonical([source.query.party.adults,source.query.party.children,source.query.party.infants,source.query.party.infantAgesMonths])!==canonical([snapshot.query.party.adults,snapshot.query.party.children,snapshot.query.party.infants,snapshot.query.party.infantAgesMonths]))fail();
  const hotelReceipt=receipt.payload.kind==='hotel'?receipt:h.referralId?await client.getReferral(h.referralId,signal):undefined;
  let selected=h.selected?source.quotes.find(q=>q.quoteId===h.selected?.quoteId&&q.version===h.selected.version):undefined;
  if(hotelReceipt){
   const payload=hotelReceipt.payload;if(payload.kind!=='hotel')return fail();const origin=source.quotes.find(q=>q.quoteId===payload.quote.quoteId);
   if(!origin||!h.selected||h.selected.quoteId!==origin.quoteId||h.selected.version!==payload.quote.version||!eventLineage({kind:'hotel',quote:origin},hotelReceipt))return fail();
   selected=payload.quote;result.hotelReceipt=hotelReceipt;result.hotelMetadata=source.hotels.find(item=>item.hotelId===payload.quote.hotelId&&item.destinationCityId===payload.quote.query.destinationCityId);
  }
  if(h.selected&&!selected)fail();
  const draft=h.draft,q=source.query;
  const draftMatches=draft.arrivalConfirmed&&draft.checkIn===q.checkIn&&draft.checkOut===q.checkOut&&draft.rooms===q.rooms&&draft.sort===q.sort&&canonical(draft.childAges.map(Number))===canonical(q.childAgesAtCheckIn??[])&&canonical(draft.customPoint)===canonical(q.customPoint)&&draft.arrivalPlaceId===q.arrivalPlaceId;
  result.hotel={snapshot:source,draft,selected:draftMatches?selected:undefined,open:h.open,scrollTop:h.scrollTop,receipt:draftMatches?hotelReceipt:undefined};
 }else if(receipt.payload.kind==='hotel'||h?.selected)fail();
 return result;
}
