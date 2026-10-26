import {describe,it,expect,vi} from 'vitest';
import type {ApiClient} from '@torob-ticket/client';
import type {ReferralReceipt} from '@torob-ticket/contracts';
import {query} from '../search/search-test-data';
import {group,recovery} from '../results/results-test-data';
import {serializeSearchUrl} from '../search/search-url';
import {hotelSnapshot} from '../hotels/hotel-test-data';
import {hydrateReturn} from './return-hydration';
import type {ReturnCheckpoint} from './return-checkpoint';
function fixture(){const g=group('a'),r=recovery([g],2);const q=g.eligibleQuotes[0]!;const receipt:ReferralReceipt={referralId:'r',intentId:'i',selection:{kind:'transport',quoteId:q.quoteId,quoteVersion:2},payload:{kind:'transport',quote:{...q,version:2},itinerary:g.itinerary},confirmedAt:'2026-10-25T06:01:00.000Z',handoffPath:'/provider-demo/r'};const checkpoint:ReturnCheckpoint={version:1,referralId:'r',returnSearch:serializeSearchUrl(query),searchId:r.snapshot.searchId,generation:r.snapshot.clientGeneration,draft:query,adoptedSequence:2,frozen:true,dismissedSuggestion:true,selected:{groupId:g.groupId,quoteId:q.quoteId,version:q.version},pinItineraryId:g.itinerary.itineraryId,direction:'outbound',scrollY:350};const snapshot=vi.fn(async()=>r);const client={snapshot} as unknown as ApiClient;return {g,r,receipt,checkpoint,snapshot,client};}
describe('cookie-scoped return evidence hydration',()=>{
 it('restores UI intent only after matching GET evidence and preserves historical accepted receipt',async()=>{const f=fixture();const result=await hydrateReturn(f.checkpoint,f.receipt,f.client);expect(result.recovery).toBe(f.r);expect(result.transportReceipt).toBe(f.receipt);expect(result.transportOrigin?.quote.version).toBe(1);expect(f.snapshot).toHaveBeenCalledWith(f.checkpoint.searchId,undefined);});
 it('rejects a foreign/reset source instead of bootstrapping or starting a search',async()=>{const f=fixture();f.snapshot.mockRejectedValueOnce(Error('404'));await expect(hydrateReturn(f.checkpoint,f.receipt,f.client)).rejects.toThrow();expect(f.snapshot).toHaveBeenCalledTimes(1);});
 it('rejects schema-valid mismatched generation/query/sequence/selected membership',async()=>{for(const patch of [{generation:'foreign'},{adoptedSequence:9},{returnSearch:serializeSearchUrl({...query,sort:'fastest'})},{selected:{groupId:'foreign',quoteId:'foreign',version:1}}]){const f=fixture();await expect(hydrateReturn({...f.checkpoint,...patch},f.receipt,f.client)).rejects.toThrow();}});
 it('rejects a receipt for a different provider despite matching quote id',async()=>{const f=fixture();if(f.receipt.payload.kind!=='transport')throw Error('fixture');f.receipt.payload.quote.providerId='foreign';await expect(hydrateReturn(f.checkpoint,f.receipt,f.client)).rejects.toThrow();});
});

it('a valid scoped hotel event restores the exact stay while an edited or tampered draft revokes selected authority',async()=>{
 const f=fixture(),hotel=hotelSnapshot(),original=hotel.quotes[0]!,q={...query,party:hotel.query.party};f.r.snapshot.query=q;f.checkpoint.draft=q;f.checkpoint.returnSearch=serializeSearchUrl(q);f.g.eligibleQuotes[0]!.party=q.party;
 const fresh={...original,version:2};const receipt:ReferralReceipt={referralId:'r',intentId:'hotel-intent',selection:{kind:'hotel',quoteId:fresh.quoteId,quoteVersion:2},payload:{kind:'hotel',quote:fresh},confirmedAt:new Date(Date.now()+1).toISOString(),handoffPath:'/provider-demo/r'};
 receipt.confirmedAt=original.observedAt;
 const draft={checkIn:hotel.query.checkIn,checkOut:hotel.query.checkOut,rooms:hotel.query.rooms,childAges:[],arrivalConfirmed:true,sort:hotel.query.sort};
 f.checkpoint.hotel={open:true,stale:false,hotelSearchId:hotel.hotelSearchId,draft,selected:{quoteId:original.quoteId,version:2},scrollTop:180,referralId:'r'};
 const client={...f.client,getHotelSearch:vi.fn(async()=>hotel)} as unknown as ApiClient;
 const restored=await hydrateReturn(f.checkpoint,receipt,client);expect(restored.hotel?.selected).toEqual(fresh);expect(restored.hotel?.receipt).toBe(receipt);expect(restored.hotel?.tripItinerary).toEqual(f.g.itinerary);expect(restored.hotelMetadata?.hotelId).toBe(original.hotelId);
 f.checkpoint.hotel.draft={...draft,checkOut:'2026-10-29'};const edited=await hydrateReturn(f.checkpoint,receipt,client);expect(edited.hotel?.draft.checkOut).toBe('2026-10-29');expect(edited.hotel?.selected).toBeUndefined();expect(edited.hotel?.receipt).toBeUndefined();
});

