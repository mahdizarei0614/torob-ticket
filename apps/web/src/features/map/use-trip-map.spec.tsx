import {act,renderHook} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {BrowserRouter} from 'react-router';
import {type ReactNode} from 'react';
import {expect,it,vi} from 'vitest';
import type {ApiClient} from '@torob-ticket/client';
import type {SearchRequest,SearchRecovery} from '@torob-ticket/contracts';
import {useSearchController} from '../search/use-search-controller';
import {catalog,query,session} from '../search/search-test-data';
import {group,observedAt} from '../results/results-test-data';
import {useTripMap} from './use-trip-map';
function setup() {
 const cache=new QueryClient();let sequence=0;
 const client={startSearch:vi.fn(async(input:SearchRequest):Promise<SearchRecovery>=>({sequence:0,snapshot:{searchId:'s'+ ++sequence,clientGeneration:input.clientGeneration,query:input.query,status:'complete',observedAt,groups:[group('a')],providerStatuses:[],coverage:{expectedProviderIds:[],successfulProviderIds:[],failedProviderIds:[],pendingProviderIds:[],complete:true}}})),cancelSearch:vi.fn(async()=>undefined)} as unknown as ApiClient;
 function Wrapper({children}:{children:ReactNode}){return <QueryClientProvider client={cache}><BrowserRouter>{children}</BrowserRouter></QueryClientProvider>;}
 window.history.replaceState(null,'','/');
 return renderHook(()=>{const controller=useSearchController(catalog,session,client);return {controller,map:useTripMap(controller,catalog)};},{wrapper:Wrapper});
}
it('synchronously rejects retained city/direction callbacks after native restore and camera delivery after a newer pin',async()=>{
 const hook=setup();await act(()=>hook.result.current.controller.submit(query));
 act(()=>hook.result.current.map.pin(group('a').itinerary));
 const old=hook.result.current.map;
 const camera={x:1,y:2,width:3,height:4,zoom:2};act(()=>old.saveCamera(camera));
 act(()=>hook.result.current.map.pin(group('b').itinerary));
 act(()=>old.saveCamera({...camera,zoom:8}));expect(hook.result.current.map.initialCamera).toBeUndefined();
 const prior=hook.result.current.map;
 act(()=>{window.history.replaceState(null,'','/');window.dispatchEvent(new PopStateEvent('popstate'));prior.chooseCity('destination','c');prior.direction('return');});
 expect(hook.result.current.controller.state.draft.destinationCityId).toBe('b');expect(hook.result.current.map.view.direction).toBe('outbound');expect(hook.result.current.map.view.itinerary).toBeUndefined();
 hook.unmount();
});
it('clears coherent IDs after edit and explicitly reselects the same committed fare without changing the edited train form',async()=>{
 vi.spyOn(Date,'now').mockReturnValue(Date.parse(observedAt)+1000);
 const hook=setup();await act(()=>hook.result.current.controller.submit(query));
 const quote=group('a').eligibleQuotes[0]!;const itinerary=group('a').itinerary;
 act(()=>hook.result.current.map.selection(quote,itinerary,{groupId:'a',quoteId:quote.quoteId,version:1}));
 expect(hook.result.current.map.view.progress).toBe(.7);expect(hook.result.current.controller.state.pinnedItineraryId).toBe('a');
 act(()=>hook.result.current.controller.edit({mode:'train'}));expect(hook.result.current.controller.state.pinnedItineraryId).toBeUndefined();expect(hook.result.current.map.view.itinerary).toBeUndefined();
 act(()=>hook.result.current.map.selection(quote,itinerary,{groupId:'a',quoteId:quote.quoteId,version:1}));
 expect(hook.result.current.map.view.progress).toBe(.7);expect(hook.result.current.map.view.mode).toBe('flight');expect(hook.result.current.controller.state.draft.mode).toBe('train');expect(hook.result.current.controller.state.pinnedItineraryId).toBe('a');
 hook.unmount();vi.restoreAllMocks();
});
it('uses the accepted recheck version own timer and keeps same-travel refinement camera as historical inspection',async()=>{
 vi.useFakeTimers();vi.setSystemTime(Date.parse(observedAt)+1000);
 const hook=setup();await act(()=>hook.result.current.controller.submit(query));const quote=group('a').eligibleQuotes[0]!;const itinerary=group('a').itinerary;
 act(()=>hook.result.current.map.selection(quote,itinerary,{groupId:'a',quoteId:quote.quoteId,version:1}));
 const camera={x:1,y:2,width:3,height:4,zoom:2};act(()=>hook.result.current.map.saveCamera(camera));
 const fresh={...quote,version:2,expiresAt:new Date(Date.now()+1200000).toISOString()};
 act(()=>hook.result.current.map.bindAcceptedQuote({quoteId:quote.quoteId,version:1},fresh,itinerary));
 act(()=>vi.advanceTimersByTime(600000));expect(hook.result.current.map.view.progress).toBe(.7);
 act(()=>vi.advanceTimersByTime(600000));expect(hook.result.current.map.view.progress).toBe(.35);
 await act(()=>hook.result.current.controller.submit({...query,sort:'fastest'},false,'refine'));
 expect(hook.result.current.map.view.historical).toBe(true);expect(hook.result.current.map.view.progress).toBe(0);expect(hook.result.current.map.initialCamera).toEqual(camera);
 hook.unmount();vi.useRealTimers();
});
