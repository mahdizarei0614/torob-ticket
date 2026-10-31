import {StrictMode} from 'react';
import {act,renderHook,waitFor} from '@testing-library/react';
import {describe,it,expect,vi} from 'vitest';
import type {ApiClient} from '@torob-ticket/client';
import {HOTEL_DIRECTORY_SOURCE_REVISION,type HotelSearchQuery,type HotelSearchSnapshot,type ReferralReceipt} from '@torob-ticket/contracts';
import {useHotelDiscovery,type HotelDiscovery,type HotelRestore} from './use-hotel-discovery';
import {tripKey} from './hotel-state';
import {session,query} from '../search/search-test-data';
import {arrivalCatalog,arrivingTrip,arrivalSnapshot} from './arrival-hotel-test-data';
interface Pending {query:HotelSearchQuery;signal?:AbortSignal;resolve:(value:HotelSearchSnapshot)=>void;reject:(error:Error)=>void}
function setup(){const requests:Pending[]=[];const startHotelSearch=vi.fn((q:HotelSearchQuery,signal?:AbortSignal)=>new Promise<HotelSearchSnapshot>((resolve,reject)=>requests.push({query:q,signal,resolve,reject})));return {requests,startHotelSearch,client:{startHotelSearch} as unknown as ApiClient};}
async function open(result:{current:HotelDiscovery},mock:ReturnType<typeof setup>,count=1){act(()=>{result.current.openDialog();});await waitFor(()=>expect(mock.requests).toHaveLength(count));}
async function settle(mock:ReturnType<typeof setup>,index=0){await act(async()=>mock.requests[index]!.resolve(arrivalSnapshot(mock.requests[index]!.query)));}