it('preserves stale or unknown independent hotel evidence while revoking selected referral authority',async()=>{
 for(const stale of [true,undefined]){const f=fixture(),hotel=hotelSnapshot(),original=hotel.quotes[0]!,q={...query,party:hotel.query.party};f.r.snapshot.query=q;f.g.eligibleQuotes[0]!.party=q.party;f.checkpoint.draft=q;f.checkpoint.returnSearch=serializeSearchUrl(q);const fresh={...original,version:2};const receipt:ReferralReceipt={referralId:'r',intentId:'h',selection:{kind:'hotel',quoteId:fresh.quoteId,quoteVersion:2},payload:{kind:'hotel',quote:fresh},confirmedAt:fresh.observedAt,handoffPath:'/provider-demo/r'};
 f.checkpoint.hotel={open:true,stale,hotelSearchId:hotel.hotelSearchId,draft:{checkIn:hotel.query.checkIn,checkOut:hotel.query.checkOut,rooms:2,childAges:[],arrivalConfirmed:true,sort:'cheapest'},selected:{quoteId:fresh.quoteId,version:2},scrollTop:80};const client={...f.client,getHotelSearch:vi.fn(async()=>hotel)} as unknown as ApiClient;const result=await hydrateReturn(f.checkpoint,receipt,client);expect(result.recovery).toBe(f.r);expect(result.hotel?.snapshot).toBe(hotel);expect(result.hotel?.selected).toBeUndefined();expect(result.hotel?.receipt).toBeUndefined();expect(result.hotel?.contextBlocked).toBe(true);expect(result.hotelNotice).toBeTruthy();}
});
it('an optional hotel with another city, party or inaccessible scope cannot discard valid transport recovery',async()=>{
 for(const mismatch of ['city','party','foreign']){const f=fixture(),hotel=hotelSnapshot();const current={...query,party:{adults:mismatch==='party'?3:2,children:0,infants:0}};f.r.snapshot.query=current;f.g.eligibleQuotes[0]!.party=current.party;f.checkpoint.draft=current;f.checkpoint.returnSearch=serializeSearchUrl(current);
  const original=hotel.quotes[0]!,fresh={...original,version:2};const receipt:ReferralReceipt={referralId:'r',intentId:'h',selection:{kind:'hotel',quoteId:fresh.quoteId,quoteVersion:2},payload:{kind:'hotel',quote:fresh},confirmedAt:fresh.observedAt,handoffPath:'/provider-demo/r'};f.checkpoint.hotel={open:true,stale:false,hotelSearchId:hotel.hotelSearchId,draft:{checkIn:hotel.query.checkIn,checkOut:hotel.query.checkOut,rooms:2,childAges:[],arrivalConfirmed:true,sort:'cheapest'},selected:{quoteId:fresh.quoteId,version:2},scrollTop:80};
  if(mismatch==='city'){hotel.query={...hotel.query,destinationCityId:'c'};hotel.hotels[0]!.destinationCityId='c';hotel.quotes[0]!.query=hotel.query;}
  const client={...f.client,getHotelSearch:vi.fn(async()=>{if(mismatch==='foreign')throw Error('404');return hotel;})} as unknown as ApiClient;const result=await hydrateReturn(f.checkpoint,receipt,client);expect(result.recovery).toBe(f.r);expect(result.hotel).toBeUndefined();expect(result.hotelMetadata).toBeUndefined();expect(result.hotelNotice).toBeTruthy();expect(f.snapshot).toHaveBeenCalledTimes(1);
 }
});

it('an interacted but unsearched optional stay has an explicit hotel-only fallback',async()=>{const f=fixture();f.checkpoint.hotel={open:false,stale:false,draft:{checkIn:query.departureDate,checkOut:'',rooms:1,childAges:[],arrivalConfirmed:false,sort:'cheapest'},scrollTop:0};const result=await hydrateReturn(f.checkpoint,f.receipt,f.client);expect(result.recovery).toBe(f.r);expect(result.hotel).toBeUndefined();expect(result.hotelNotice).toBeTruthy();});
