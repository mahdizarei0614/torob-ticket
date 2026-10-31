import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import type {HotelSearchQuery} from '@torob-ticket/contracts';
import type {ApiClient} from '@torob-ticket/client';
import {ThemeProvider} from '@torob-ticket/ui';
import {HotelDialog} from './hotel-dialog';
import {useHotelDiscovery,type HotelDiscovery} from './use-hotel-discovery';
import {arrivalCatalog,arrivingTrip,arrivalSnapshot} from './arrival-hotel-test-data';
import {session} from '../search/search-test-data';
import {loadFreeMapSdk} from './free-map-sdk';
import type {FreeMapSdk,MapPort,MarkerPort,MapEventName} from './free-map-adapter';

vi.mock('./free-map-sdk',()=>({loadFreeMapSdk:vi.fn()}));
beforeEach(()=>vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener(){},removeEventListener(){}})));
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.clearAllMocks();});

function mapRuntime(){
 const events=new Map<MapEventName,Set<(event:unknown)=>void>>();let element:HTMLElement|undefined;
 const emit=(name:MapEventName,event:unknown={})=>{for(const callback of events.get(name)??[])callback(event);};
 const map:MapPort={on:(name,fn)=>{const callbacks=events.get(name)??new Set();callbacks.add(fn);events.set(name,callbacks);},off:(name,fn)=>events.get(name)?.delete(fn),remove:vi.fn(),resize:vi.fn(),setStyle:vi.fn(),getCenter:()=>({lat:30,lng:50}),getZoom:()=>12,jumpTo:vi.fn(),fitBounds:vi.fn(),getBounds:()=>({contains:()=>true})};
 const sdk:FreeMapSdk={createMap:vi.fn(node=>{element=node;return map;}),createMarker:vi.fn(node=>{
  let point={lng:0,lat:0};const marker:MarkerPort={setLngLat:next=>{point={lng:next[0],lat:next[1]};return marker;},addTo:()=>{element?.append(node);return marker;},remove:()=>node.remove(),getLngLat:()=>point,on:vi.fn(),off:vi.fn(),setDraggable:vi.fn()};return marker;
 })};
 return{events,emit,map,sdk};
}