describe('automatic hotel request and selection leases',()=>{
 it('opens directly into one automatic arrival-local one-night query without a setup/submit action',async()=>{const mock=setup(),trip=arrivingTrip('2026-10-25T22:00:00Z');const {result}=renderHook(()=>useHotelDiscovery({trip,catalog:arrivalCatalog,session,client:mock.client}));expect(mock.requests).toHaveLength(0);await open(result,mock);expect(mock.requests[0]!.query).toMatchObject({checkIn:'2026-10-26',checkOut:'2026-10-27',rooms:1,arrivalPlaceId:'MHD',sort:'cheapest'});await settle(mock);expect(result.current.state.status).toBe('ready');expect(result.current.selected).toBeUndefined();expect(mock.requests).toHaveLength(1);});
 it('waits for an actual current selected-ticket arrival instead of guessing or configuring it',async()=>{const mock=setup();const initial={query,draftKey:tripKey(query),available:false};const hook=renderHook(({trip})=>useHotelDiscovery({trip,catalog:arrivalCatalog,session,client:mock.client}),{initialProps:{trip:initial as ReturnType<typeof arrivingTrip>}});act(()=>hook.result.current.openDialog());await act(async()=>{});expect(mock.requests).toHaveLength(0);expect(hook.result.current.query).toBeUndefined();hook.rerender({trip:arrivingTrip()});await waitFor(()=>expect(mock.requests).toHaveLength(1));await settle(mock);expect(hook.result.current.stale).toBe(false);});
 it('admits one physical request under StrictMode and rejects captured actions across close/reopen',async()=>{const mock=setup();const {result}=renderHook(()=>useHotelDiscovery({trip:arrivingTrip(),catalog:arrivalCatalog,session,client:mock.client}),{wrapper:StrictMode});await open(result,mock);const old=result.current;act(()=>result.current.closeDialog());expect(mock.requests[0]!.signal?.aborted).toBe(true);await open(result,mock,2);act(()=>{void old.submit();old.closeDialog();old.openPoint();});expect(result.current.open).toBe(true);expect(result.current.state.point).toBeUndefined();await settle(mock,0);expect(result.current.state.snapshot).toBeUndefined();await settle(mock,1);expect(result.current.state.status).toBe('ready');expect(mock.requests).toHaveLength(2);});
 it('automatically aborts and rebinds a changed ticket arrival while ignoring the old response',async()=>{const mock=setup(),trip=arrivingTrip();const hook=renderHook(({trip})=>useHotelDiscovery({trip,catalog:arrivalCatalog,session,client:mock.client}),{initialProps:{trip}});await open(hook.result,mock);const old=hook.result.current;hook.rerender({trip:arrivingTrip('2026-10-26T22:00:00Z','new-ticket')});await waitFor(()=>expect(mock.requests).toHaveLength(2));expect(mock.requests[0]!.signal?.aborted).toBe(true);expect(mock.requests[1]!.query).toMatchObject({checkIn:'2026-10-27',checkOut:'2026-10-28',arrivalPlaceId:'MHD'});act(()=>{void old.changeSort('stars');old.selectHotel('hotel-a');});await settle(mock,0);expect(hook.result.current.state.snapshot).toBeUndefined();await settle(mock,1);expect(hook.result.current.state.snapshot?.query.checkIn).toBe('2026-10-27');expect(mock.requests).toHaveLength(2);});
 it('keeps the chosen hotel across ordering and binds only its newly returned current quote',async()=>{const mock=setup(),onSelect=vi.fn();const {result}=renderHook(()=>useHotelDiscovery({trip:arrivingTrip(),catalog:arrivalCatalog,session,client:mock.client,onSelectHotelQuote:onSelect}));await open(result,mock);await settle(mock);act(()=>result.current.selectHotel('hotel-b'));expect(result.current.selected?.hotelId).toBe('hotel-b');const oldLease=result.current.selectionLease()!;act(()=>{void result.current.changeSort('stars');});expect(mock.requests).toHaveLength(2);expect(result.current.state.selectedHotelId).toBe('hotel-b');expect(result.current.selected).toBeUndefined();expect(oldLease.isCurrent()).toBe(false);await settle(mock,1);expect(result.current.selected).toMatchObject({hotelId:'hotel-b',query:{sort:'stars'}});expect(onSelect.mock.calls.at(-1)?.[0]?.hotelId).toBe('hotel-b');act(()=>{void result.current.changeSort('stars');});expect(mock.requests).toHaveLength(2);});
 it('replaces pending capacity two with three, fences late responses and revokes old quote authority without multiplying prices',async()=>{
  const mock=setup(),trip=arrivingTrip(),onSelect=vi.fn(),intent=JSON.stringify(trip.query);
  const {result}=renderHook(()=>useHotelDiscovery({trip,catalog:arrivalCatalog,session,client:mock.client,onSelectHotelQuote:onSelect}));await open(result,mock);await settle(mock);act(()=>result.current.selectHotel('hotel-b'));
  const previous=result.current,lease=previous.selectionLease()!;act(()=>{void result.current.changeCapacity(2);});expect(mock.requests).toHaveLength(2);expect(lease.isCurrent()).toBe(false);expect(result.current.selected).toBeUndefined();expect(result.current.state.selectedHotelId).toBe('hotel-b');
  const pendingTwo=result.current;act(()=>{void result.current.changeCapacity(3);});expect(mock.requests).toHaveLength(3);expect(mock.requests[1]!.signal?.aborted).toBe(true);expect(mock.requests[2]!.query).toMatchObject({party:{adults:3,children:0,infants:0},rooms:1,checkIn:'2026-10-25',checkOut:'2026-10-26'});
  act(()=>{void previous.changeCapacity(1);void pendingTwo.changeCapacity(1);previous.selectHotel('hotel-a');});expect(mock.requests).toHaveLength(3);
  await settle(mock,1);expect(result.current.state.status).toBe('loading');expect(result.current.selected).toBeUndefined();expect(result.current.query?.party.adults).toBe(3);
  const response=arrivalSnapshot(mock.requests[2]!.query);response.quotes=response.quotes.map(quote=>({...quote,total:{amountRial:29000000,currency:'IRR'},breakdown:[{code:'stay',mandatory:true,amount:{amountRial:29000000,currency:'IRR'}}]}));
  await act(async()=>mock.requests[2]!.resolve(response));expect(result.current.selected).toMatchObject({hotelId:'hotel-b',total:{amountRial:29000000},query:{party:{adults:3}}});expect(result.current.selectionLease()?.isCurrent()).toBe(true);expect(JSON.stringify(trip.query)).toBe(intent);
  act(()=>{void result.current.changeCapacity(3);void result.current.changeCapacity(5);});expect(mock.requests).toHaveLength(3);
 });
 it('keeps an inspected hotel but removes its actionable quote when the requested capacity has no eligible room',async()=>{
  const mock=setup();const {result}=renderHook(()=>useHotelDiscovery({trip:arrivingTrip(),catalog:arrivalCatalog,session,client:mock.client}));await open(result,mock);await settle(mock);act(()=>result.current.selectHotel('hotel-b'));
  act(()=>{void result.current.changeCapacity(2);});const response=arrivalSnapshot(mock.requests[1]!.query);response.quotes=response.quotes.filter(quote=>quote.hotelId!=='hotel-b');response.results=response.results!.map(row=>row.hotelId==='hotel-b'?{...row,status:'ineligible',representativeQuoteId:null,quoteIds:[],reasons:['no-eligible-allocation']}:row);
  await act(async()=>mock.requests[1]!.resolve(response));expect(result.current.state.selectedHotelId).toBe('hotel-b');expect(result.current.selected).toBeUndefined();expect(result.current.selectionLease()).toBeUndefined();
  act(()=>result.current.selectHotel('hotel-a'));expect(result.current.selected?.query.party.adults).toBe(2);
 });
 it('cancels an aborted first-search point transaction without stranding discovery and chooses a map point atomically',async()=>{const mock=setup();const {result}=renderHook(()=>useHotelDiscovery({trip:arrivingTrip(),catalog:arrivalCatalog,session,client:mock.client}));await open(result,mock);act(()=>result.current.openPoint());expect(mock.requests[0]!.signal?.aborted).toBe(true);const oldPoint=result.current;act(()=>result.current.cancelPoint());await waitFor(()=>expect(mock.requests).toHaveLength(2));await settle(mock,1);act(()=>result.current.openPoint());act(()=>{void oldPoint.chooseLocation({latitude:20,longitude:20});});expect(result.current.state.draft.customPoint).toBeUndefined();act(()=>{void result.current.chooseLocation({latitude:30.1,longitude:50.2});});expect(mock.requests).toHaveLength(3);expect(mock.requests[2]!.query).toMatchObject({sort:'location-distance',customPoint:{latitude:30.1,longitude:50.2},checkOut:'2026-10-26'});expect(result.current.state.point).toBeUndefined();await settle(mock,2);expect(result.current.state.snapshot?.query.customPoint).toEqual({latitude:30.1,longitude:50.2});});
 it('keeps repeated point activation idempotent without replacing the active token or its provisional position',async()=>{
  const mock=setup(),{result}=renderHook(()=>useHotelDiscovery({trip:arrivingTrip(),catalog:arrivalCatalog,session,client:mock.client}));await open(result,mock);await settle(mock);act(()=>result.current.openPoint());const opened=result.current.state,token=opened.point!.token;
  act(()=>{result.current.openPoint();result.current.openPoint();});expect(result.current.state).toBe(opened);expect(result.current.state.point?.token).toBe(token);
  act(()=>result.current.setPoint({latitude:30.5,longitude:50.5}));const provisional=result.current.state;act(()=>result.current.openPoint());expect(result.current.state).toBe(provisional);expect(result.current.state.point).toMatchObject({token,value:{latitude:30.5,longitude:50.5}});expect(mock.requests).toHaveLength(1);
 });
 it('does not retry a failed automatic or sort request in a loop and preserves an error through point Cancel',async()=>{const mock=setup();const {result}=renderHook(()=>useHotelDiscovery({trip:arrivingTrip(),catalog:arrivalCatalog,session,client:mock.client}));await open(result,mock);await act(async()=>mock.requests[0]!.reject(Error('offline')));expect(result.current.state.status).toBe('error');await act(async()=>{});expect(mock.requests).toHaveLength(1);act(()=>result.current.openPoint());act(()=>result.current.cancelPoint());expect(result.current.state.status).toBe('error');expect(mock.requests).toHaveLength(1);act(()=>{void result.current.submit();});expect(mock.requests).toHaveLength(2);await settle(mock,1);act(()=>{void result.current.changeSort('stars');});await act(async()=>mock.requests[2]!.reject(Error('offline')));await act(async()=>{});expect(result.current.state.status).toBe('error');expect(mock.requests).toHaveLength(3);});
 it('revokes requests and source actions on session authority changes without mutations while blocked',async()=>{const mock=setup(),trip=arrivingTrip();const hook=renderHook(({authorityKey,blocked})=>useHotelDiscovery({trip,catalog:arrivalCatalog,session,client:mock.client,authorityKey,blocked}),{initialProps:{authorityKey:'one',blocked:false}});await open(hook.result,mock);const old=hook.result.current;hook.rerender({authorityKey:'two',blocked:true});expect(mock.requests[0]!.signal?.aborted).toBe(true);await settle(mock,0);expect(hook.result.current.state.snapshot).toBeUndefined();expect(mock.requests).toHaveLength(1);act(()=>{void old.submit();old.selectHotel('hotel-a');});expect(mock.requests).toHaveLength(1);hook.rerender({authorityKey:'two',blocked:false});await waitFor(()=>expect(mock.requests).toHaveLength(2));await settle(mock,1);expect(hook.result.current.authorityStale).toBe(false);const latest=hook.result.current;hook.unmount();await latest.submit();expect(mock.requests).toHaveLength(2);});
 it('retires an open reference transaction on blocked or changed authority and rejects its captured map callbacks',async()=>{
  const mock=setup(),trip=arrivingTrip(),hook=renderHook(({authorityKey,blocked})=>useHotelDiscovery({trip,catalog:arrivalCatalog,session,client:mock.client,authorityKey,blocked}),{initialProps:{authorityKey:'one',blocked:false}});await open(hook.result,mock);await settle(mock);act(()=>hook.result.current.openPoint());const previous=hook.result.current,draft=JSON.stringify(previous.state.draft);expect(previous.state.point).toBeDefined();
  hook.rerender({authorityKey:'two',blocked:true});expect(hook.result.current.state.point).toBeUndefined();act(()=>{void previous.chooseLocation({latitude:20,longitude:30});previous.setPoint({latitude:20,longitude:30});void previous.applyPoint();hook.result.current.openPoint();});expect(JSON.stringify(hook.result.current.state.draft)).toBe(draft);expect(hook.result.current.state.point).toBeUndefined();expect(mock.requests).toHaveLength(1);
  hook.rerender({authorityKey:'two',blocked:false});await waitFor(()=>expect(mock.requests).toHaveLength(2));await settle(mock,1);act(()=>hook.result.current.openPoint());const second=hook.result.current;hook.rerender({authorityKey:'three',blocked:false});await waitFor(()=>expect(mock.requests).toHaveLength(3));act(()=>{void second.chooseLocation({latitude:22,longitude:32});void previous.chooseLocation({latitude:20,longitude:30});});expect(JSON.stringify(hook.result.current.state.draft)).toBe(draft);expect(hook.result.current.state.point).toBeUndefined();expect(mock.requests).toHaveLength(3);
  await settle(mock,2);act(()=>hook.result.current.openPoint());act(()=>{void hook.result.current.chooseLocation({latitude:25,longitude:35});});expect(mock.requests).toHaveLength(4);expect(mock.requests[3]!.query.customPoint).toEqual({latitude:25,longitude:35});
 });
 it('keeps ignored setup/equivalent preference edits side-effect-free during a request and after selection',async()=>{const mock=setup(),onSelect=vi.fn();const {result}=renderHook(()=>useHotelDiscovery({trip:arrivingTrip(),catalog:arrivalCatalog,session,client:mock.client,onSelectHotelQuote:onSelect}));await open(result,mock);const loading=result.current.state,calls=onSelect.mock.calls.length;act(()=>{result.current.edit({checkOut:'2026-12-01',rooms:3,arrivalPlaceId:'foreign'});result.current.edit({sort:'cheapest',customPoint:undefined});});expect(result.current.state).toBe(loading);expect(mock.requests[0]!.signal?.aborted).toBe(false);expect(onSelect).toHaveBeenCalledTimes(calls);await settle(mock);act(()=>result.current.selectHotel('hotel-a'));const chosen=result.current.selected,lease=result.current.selectionLease()!,selectedCalls=onSelect.mock.calls.length;act(()=>{result.current.edit({checkIn:'2026-12-01',checkOut:'2026-12-02',rooms:2});result.current.edit({sort:'cheapest'});});expect(result.current.selected).toBe(chosen);expect(lease.isCurrent()).toBe(true);expect(onSelect).toHaveBeenCalledTimes(selectedCalls);expect(mock.requests).toHaveLength(1);});
 it('retains a valid higher-version return quote and never downgrades it on the same hotel',async()=>{const mock=setup(),trip=arrivingTrip();const base={destinationCityId:'b',checkIn:'2026-10-25',checkOut:'2026-10-26',party:query.party,rooms:1,sort:'cheapest',arrivalPlaceId:'MHD'} satisfies HotelSearchQuery;const snapshot=arrivalSnapshot(base,Date.now()-1000),fresh={...snapshot.quotes[0]!,version:2,observedAt:new Date().toISOString()};const restore:HotelRestore={snapshot,draft:{...base,childAges:[],arrivalConfirmed:true},selected:fresh,open:true,scrollTop:0,tripItinerary:trip.itinerary};const {result}=renderHook(()=>useHotelDiscovery({trip,catalog:arrivalCatalog,session,client:mock.client,restore}));await act(async()=>{});expect(mock.requests).toHaveLength(0);expect(result.current.selected?.version).toBe(2);act(()=>result.current.selectHotel('hotel-a'));expect(result.current.selected?.version).toBe(2);expect(result.current.selectionLease()?.quote.version).toBe(2);});
 it('replaces legacy multi-night/room return data with the new automatic query without mutating historical evidence',async()=>{const mock=setup(),trip=arrivingTrip();const legacy={destinationCityId:'b',checkIn:'2026-10-25',checkOut:'2026-10-29',party:query.party,rooms:1,sort:'cheapest',arrivalPlaceId:'MHD'} satisfies HotelSearchQuery;const snapshot=arrivalSnapshot(legacy),restore:HotelRestore={snapshot,draft:{...legacy,childAges:[],arrivalConfirmed:true},selected:snapshot.quotes[0],open:true,scrollTop:0,tripItinerary:trip.itinerary};const hook=renderHook(()=>useHotelDiscovery({trip,catalog:arrivalCatalog,session,client:mock.client,restore}));expect(hook.result.current.state.snapshot).toBeUndefined();expect(hook.result.current.selected).toBeUndefined();await waitFor(()=>expect(mock.requests).toHaveLength(1));expect(mock.requests[0]!.query.checkOut).toBe('2026-10-26');expect(snapshot.query.checkOut).toBe('2026-10-29');await settle(mock);expect(hook.result.current.state.snapshot?.query.checkOut).toBe('2026-10-26');});
});

