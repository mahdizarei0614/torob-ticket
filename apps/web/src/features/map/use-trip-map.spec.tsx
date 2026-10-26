import {act,renderHook,render,screen,fireEvent} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {BrowserRouter} from 'react-router';
import {type ReactNode} from 'react';
import {expect,it,vi} from 'vitest';
import type {ApiClient} from '@torob-ticket/client';
import type {SearchRequest,SearchRecovery} from '@torob-ticket/contracts';
import {useSearchController} from '../search/use-search-controller';
import {catalog,query,session} from '../search/search-test-data';
import {group,observedAt} from '../results/results-test-data';
import {JourneyCard} from '../results/journey-card';
import {recovery} from '../results/results-test-data';
import {useTripMap} from './use-trip-map';
function setup() {
 const cache=new QueryClient();let sequence=0;
 const client={startSearch:vi.fn(async(input:SearchRequest):Promise<SearchRecovery>=>({sequence:0,snapshot:{searchId:'s'+ ++sequence,clientGeneration:input.clientGeneration,query:input.query,status:'complete',observedAt,groups:[group('a')],providerStatuses:[],coverage:{expectedProviderIds:[],successfulProviderIds:[],failedProviderIds:[],pendingProviderIds:[],complete:true}}})),cancelSearch:vi.fn(async()=>undefined)} as unknown as ApiClient;
 function Wrapper({children}:{children:ReactNode}){return <QueryClientProvider client={cache}><BrowserRouter>{children}</BrowserRouter></QueryClientProvider>;}
 window.history.replaceState(null,'','/');
 return renderHook(()=>{const controller=useSearchController(catalog,session,client);return {controller,map:useTripMap(controller,catalog)};},{wrapper:Wrapper});
}
it('keeps selected presentation leases across hover but revokes them on a new pin or form edit',async()=>{
 const hook=setup();await act(()=>hook.result.current.controller.submit(query));
 act(()=>hook.result.current.map.pin(group('a').itinerary));const selected=hook.result.current.map;
 act(()=>hook.result.current.map.preview(group('b').itinerary));
 expect(selected.isPresentationCurrent()).toBe(true);expect(hook.result.current.map.presentationView.itinerary?.itineraryId).toBe('a');
 const camera={x:1,y:2,width:3,height:4,zoom:2};act(()=>selected.savePresentationCamera(camera));expect(hook.result.current.map.readCamera()).toEqual(camera);
 act(()=>hook.result.current.map.pin(group('b').itinerary));expect(selected.isPresentationCurrent()).toBe(false);
 const next=hook.result.current.map;act(()=>{hook.result.current.controller.edit({party:{adults:2,children:0,infants:0}});next.savePresentationCamera({...camera,zoom:8});});
 expect(next.isPresentationCurrent()).toBe(false);expect(hook.result.current.map.presentationView.itinerary).toBeUndefined();expect(hook.result.current.map.readCamera()?.zoom).not.toBe(8);
 hook.unmount();
});
it('synchronously rejects retained direction callbacks after native restore and camera delivery after a newer pin',async()=>{
 const hook=setup();await act(()=>hook.result.current.controller.submit(query));
 act(()=>hook.result.current.map.pin(group('a').itinerary));
 const old=hook.result.current.map;
 const camera={x:1,y:2,width:3,height:4,zoom:2};act(()=>old.saveCamera(camera));
 act(()=>hook.result.current.map.pin(group('b').itinerary));
 act(()=>old.saveCamera({...camera,zoom:8}));expect(hook.result.current.map.initialCamera).toBeUndefined();
 const prior=hook.result.current.map;
 act(()=>{window.history.replaceState(null,'','/');window.dispatchEvent(new PopStateEvent('popstate'));prior.direction('return');});
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

it('same-turn accepted inspections reconcile with the actual edited intent and keep controller IDs coherent',async()=>{
 vi.spyOn(Date,'now').mockReturnValue(Date.parse(observedAt)+1000);
 for(const kind of ['pin','preview','selection'] as const){const hook=setup();await act(()=>hook.result.current.controller.submit(query));const before=hook.result.current.map;const itinerary=group('a').itinerary;const quote=group('a').eligibleQuotes[0]!;
 act(()=>{hook.result.current.controller.edit({party:{adults:2,children:0,infants:0}});if(kind==='selection')before.selection(quote,itinerary,{groupId:'a',quoteId:quote.quoteId,version:1});else before[kind](itinerary);});
 expect(hook.result.current.controller.state.draft.party.adults).toBe(2);expect(hook.result.current.map.view.itinerary?.itineraryId).toBe('a');expect(hook.result.current.map.view.progress).toBe(kind==='selection'?.7:.35);expect(kind==='preview'?hook.result.current.controller.state.previewItineraryId:hook.result.current.controller.state.pinnedItineraryId).toBe('a');hook.unmount();}
 vi.restoreAllMocks();
});
it('passive result delivery after edits or explicit inspection clear cannot resurrect the consumed fare intent',async()=>{
 vi.spyOn(Date,'now').mockReturnValue(Date.parse(observedAt)+1000);const hook=setup();await act(()=>hook.result.current.controller.submit(query));const itinerary=group('a').itinerary;const quote=group('a').eligibleQuotes[0]!;const intent={groupId:'a',quoteId:quote.quoteId,version:1};
 act(()=>hook.result.current.map.selection(quote,itinerary,intent));act(()=>{hook.result.current.controller.edit({party:{adults:2,children:0,infants:0}});hook.result.current.map.selection(quote,itinerary,intent);});expect(hook.result.current.map.view.itinerary).toBeUndefined();expect(hook.result.current.controller.state.pinnedItineraryId).toBeUndefined();expect(hook.result.current.map.view.progress).toBe(0);
 act(()=>hook.result.current.map.selection(quote,itinerary,{...intent}));expect(hook.result.current.map.view.progress).toBe(.7);act(()=>hook.result.current.map.clear());act(()=>hook.result.current.map.selection(quote,itinerary,hook.result.current.map.state.resultIntent));expect(hook.result.current.map.view.itinerary).toBeUndefined();hook.unmount();vi.restoreAllMocks();
});
it('actual card→hook modality contract restores focus after cross-card hover and keeps pointer inspection after blur',async()=>{
 vi.spyOn(Date,'now').mockReturnValue(Date.parse(observedAt)+1000);const hook=setup();await act(()=>hook.result.current.controller.submit(query));const items=[group('a'),group('b')];const data=recovery(items);
 const view=render(<><button>outside</button>{items.map(item=><JourneyCard key={item.groupId} group={item} catalog={catalog} snapshot={data.snapshot} now={Date.now()} state={{generation:'g',searchId:'s',adopted:data,latest:data,frozen:false,dismissedSuggestion:false}} onFreeze={()=>undefined} onSelect={()=>undefined} onPreviewItinerary={(...args)=>hook.result.current.map.preview(...args)}/>)}</>);
 const cards=view.container.querySelectorAll('article');const first=cards[0]!.querySelector<HTMLButtonElement>('button[aria-pressed]')!;
 act(()=>first.focus());fireEvent.mouseEnter(cards[1]!);expect(hook.result.current.map.view.itinerary?.itineraryId).toBe('b');fireEvent.mouseLeave(cards[1]!);expect(document.activeElement).toBe(first);expect(hook.result.current.map.view.itinerary?.itineraryId).toBe('a');expect(hook.result.current.controller.state.previewItineraryId).toBe('a');
 fireEvent.mouseEnter(cards[0]!);act(()=>screen.getByRole('button',{name:'outside'}).focus());expect(hook.result.current.map.view.itinerary?.itineraryId).toBe('a');fireEvent.mouseLeave(cards[0]!);expect(hook.result.current.map.view.itinerary).toBeUndefined();view.unmount();hook.unmount();vi.restoreAllMocks();
});
