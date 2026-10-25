import {describe,it,expect} from 'vitest';
import type {ReferralReceipt} from '@torob-ticket/contracts';
import {createMapState,mapReducer,mapView} from '../map/map-state';
import {createHotelState,hotelReducer,tripKey} from '../hotels/hotel-state';
import {hotelSnapshot} from '../hotels/hotel-test-data';
import {catalog,query} from '../search/search-test-data';
import {group} from '../results/results-test-data';
const now=Date.now(),owner={generation:'g',searchId:'s'};
describe('explicit accepted and historical referral seams',()=>{
 it('rehydrates an actual confirmed transport event after expiry without making a fresh action valid',()=>{
  const g=group('a'),origin=g.eligibleQuotes[0]!;origin.observedAt=new Date(now-700000).toISOString();origin.expiresAt=new Date(now-100000).toISOString();
  const fresh={...origin,version:2};const receipt:ReferralReceipt={referralId:'r',intentId:'i',selection:{kind:'transport',quoteId:fresh.quoteId,quoteVersion:2},payload:{kind:'transport',quote:fresh,itinerary:g.itinerary},confirmedAt:new Date(now-200000).toISOString(),handoffPath:'/provider-demo/r'};
  const context={draft:query,committed:query,...owner,current:true,revision:1,cause:'search' as const};
  const state=mapReducer(createMapState(context),{type:'hydrate-receipt',owner,origin,itinerary:g.itinerary,receipt,now});
  expect(mapView(state,now)).toMatchObject({progress:1,selectedValid:false});expect(state.selection?.quote).toEqual(fresh);
  expect(mapReducer(createMapState(context),{type:'hydrate-receipt',owner,origin:{...origin,providerId:'other'},itinerary:g.itinerary,receipt,now}).receipt).toBeUndefined();
 });
 it('binds only the selected complete fresh hotel lineage and leaves the raw snapshot immutable',()=>{
  const snapshot=hotelSnapshot(now),original=snapshot.quotes[0]!;const trip={query,draftKey:tripKey(query),available:true};
  let state={...createHotelState(trip,catalog),status:'ready' as const,snapshot,selected:original};const raw=JSON.stringify(snapshot);
  const fresh={...original,version:2,total:{...original.total,amountRial:44000000},breakdown:[{...original.breakdown[0]!,amount:{amountRial:44000000,currency:'IRR' as const}}]};
  state=hotelReducer(state,{type:'bind-rechecked',previous:{quoteId:original.quoteId,version:1},quote:fresh,now}) as typeof state;
  expect(state.selected).toEqual(fresh);expect(JSON.stringify(snapshot)).toBe(raw);
  expect(hotelReducer(state,{type:'bind-rechecked',previous:{quoteId:original.quoteId,version:1},quote:{...fresh,version:3},now}).selected?.version).toBe(2);
  expect(hotelReducer(state,{type:'bind-rechecked',previous:{quoteId:original.quoteId,version:2},quote:{...fresh,version:3,hotelId:'other'},now}).selected?.version).toBe(2);
 });
});