describe('current real-directory discovery and trusted historical returns',()=>{
 const currentCatalog={...arrivalCatalog,fixtureVersion:'showcase-v3',catalogRevision:'catalog-v3'};
 const currentSession={...session,fixtureVersion:'showcase-v3',catalogRevision:'catalog-v3'};
 function restored(sourceRevision?:string,receipt=false){
  const trip=arrivingTrip(),input={destinationCityId:'b',checkIn:'2026-10-25',checkOut:'2026-10-26',party:query.party,rooms:1,sort:'cheapest',arrivalPlaceId:'MHD'} satisfies HotelSearchQuery;
  const snapshot={...arrivalSnapshot(input,Date.now()-1000),...(sourceRevision?{sourceRevision}:{})};
  const selected={...snapshot.quotes[0]!,version:2,observedAt:new Date().toISOString()};
  const accepted:ReferralReceipt={referralId:'historical-stay',intentId:'accepted-stay',selection:{kind:'hotel',quoteId:selected.quoteId,quoteVersion:selected.version},payload:{kind:'hotel',quote:selected},confirmedAt:selected.observedAt,handoffPath:'/provider-demo/historical-stay'};
  const restore:HotelRestore={snapshot,draft:{...input,childAges:[],arrivalConfirmed:true},selected,open:true,scrollTop:0,tripItinerary:trip.itinerary,...(receipt?{receipt:accepted}:{})};
  return{trip,snapshot,selected,restore,accepted};
 }
 it.each([undefined,'hotel-v1','retired-directory'])('refreshes ordinary %s snapshots before allowing old selections or leases',async sourceRevision=>{
  const f=restored(sourceRevision),mock=setup(),original=JSON.stringify(f.snapshot);
  const {result}=renderHook(()=>useHotelDiscovery({trip:f.trip,catalog:currentCatalog,session:currentSession,client:mock.client,restore:f.restore}));
  expect(result.current.state.snapshot).toBeUndefined();expect(result.current.selected).toBeUndefined();expect(result.current.selectionLease()).toBeUndefined();
  act(()=>{result.current.selectHotel(f.selected.hotelId);result.current.selectQuote(f.snapshot.quotes[0]!);});
  expect(result.current.selected).toBeUndefined();await waitFor(()=>expect(mock.requests).toHaveLength(1));
  const snapshot={...arrivalSnapshot(mock.requests[0]!.query),sourceRevision:HOTEL_DIRECTORY_SOURCE_REVISION};
  await act(async()=>mock.requests[0]!.resolve(snapshot));
  expect(result.current.state.snapshot).toBe(snapshot);expect(result.current.selected).toBeUndefined();
  act(()=>result.current.selectHotel(snapshot.hotels[0]!.hotelId));expect(result.current.selectionLease()?.quote.hotelId).toBe(snapshot.hotels[0]!.hotelId);
  expect(JSON.stringify(f.snapshot)).toBe(original);expect(mock.requests).toHaveLength(1);
 });
 it('reuses a fresh current directory normally without requesting another search',async()=>{
  const f=restored(HOTEL_DIRECTORY_SOURCE_REVISION),mock=setup();
  const {result}=renderHook(()=>useHotelDiscovery({trip:f.trip,catalog:currentCatalog,session:currentSession,client:mock.client,restore:f.restore}));
  await act(async()=>{});expect(mock.requests).toHaveLength(0);expect(result.current.state.snapshot).toBe(f.snapshot);expect(result.current.selected).toBe(f.selected);
 });
 it('rejects a retired ordering response without adopting its hotels, publishing a quote or retrying in a loop',async()=>{
  const f=restored(HOTEL_DIRECTORY_SOURCE_REVISION),mock=setup(),onSelect=vi.fn();
  const {result}=renderHook(()=>useHotelDiscovery({trip:f.trip,catalog:currentCatalog,session:currentSession,client:mock.client,restore:f.restore,onSelectHotelQuote:onSelect}));
  act(()=>{void result.current.changeSort('stars');});expect(mock.requests).toHaveLength(1);
  const retired={...arrivalSnapshot(mock.requests[0]!.query),sourceRevision:'retired-directory'};
  await act(async()=>mock.requests[0]!.resolve(retired));expect(result.current.state.status).toBe('error');expect(result.current.state.snapshot).toBe(f.snapshot);expect(result.current.state.error).toBeTruthy();expect(result.current.selected).toBeUndefined();expect(result.current.selectionLease()).toBeUndefined();expect(onSelect.mock.calls.at(-1)?.[0]).toBeUndefined();
  act(()=>{result.current.selectHotel(retired.hotels[0]!.hotelId);result.current.selectQuote(retired.quotes[0]!);});expect(result.current.selected).toBeUndefined();expect(mock.requests).toHaveLength(1);
 });
 it('retains exact receipt-backed old geography and its higher accepted quote without downgrade',async()=>{
  const f=restored(undefined,true),mock=setup(),original=JSON.stringify(f.snapshot);
  const {result}=renderHook(()=>useHotelDiscovery({trip:f.trip,catalog:currentCatalog,session:currentSession,client:mock.client,restore:f.restore}));
  await act(async()=>{});expect(mock.requests).toHaveLength(0);expect(result.current.state.snapshot).toBe(f.snapshot);expect(result.current.selected?.version).toBe(2);
  act(()=>result.current.selectHotel(f.selected.hotelId));expect(result.current.selected?.version).toBe(2);
  const lease=result.current.selectionLease()!;expect(lease.quote).toBe(f.selected);expect(lease.isCurrent()).toBe(true);
  act(()=>expect(lease.accept({...f.selected,version:3})).toBe(true));expect(result.current.selected?.version).toBe(3);
  expect(JSON.stringify(f.snapshot)).toBe(original);expect(mock.requests).toHaveLength(0);
 });
 it.each(['selection','payload','path','future','expired','lineage'] as const)('rejects a %s receipt exemption and refreshes without mutating old evidence',async mismatch=>{
  const f=restored(undefined,true),mock=setup();
  const receipt=structuredClone(f.accepted);f.restore.receipt=receipt;
  if(mismatch==='selection')receipt.selection.quoteId='another-quote';
  if(mismatch==='path')receipt.handoffPath='/provider-demo/another-receipt';
  if(mismatch==='future')receipt.confirmedAt=new Date(Date.now()+60000).toISOString();
  if(receipt.payload.kind!=='hotel')throw Error('Expected hotel');
  if(mismatch==='payload')receipt.payload.quote.total.amountRial+=100000;
  if(mismatch==='expired'){receipt.payload.quote.expiresAt=new Date(Date.now()-1).toISOString();f.restore.selected=receipt.payload.quote;}
  if(mismatch==='lineage'){receipt.payload.quote.hotelId='other-hotel';f.restore.selected=receipt.payload.quote;}
  const original=JSON.stringify(f.snapshot);
  const {result}=renderHook(()=>useHotelDiscovery({trip:f.trip,catalog:currentCatalog,session:currentSession,client:mock.client,restore:f.restore}));
  expect(result.current.selected).toBeUndefined();expect(result.current.selectionLease()).toBeUndefined();expect(result.current.state.snapshot).toBeUndefined();
  await waitFor(()=>expect(mock.requests).toHaveLength(1));expect(JSON.stringify(f.snapshot)).toBe(original);
 });
 it('keeps a valid historical receipt blocked by current session authority and refreshes on recovery',async()=>{
  const f=restored(undefined,true),mock=setup();
  const hook=renderHook(({blocked,authorityKey})=>useHotelDiscovery({trip:f.trip,catalog:currentCatalog,session:currentSession,client:mock.client,restore:f.restore,blocked,authorityKey}),{initialProps:{blocked:true,authorityKey:'before'}});
  await act(async()=>{});expect(hook.result.current.selected).toBeUndefined();expect(hook.result.current.selectionLease()).toBeUndefined();expect(mock.requests).toHaveLength(0);
  hook.rerender({blocked:false,authorityKey:'after'});await waitFor(()=>expect(mock.requests).toHaveLength(1));expect(hook.result.current.selected).toBeUndefined();
 });
 it('does not exempt a context-blocked historical receipt',async()=>{
  const f=restored(undefined,true),mock=setup();f.restore.contextBlocked=true;
  const {result}=renderHook(()=>useHotelDiscovery({trip:f.trip,catalog:currentCatalog,session:currentSession,client:mock.client,restore:f.restore}));
  await act(async()=>{});expect(result.current.selected).toBeUndefined();expect(result.current.selectionLease()).toBeUndefined();expect(result.current.state.snapshot).toBeUndefined();
 });
});