it('reopens the checked reference option by pointer, Space and Enter for repeated real-map picks, Cancel and close/reopen',async()=>{
 const user=userEvent.setup(),{events,emit,map,sdk}=mapRuntime();
 vi.mocked(loadFreeMapSdk).mockResolvedValue(sdk);
 const queries:HotelSearchQuery[]=[],client={startHotelSearch:vi.fn(async(query:HotelSearchQuery)=>{queries.push(query);return arrivalSnapshot(query);})} as unknown as ApiClient;
 let latest!:HotelDiscovery;
 function App(){const model=useHotelDiscovery({trip:arrivingTrip(),catalog:arrivalCatalog,session,client});latest=model;return <><button onClick={model.openDialog}>open</button><HotelDialog model={model} catalog={arrivalCatalog} session={session} canApplyTrip/></>;}
 render(<ThemeProvider><App/></ThemeProvider>);fireEvent.click(screen.getByText('open'));await waitFor(()=>expect(screen.getByRole('list',{name:'هتل‌ها و قیمت اقامت'})).toBeInTheDocument());await waitFor(()=>expect(sdk.createMap).toHaveBeenCalledTimes(1));act(()=>emit('load'));
 fireEvent.click(document.querySelector('[data-hotel-id="hotel-a"] [data-hotel-card-select]')!);const lease=latest.selectionLease()!;expect(lease.isCurrent()).toBe(true);
 const reference=()=>screen.getByRole('radio',{name:'نزدیک به نقطه دلخواه'}),label=()=>reference().closest<HTMLElement>('[data-segment-option]')!;
 await user.click(label());expect(latest.state.point).toBeDefined();expect(lease.isCurrent()).toBe(false);
 class NativeLngLat {get lng(){return 51.5;}get lat(){return 35.5;}}
 act(()=>emit('click',{lngLat:new NativeLngLat()}));await waitFor(()=>expect(queries).toHaveLength(2));await waitFor(()=>expect(latest.state.status).toBe('ready'));expect(queries[1]).toMatchObject({sort:'location-distance',customPoint:{latitude:35.5,longitude:51.5}});expect(latest.state.point).toBeUndefined();
 await user.click(label());expect(latest.state.point).toBeDefined();const canceled=latest.chooseLocation;act(()=>emit('click',{lngLat:null}));expect(queries).toHaveLength(2);fireEvent.click(screen.getByRole('button',{name:'انصراف'}));expect(latest.state.draft.customPoint).toEqual({latitude:35.5,longitude:51.5});expect(queries).toHaveLength(2);
 reference().focus();await user.keyboard(' ');expect(latest.state.point).toBeDefined();await act(async()=>canceled({latitude:22,longitude:33}));expect(queries).toHaveLength(2);fireEvent.click(document.querySelector('[data-map-hotel-id="hotel-b"]')!);await waitFor(()=>expect(queries).toHaveLength(3));await waitFor(()=>expect(latest.state.status).toBe('ready'));expect(queries[2]!.customPoint).toEqual(latest.state.snapshot!.hotels.find(hotel=>hotel.hotelId==='hotel-b')!.point);expect(latest.state.selectedHotelId).toBe('hotel-a');
 map.project=()=>({x:100,y:100});act(()=>emit('move'));reference().focus();await user.keyboard('{Enter}');expect(latest.state.point).toBeDefined();const fits=vi.mocked(map.fitBounds!).mock.calls.length;fireEvent.click(screen.getByRole('button',{name:'انتخاب موقعیت گروه ۲ هتل'}));await waitFor(()=>expect(queries).toHaveLength(4));await waitFor(()=>expect(latest.state.status).toBe('ready'));expect(map.fitBounds).toHaveBeenCalledTimes(fits);expect(latest.state.selectedHotelId).toBe('hotel-a');expect(queries[3]!.customPoint).toBeDefined();expect(latest.state.point).toBeUndefined();
 await user.click(label());expect(latest.state.point).toBeDefined();fireEvent.click(screen.getByRole('button',{name:'انتخاب موقعیت گروه ۲ هتل'}));await waitFor(()=>expect(queries).toHaveLength(5));await waitFor(()=>expect(latest.state.status).toBe('ready'));expect(queries[4]!.customPoint).toEqual(queries[3]!.customPoint);expect(map.fitBounds).toHaveBeenCalledTimes(fits);expect(document.querySelector('[data-map-choice-id="custom-point"]')).toBeInTheDocument();
 expect(sdk.createMap).toHaveBeenCalledTimes(1);expect(map.remove).not.toHaveBeenCalled();const oldClick=[...(events.get('click')??[])][0]!;fireEvent.click(screen.getByRole('button',{name:'بستن'}));act(()=>oldClick({lngLat:{lng:52,lat:36}}));expect(queries).toHaveLength(5);
 fireEvent.click(screen.getByText('open'));await waitFor(()=>expect(sdk.createMap).toHaveBeenCalledTimes(2));await user.click(label());expect(latest.state.point).toBeDefined();act(()=>emit('click',{lngLat:{lng:52,lat:36}}));await waitFor(()=>expect(queries).toHaveLength(6));await waitFor(()=>expect(latest.state.status).toBe('ready'));expect(queries[5]!.customPoint).toEqual({longitude:52,latitude:36});expect(lease.isCurrent()).toBe(false);
 const retained=latest.state.draft.customPoint;await user.click(screen.getByRole('radio',{name:'ستاره بیشتر'}).closest<HTMLElement>('[data-segment-option]')!);await waitFor(()=>expect(queries).toHaveLength(7));await waitFor(()=>expect(latest.state.status).toBe('ready'));await user.click(label());expect(latest.state.point).toBeDefined();expect(queries).toHaveLength(7);fireEvent.click(screen.getByRole('button',{name:'انصراف'}));expect(latest.state.draft.sort).toBe('stars');expect(latest.state.draft.customPoint).toEqual(retained);expect(queries).toHaveLength(7);
});

