import {describe,it,expect} from 'vitest';
import type {Itinerary,ReferralReceipt,QuoteSnapshot} from '@torob-ticket/contracts';
import {createMapState,mapReducer,mapView,type MapContext,type MapInspection} from './map-state';
import {query} from '../search/search-test-data';
import {group,observedAt} from '../results/results-test-data';
const owner={generation:'g',searchId:'s'};const now=Date.parse(observedAt)+1000;
const context:MapContext={draft:query,committed:query,...owner,current:true,revision:1,cause:'search'};
// Constructed canonical public DTOs, not provider/live inventory: same endpoints, different ordered connections.
function via(id:string,middle:string):Itinerary {
 const base=group(id).itinerary;const first=base.outbound.segments[0]!;
 return {...base,outbound:{segments:[{...first,segmentId:id+'-1',destinationPlaceId:middle,arrivalAt:'2026-10-25T07:00:00.000Z'},{...first,segmentId:id+'-2',originPlaceId:middle,departureAt:'2026-10-25T07:20:00.000Z',arrivalAt:'2026-10-25T08:30:00.000Z'}],stops:[{placeId:middle,kind:'connection',waitMinutes:20,vehicleChange:true,arrivalAt:'2026-10-25T07:00:00.000Z',departureAt:'2026-10-25T07:20:00.000Z'}]}};
}
const a=via('a','TBZ');const b=via('b','RAS');
const inspect=(itinerary:Itinerary):MapInspection=>({itinerary,query,owner});
describe('consumer map ownership and camera intent',()=>{
 it('initial accepted comparison stays illustrative',()=>{
  const state=createMapState(context);expect(mapView(state,now).itinerary).toBeUndefined();expect(mapView(state,now).progress).toBe(.35);
 });
 it('previews without refitting and restores the pinned itinerary after leave',()=>{
  let state=mapReducer(createMapState(context),{type:'pin',inspection:inspect(a)});const fit=state.fitEpoch;
  state=mapReducer(state,{type:'preview',inspection:inspect(b),owner});expect(mapView(state,now).itinerary?.itineraryId).toBe('b');expect(mapView(state,now).itinerary?.outbound.stops.map(stop=>stop.placeId)).toEqual(['RAS']);expect(state.fitEpoch).toBe(fit);
  state=mapReducer(state,{type:'preview',owner});expect(mapView(state,now).itinerary?.itineraryId).toBe('a');expect(mapView(state,now).itinerary?.outbound.stops.map(stop=>stop.placeId)).toEqual(['TBZ']);expect(state.fitEpoch).toBe(fit);
 });
 it('a preview cannot borrow selected-fare progress and original expiry revokes70 without losing inspected route',()=>{
  let state=mapReducer(createMapState(context),{type:'pin',inspection:inspect(a)});const quote=group('a').eligibleQuotes[0]!;
  state=mapReducer(state,{type:'selection',inspection:inspect(a),quote,owner});expect(mapView(state,now).progress).toBe(.7);
  state=mapReducer(state,{type:'preview',inspection:inspect(b),owner});expect(mapView(state,now).progress).toBe(.35);
  state=mapReducer(state,{type:'preview',owner});expect(mapView(state,now+600000).progress).toBe(.35);expect(mapView(state,now+600000).itinerary?.itineraryId).toBe('a');
 });
 it('refinement preserves a clearly historical pin/camera but history clears it even for matching endpoints',()=>{
  let state=mapReducer(createMapState(context),{type:'pin',inspection:inspect(a)});const fit=state.fitEpoch;
  state=mapReducer(state,{type:'context',context:{...context,draft:{...query,sort:'fastest'},committed:{...query,sort:'fastest'},generation:'new',searchId:undefined,current:false,revision:2,cause:'refine'}});
  expect(state.fitEpoch).toBe(fit);expect(mapView(state,now)).toMatchObject({historical:true,progress:0});
  state=mapReducer(state,{type:'context',context:{...context,generation:'restore',revision:3,cause:'restore'}});expect(mapView(state,now).itinerary).toBeUndefined();
 });
 it('rejects old operations, clears inspection after draft edits, and permits a fresh explicit current pin',()=>{
  let state=mapReducer(createMapState(context),{type:'pin',inspection:inspect(a)});
  state=mapReducer(state,{type:'context',context:{...context,draft:{...query,party:{adults:2,children:0,infants:0}},revision:2,cause:'edit'}});expect(mapView(state,now).itinerary).toBeUndefined();expect(mapView(state,now).progress).toBe(0);
  state=mapReducer(state,{type:'pin',inspection:inspect(a)});expect(mapView(state,now).itinerary?.itineraryId).toBe('a');
  state=mapReducer(state,{type:'context',context:{...context,generation:'other',revision:3,cause:'restore'}});state=mapReducer(state,{type:'preview',inspection:inspect(b),owner});expect(mapView(state,now).itinerary).toBeUndefined();
 });
 it('only matching actual confirmed receipt completes; selection and changed/failed checks cannot fabricate100',()=>{
  const quote=group('a').eligibleQuotes[0]!;let state=mapReducer(createMapState(context),{type:'pin',inspection:inspect(a)});state=mapReducer(state,{type:'selection',inspection:inspect(a),quote,owner});
  const receipt:ReferralReceipt={referralId:'r',intentId:'i',selection:{kind:'transport',quoteId:quote.quoteId,quoteVersion:quote.version},payload:{kind:'transport',quote,itinerary:a},confirmedAt:new Date(now).toISOString(),handoffPath:'/provider-demo/r'};
  state=mapReducer(state,{type:'confirm',receipt:{...receipt,selection:{...receipt.selection,quoteVersion:2}} as ReferralReceipt,owner,now});expect(mapView(state,now).progress).toBe(.7);
  state=mapReducer(state,{type:'confirm',receipt,owner,now});expect(mapView(state,now).progress).toBe(1);
 });
 it('accepts a genuine matching event confirmed within the bound quote window even when delivered after expiry',()=>{
  const quote=group('a').eligibleQuotes[0]!;let state=mapReducer(createMapState(context),{type:'pin',inspection:inspect(a)});
  state=mapReducer(state,{type:'selection',inspection:inspect(a),quote,owner});
  state=mapReducer(state,{type:'selection',owner});expect(mapView(state,now+600000).progress).toBe(.35);
  const receipt:ReferralReceipt={referralId:'r',intentId:'i',selection:{kind:'transport',quoteId:quote.quoteId,quoteVersion:quote.version},payload:{kind:'transport',quote,itinerary:a},confirmedAt:new Date(now).toISOString(),handoffPath:'/provider-demo/r'};
  state=mapReducer(state,{type:'confirm',receipt,owner,now:now+600000});expect(mapView(state,now+600000).progress).toBe(1);
 });
 it('rejects originally ineligible/incomplete quotes, future events and receipt itinerary or owner substitutions',()=>{
  const quote=group('a').eligibleQuotes[0]!;
  const incomplete={...quote,completeness:{status:'incomplete',missing:['taxes']}} as QuoteSnapshot;
  const ineligible={...quote,eligibility:{status:'ineligible',reasons:['unavailable']}} as QuoteSnapshot;
  const unknown={...quote,eligibility:{status:'unknown',reasons:['unavailable']}} as QuoteSnapshot;
  for(const bound of [quote,incomplete,ineligible,unknown]) {
   let state=mapReducer(createMapState(context),{type:'pin',inspection:inspect(a)});state=mapReducer(state,{type:'selection',inspection:inspect(a),quote:bound,owner});
   const receipt:ReferralReceipt={referralId:'r',intentId:'i',selection:{kind:'transport',quoteId:bound.quoteId,quoteVersion:bound.version},payload:{kind:'transport',quote:bound,itinerary:a},confirmedAt:new Date(now+1).toISOString(),handoffPath:'/provider-demo/r'};
   expect(mapView(mapReducer(state,{type:'confirm',receipt,owner,now}),now).progress).not.toBe(1);
   expect(mapView(mapReducer(state,{type:'confirm',receipt:{...receipt,payload:{kind:'transport',quote:bound,itinerary:b}},owner,now:now+2}),now+2).progress).not.toBe(1);
   expect(mapView(mapReducer(state,{type:'confirm',receipt,owner:{generation:'other',searchId:'s'},now:now+2}),now+2).progress).not.toBe(1);
   if(bound!==quote)expect(mapView(mapReducer(state,{type:'confirm',receipt,owner,now:now+2}),now+2).progress).not.toBe(1);
  }
 });
 it('requires explicit binding of an accepted changed quote version and evaluates its own extended deadline',()=>{
  const old=group('a').eligibleQuotes[0]!;const intent={groupId:'a',quoteId:old.quoteId,version:1};
  let state=mapReducer(createMapState(context),{type:'pin',inspection:inspect(a)});state=mapReducer(state,{type:'selection',inspection:inspect(a),quote:old,intent,owner});
  const fresh={...old,version:2,total:{...old.total,amountRial:12000000},observedAt:new Date(now+590000).toISOString(),expiresAt:new Date(now+1200000).toISOString()};
  const receipt:ReferralReceipt={referralId:'r',intentId:'i',selection:{kind:'transport',quoteId:fresh.quoteId,quoteVersion:2},payload:{kind:'transport',quote:fresh,itinerary:a},confirmedAt:new Date(now+610000).toISOString(),handoffPath:'/provider-demo/r'};
  expect(mapView(mapReducer(state,{type:'confirm',receipt,owner,now:now+610000}),now+610000).progress).toBe(.35);
  state=mapReducer(state,{type:'bind-rechecked',owner,previous:{quoteId:old.quoteId,version:1},quote:fresh,itinerary:a,now:now+600000});
  state=mapReducer(state,{type:'selection',owner,intent});expect(mapView(state,now+610000).progress).toBe(.7);
  expect(mapView(state,now+1200000).progress).toBe(.35);
  state=mapReducer(state,{type:'confirm',receipt,owner,now:now+1200001});expect(mapView(state,now+1200001).progress).toBe(1);
 });

 it('an unsearched draft cannot borrow comparison35 from old route, party, class or eligibility conditions',()=>{
  for(const patch of [{destinationCityId:'c'},{party:{adults:2,children:0,infants:0}},{classCode:'business'},{filters:{refundableOnly:true}}]) {
   const state=mapReducer(createMapState(context),{type:'context',context:{...context,draft:{...query,...patch},revision:2,cause:'edit'}});expect(mapView(state,now).progress).toBe(0);
   expect(mapView(mapReducer(state,{type:'preview',inspection:inspect(a),owner}),now).progress).toBe(.35);
  }
 });
 it('a different payload with the same itinerary ID cannot inherit the bound fare progress',()=>{
  const quote=group('a').eligibleQuotes[0]!;let state=mapReducer(createMapState(context),{type:'pin',inspection:inspect(a)});state=mapReducer(state,{type:'selection',inspection:inspect(a),quote,owner});
  state=mapReducer(state,{type:'preview',inspection:inspect({...b,itineraryId:a.itineraryId}),owner});expect(mapView(state,now).progress).toBe(.35);
 });

});
