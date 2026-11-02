import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {apiClient} from '@torob-ticket/client';
import type {TransportSearchQuery} from '@torob-ticket/contracts';
import {HotelEntry} from './hotel-entry';
import type {HotelDiscovery} from './use-hotel-discovery';
import type {SearchController,TripMapController} from '../map/use-trip-map';
import {createSearchState} from '../search/search-reducer';
import {query,session} from '../search/search-test-data';
import {group} from '../results/results-test-data';
import {arrivalCatalog,arrivalSnapshot} from './arrival-hotel-test-data';
vi.mock('./hotel-dialog',()=>({HotelDialogContents:({model}:{model:HotelDiscovery})=>model.open?<div><div data-hotel-scroll><output data-testid="dates" data-status={model.state.status}>{model.state.draft.checkIn}/{model.state.draft.checkOut}/{model.state.draft.rooms}</output><output data-testid="order">{model.state.draft.sort}</output><button onClick={()=>void model.changeSort('stars')}>stars</button><button onClick={model.closeDialog}>close</button></div></div>:null}));
const onCovered=vi.fn();
beforeEach(()=>{vi.spyOn(apiClient,'startHotelSearch').mockImplementation(async q=>arrivalSnapshot(q));});
afterEach(()=>{vi.restoreAllMocks();vi.clearAllMocks();});
function controllerWithComparison(){const controller={state:{...createSearchState(query),committed:query,generation:'g',searchId:'s'},resetting:false,pending:false,startLimitReached:false,resultIsCurrent:()=>true,submit:vi.fn()} as unknown as SearchController;controller.currentIntent=()=>controller.state;return controller;}
function selectedMap(arrivalAt='2026-10-25T07:30:00.000Z',owner={generation:'g',searchId:'s'}){const g=group(arrivalAt),itinerary={...g.itinerary,outbound:{...g.itinerary.outbound,segments:g.itinerary.outbound.segments.map(segment=>({...segment,arrivalAt}))}},quote={...g.eligibleQuotes[0]!,observedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()};return {state:{selection:{quote,inspection:{itinerary,query,owner},valid:true,source:'result'}}} as unknown as TripMapController;}

it('moves only the entry to the dock while preserving automatic stay, ordering, inner scroll checkpoint and close focus',async()=>{
 const controller=controllerWithComparison(),map=selectedMap(),dock=document.createElement('div'),checkpoint=vi.fn();document.body.append(dock);const props={controller,map,catalog:arrivalCatalog,session,onCovered,onCheckpoint:checkpoint};const view=render(<HotelEntry {...props}/>);
 expect(checkpoint.mock.calls.at(-1)?.[0]).toBeUndefined();
 fireEvent.click(screen.getByRole('button',{name:'مقایسه اقامتگاه‌های پایان'}));await waitFor(()=>expect(screen.getByTestId('dates')).toHaveAttribute('data-status','ready'));
 fireEvent.click(screen.getByRole('button',{name:'stars'}));await waitFor(()=>expect(screen.getByTestId('dates')).toHaveAttribute('data-status','ready'));expect(screen.getByTestId('order')).toHaveTextContent('stars');
 const scroller=document.querySelector<HTMLElement>('[data-hotel-scroll]')!;scroller.scrollTop=77;view.rerender(<HotelEntry {...props} desktop portalTarget={dock}/>);
 expect(dock.querySelector('[data-hotel-placement="map"]')).not.toBeNull();expect(dock.querySelector('[role="dialog"]')).toBeNull();expect(screen.getByTestId('dates')).toHaveTextContent('2026-10-25/2026-10-26/1');expect(screen.getByTestId('order')).toHaveTextContent('stars');expect(checkpoint.mock.calls.at(-1)?.[0]).toMatchObject({scrollTop:77,draft:{rooms:1,sort:'stars'}});
 view.rerender(<HotelEntry {...props}/>);expect(dock).toBeEmptyDOMElement();expect(controller.submit).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'close'}));await waitFor(()=>expect(screen.getByRole('button',{name:'مقایسه اقامتگاه‌های پایان'})).toHaveFocus());view.unmount();dock.remove();
});

it('bootstraps transport only on explicit hotel open and waits for its actual asynchronously selected arrival',async()=>{
 const controller=controllerWithComparison();controller.state=createSearchState(query);controller.submit=vi.fn(async(input:TransportSearchQuery|undefined)=>{controller.state={...controller.state,committed:input!,generation:'fresh',searchId:'search',intentRevision:1};});const map={state:{selection:undefined}} as unknown as TripMapController;const props={controller,map,catalog:arrivalCatalog,session,onCovered};const view=render(<HotelEntry {...props}/>);
 expect(controller.submit).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'مقایسه اقامتگاه‌های پایان'}));await waitFor(()=>expect(screen.getByRole('dialog',{name:'هتل‌های پایان'})).toBeVisible());expect(controller.submit).toHaveBeenCalledExactlyOnceWith(query,false);expect(apiClient.startHotelSearch).not.toHaveBeenCalled();expect(screen.getByTestId('dates')).toHaveTextContent('//1');
 map.state.selection=selectedMap('2026-10-25T22:00:00Z',{generation:'fresh',searchId:'search'}).state.selection;view.rerender(<HotelEntry {...props}/>);await waitFor(()=>expect(apiClient.startHotelSearch).toHaveBeenCalledTimes(1));expect(screen.getByTestId('dates')).toHaveTextContent('2026-10-26/2026-10-27/1');
});

it('rejects an earlier asynchronous open after the route intent changes',async()=>{
 const controller=controllerWithComparison();controller.state=createSearchState(query);let finish!:()=>void;controller.submit=vi.fn(async(input:TransportSearchQuery|undefined)=>{controller.state={...controller.state,committed:input!,generation:'pending',intentRevision:1};await new Promise<void>(resolve=>{finish=resolve;});controller.state={...controller.state,searchId:'search'};});const map={state:{selection:undefined}} as unknown as TripMapController;const props={controller,map,catalog:arrivalCatalog,session,onCovered};const view=render(<HotelEntry {...props}/>);
 fireEvent.click(screen.getByRole('button',{name:'مقایسه اقامتگاه‌های پایان'}));controller.state={...controller.state,draft:{...query,destinationCityId:''},intentRevision:2};view.rerender(<HotelEntry {...props}/>);expect(screen.queryByRole('button',{name:/مقایسه اقامتگاه/})).toBeNull();await act(async()=>finish());expect(screen.queryByRole('dialog')).toBeNull();expect(apiClient.startHotelSearch).not.toHaveBeenCalled();
});

it('automatically follows a replacement selected ticket arrival without editing or applying the hotel stay',async()=>{
 const controller=controllerWithComparison(),map=selectedMap(),props={controller,map,catalog:arrivalCatalog,session,onCovered};const view=render(<HotelEntry {...props}/>);fireEvent.click(screen.getByRole('button',{name:'مقایسه اقامتگاه‌های پایان'}));await waitFor(()=>expect(apiClient.startHotelSearch).toHaveBeenCalledTimes(1));map.state.selection=selectedMap('2026-10-27T22:00:00Z').state.selection;view.rerender(<HotelEntry {...props}/>);await waitFor(()=>expect(apiClient.startHotelSearch).toHaveBeenCalledTimes(2));expect(screen.getByTestId('dates')).toHaveTextContent('2026-10-28/2026-10-29/1');
});