it('uses the current point transaction when an old SDK promise resolves after Cancel and close/reopen',async()=>{
 const user=userEvent.setup(),runtime=mapRuntime();let resolve!:(sdk:FreeMapSdk)=>void;const pending=new Promise<FreeMapSdk>(ready=>{resolve=ready;});vi.mocked(loadFreeMapSdk).mockReturnValue(pending);
 const queries:HotelSearchQuery[]=[],client={startHotelSearch:vi.fn(async(query:HotelSearchQuery)=>{queries.push(query);return arrivalSnapshot(query);})} as unknown as ApiClient;let latest!:HotelDiscovery;
 function App(){const model=useHotelDiscovery({trip:arrivingTrip(),catalog:arrivalCatalog,session,client});latest=model;return <><button onClick={model.openDialog}>open</button><HotelDialog model={model} catalog={arrivalCatalog} session={session} canApplyTrip/></>;}
 render(<ThemeProvider><App/></ThemeProvider>);fireEvent.click(screen.getByText('open'));await waitFor(()=>expect(screen.getByRole('list',{name:'هتل‌ها و قیمت اقامت'})).toBeInTheDocument());
 const label=()=>screen.getByRole('radio',{name:'نزدیک به نقطه دلخواه'}).closest<HTMLElement>('[data-segment-option]')!;
 const beforePick=latest.chooseLocation;await user.click(label());const canceled=latest.chooseLocation;fireEvent.click(screen.getByRole('button',{name:'انصراف'}));await user.click(label());fireEvent.click(screen.getByRole('button',{name:'بستن'}));fireEvent.click(screen.getByText('open'));await user.click(label());const token=latest.state.point!.token;
 await user.click(label());expect(latest.state.point?.token).toBe(token);expect(runtime.sdk.createMap).not.toHaveBeenCalled();await act(async()=>{await beforePick({latitude:20,longitude:30});await canceled({latitude:22,longitude:32});});expect(queries).toHaveLength(1);
 await act(async()=>resolve(runtime.sdk));await waitFor(()=>expect(runtime.sdk.createMap).toHaveBeenCalledTimes(1));expect(document.querySelector('[data-free-map-container]')).toHaveAttribute('data-picking-point','true');
 act(()=>runtime.emit('click',{lngLat:{lng:51.25,lat:35.25}}));await waitFor(()=>expect(queries).toHaveLength(2));await waitFor(()=>expect(latest.state.status).toBe('ready'));expect(queries[1]!.customPoint).toEqual({longitude:51.25,latitude:35.25});expect(latest.state.point).toBeUndefined();expect(document.querySelector('[data-map-choice-id="custom-point"]')).toBeInTheDocument();
});

it('rejects a checked-option press begun under old authority while later current activation still opens a fresh picker',async()=>{
 const user=userEvent.setup(),runtime=mapRuntime();vi.mocked(loadFreeMapSdk).mockResolvedValue(runtime.sdk);const queries:HotelSearchQuery[]=[],client={startHotelSearch:vi.fn(async(query:HotelSearchQuery)=>{queries.push(query);return arrivalSnapshot(query);})} as unknown as ApiClient;let latest!:HotelDiscovery;
 function App({authorityKey}:{authorityKey:string}){const model=useHotelDiscovery({trip:arrivingTrip(),catalog:arrivalCatalog,session,client,authorityKey});latest=model;return <><button onClick={model.openDialog}>open</button><HotelDialog model={model} catalog={arrivalCatalog} session={session} canApplyTrip/></>;}
 const view=render(<ThemeProvider><App authorityKey="one"/></ThemeProvider>);fireEvent.click(screen.getByText('open'));await waitFor(()=>expect(screen.getByRole('list',{name:'هتل‌ها و قیمت اقامت'})).toBeInTheDocument());await waitFor(()=>expect(runtime.sdk.createMap).toHaveBeenCalledTimes(1));
 const label=()=>screen.getByRole('radio',{name:'نزدیک به نقطه دلخواه'}).closest<HTMLElement>('[data-segment-option]')!;
 await user.click(label());act(()=>runtime.emit('click',{lngLat:{lng:51.5,lat:35.5}}));await waitFor(()=>expect(queries).toHaveLength(2));await waitFor(()=>expect(latest.state.status).toBe('ready'));const original=JSON.stringify(latest.state.draft);
 await user.pointer({target:label(),keys:'[MouseLeft>]'});view.rerender(<ThemeProvider><App authorityKey="two"/></ThemeProvider>);await waitFor(()=>expect(queries).toHaveLength(3));await waitFor(()=>expect(latest.state.status).toBe('ready'));await user.pointer({target:label(),keys:'[/MouseLeft]'});expect(latest.state.point).toBeUndefined();expect(JSON.stringify(latest.state.draft)).toBe(original);expect(queries).toHaveLength(3);
 await user.click(label());expect(latest.state.point).toBeDefined();act(()=>runtime.emit('click',{lngLat:{lng:52,lat:36}}));await waitFor(()=>expect(queries).toHaveLength(4));expect(queries[3]!.customPoint).toEqual({longitude:52,latitude:36});
});
