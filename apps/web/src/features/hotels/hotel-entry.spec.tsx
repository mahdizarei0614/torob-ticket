import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import type {TransportSearchQuery} from '@torob-ticket/contracts';
import {HotelEntry} from './hotel-entry';
import type {HotelDiscovery} from './use-hotel-discovery';
import type {SearchController,TripMapController} from '../map/use-trip-map';
import {createSearchState} from '../search/search-reducer';
import {catalog,query,session} from '../search/search-test-data';

vi.mock('./hotel-dialog',()=>({HotelDialog:({model}:{model:HotelDiscovery})=>model.open?<div role="dialog" aria-label="hotel"><input aria-label="checkout" value={model.state.draft.checkOut} onChange={event=>model.edit({checkOut:event.target.value})}/><button onClick={model.closeDialog}>close</button></div>:null}));
const map={state:{selection:undefined}} as unknown as TripMapController;
const onCovered=vi.fn();
afterEach(()=>vi.clearAllMocks());
function controllerWithComparison(){
 const controller={state:{...createSearchState(query),committed:query,generation:'g',searchId:'s'},resetting:false,pending:false,startLimitReached:false,resultIsCurrent:()=>true,submit:vi.fn()} as unknown as SearchController;
 controller.currentIntent=()=>controller.state;
 return controller;
}

it('moves only the hotel entry into the map dock while keeping stay state and restoring focus to its current trigger',async()=>{
 const controller=controllerWithComparison();const dock=document.createElement('div');document.body.append(dock);
 const props={controller,map,catalog,session,onCovered};
 const view=render(<HotelEntry {...props}/>);
 fireEvent.click(screen.getByRole('button',{name:'مقایسه اقامتگاه‌های پایان'}));
 fireEvent.change(screen.getByRole('textbox',{name:'checkout'}),{target:{value:'2026-10-29'}});
 view.rerender(<HotelEntry {...props} desktop portalTarget={dock}/>);
 expect(dock.querySelector('[data-hotel-placement="map"]')).not.toBeNull();
 expect(screen.getByRole('textbox',{name:'checkout'})).toHaveValue('2026-10-29');
 expect(dock.querySelector('[role="dialog"]')).toBeNull();
 view.rerender(<HotelEntry {...props}/>);
 expect(dock).toBeEmptyDOMElement();
 expect(screen.getByRole('textbox',{name:'checkout'})).toHaveValue('2026-10-29');
 expect(controller.submit).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'close'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'مقایسه اقامتگاه‌های پایان'})).toHaveFocus());
 view.unmount();dock.remove();
});

it('shows a complete route before the first comparison and establishes its return context only on explicit hotel open',async()=>{
 const controller=controllerWithComparison();controller.state=createSearchState(query);
 controller.submit=vi.fn(async(input:TransportSearchQuery|undefined)=>{controller.state={...controller.state,committed:input!,generation:'fresh',searchId:'search',intentRevision:1};});
 render(<HotelEntry controller={controller} map={map} catalog={catalog} session={session} onCovered={onCovered}/>);
 const open=screen.getByRole('button',{name:'مقایسه اقامتگاه‌های پایان'});
 expect(controller.submit).not.toHaveBeenCalled();
 fireEvent.click(open);
 await waitFor(()=>expect(screen.getByRole('dialog',{name:'hotel'})).toBeVisible());
 expect(controller.submit).toHaveBeenCalledExactlyOnceWith(query,false);
});

it('hides the entry when a city is cleared and rejects an earlier asynchronous open after intent changes',async()=>{
 const controller=controllerWithComparison();controller.state=createSearchState(query);
 let finish!:()=>void;
 controller.submit=vi.fn(async(input:TransportSearchQuery|undefined)=>{
  controller.state={...controller.state,committed:input!,generation:'pending',intentRevision:1};
  await new Promise<void>(resolve=>{finish=resolve;});
  controller.state={...controller.state,searchId:'search'};
 });
 const props={controller,map,catalog,session,onCovered};const view=render(<HotelEntry {...props}/>);
 fireEvent.click(screen.getByRole('button',{name:'مقایسه اقامتگاه‌های پایان'}));
 controller.state={...controller.state,draft:{...query,destinationCityId:''},intentRevision:2};
 view.rerender(<HotelEntry {...props}/>);
 expect(screen.queryByRole('button',{name:/مقایسه اقامتگاه/})).toBeNull();
 await act(async()=>finish());
 expect(screen.queryByRole('dialog')).toBeNull();
});
