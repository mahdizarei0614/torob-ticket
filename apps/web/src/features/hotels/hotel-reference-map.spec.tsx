import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
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

it('applies bare map, hotel and cluster reference clicks through the actual adapter/hook while cancel and old leases remain fenced',async()=>{
 const events=new Map<MapEventName,Set<(event:unknown)=>void>>();let element:HTMLElement|undefined;
 const emit=(name:MapEventName,event:unknown={})=>{for(const callback of events.get(name)??[])callback(event);};
 const map:MapPort={on:(name,fn)=>{const callbacks=events.get(name)??new Set();callbacks.add(fn);events.set(name,callbacks);},off:(name,fn)=>events.get(name)?.delete(fn),remove:vi.fn(),resize:vi.fn(),setStyle:vi.fn(),getCenter:()=>({lat:30,lng:50}),getZoom:()=>12,jumpTo:vi.fn(),fitBounds:vi.fn(),getBounds:()=>({contains:()=>true})};
 const sdk:FreeMapSdk={createMap:vi.fn(node=>{element=node;return map;}),createMarker:vi.fn(node=>{
  let point={lng:0,lat:0};const marker:MarkerPort={setLngLat:next=>{point={lng:next[0],lat:next[1]};return marker;},addTo:()=>{element?.append(node);return marker;},remove:()=>node.remove(),getLngLat:()=>point,on:vi.fn(),off:vi.fn(),setDraggable:vi.fn()};return marker;
 })};
 vi.mocked(loadFreeMapSdk).mockResolvedValue(sdk);
 const queries:HotelSearchQuery[]=[],client={startHotelSearch:vi.fn(async(query:HotelSearchQuery)=>{queries.push(query);return arrivalSnapshot(query);})} as unknown as ApiClient;
 let latest!:HotelDiscovery;
 function App(){const model=useHotelDiscovery({trip:arrivingTrip(),catalog:arrivalCatalog,session,client});latest=model;return <><button onClick={model.openDialog}>open</button><HotelDialog model={model} catalog={arrivalCatalog} session={session} canApplyTrip/></>;}
 render(<ThemeProvider><App/></ThemeProvider>);fireEvent.click(screen.getByText('open'));await waitFor(()=>expect(screen.getByRole('list',{name:'هتل‌ها و قیمت اقامت'})).toBeInTheDocument());await waitFor(()=>expect(sdk.createMap).toHaveBeenCalledTimes(1));act(()=>emit('load'));
 fireEvent.click(document.querySelector('[data-hotel-id="hotel-a"] [data-hotel-card-select]')!);const lease=latest.selectionLease()!;expect(lease.isCurrent()).toBe(true);
 fireEvent.click(screen.getByRole('radio',{name:'نزدیک به نقطه دلخواه'}));expect(latest.state.point).toBeDefined();expect(lease.isCurrent()).toBe(false);
 class NativeLngLat {get lng(){return 51.5;}get lat(){return 35.5;}}
 act(()=>emit('click',{lngLat:new NativeLngLat()}));await waitFor(()=>expect(queries).toHaveLength(2));await waitFor(()=>expect(latest.state.status).toBe('ready'));expect(queries[1]).toMatchObject({sort:'location-distance',customPoint:{latitude:35.5,longitude:51.5}});expect(latest.state.point).toBeUndefined();
 fireEvent.click(screen.getByRole('button',{name:'تغییر نقطه مرجع'}));act(()=>emit('click',{lngLat:null}));expect(queries).toHaveLength(2);fireEvent.click(screen.getByRole('button',{name:'انصراف'}));expect(latest.state.draft.customPoint).toEqual({latitude:35.5,longitude:51.5});expect(queries).toHaveLength(2);
 fireEvent.click(screen.getByRole('button',{name:'تغییر نقطه مرجع'}));fireEvent.click(document.querySelector('[data-map-hotel-id="hotel-b"]')!);await waitFor(()=>expect(queries).toHaveLength(3));await waitFor(()=>expect(latest.state.status).toBe('ready'));expect(queries[2]!.customPoint).toEqual(latest.state.snapshot!.hotels.find(hotel=>hotel.hotelId==='hotel-b')!.point);expect(latest.state.selectedHotelId).toBe('hotel-a');
 map.project=()=>({x:100,y:100});act(()=>emit('move'));fireEvent.click(screen.getByRole('button',{name:'تغییر نقطه مرجع'}));const fits=vi.mocked(map.fitBounds!).mock.calls.length;fireEvent.click(screen.getByRole('button',{name:'انتخاب موقعیت گروه ۲ هتل'}));await waitFor(()=>expect(queries).toHaveLength(4));await waitFor(()=>expect(latest.state.status).toBe('ready'));expect(map.fitBounds).toHaveBeenCalledTimes(fits);expect(latest.state.selectedHotelId).toBe('hotel-a');expect(queries[3]!.customPoint).toBeDefined();expect(latest.state.point).toBeUndefined();
 expect(sdk.createMap).toHaveBeenCalledTimes(1);expect(map.remove).not.toHaveBeenCalled();const oldClick=[...(events.get('click')??[])][0]!;fireEvent.click(screen.getByRole('button',{name:'بستن'}));act(()=>oldClick({lngLat:{lng:52,lat:36}}));expect(queries).toHaveLength(4);
});
