import {StrictMode} from 'react';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {apiClient} from '@torob-ticket/client';
import {MotionPolicyProvider} from '@torob-ticket/ui';
import {HotelEntry} from './hotel-entry';
import type {HotelDiscovery} from './use-hotel-discovery';
import type {SearchController,TripMapController} from '../map/use-trip-map';
import {createSearchState} from '../search/search-reducer';
import {query,session} from '../search/search-test-data';
import {group} from '../results/results-test-data';
import {arrivalCatalog,arrivalSnapshot} from './arrival-hotel-test-data';

vi.mock('./hotel-dialog',()=>({HotelDialogContents:({model}:{model:HotelDiscovery})=>model.open?<div><output data-testid="stay-sort">{model.state.draft.sort}</output><button onClick={()=>void model.changeSort('stars')}>stars</button><button onClick={model.closeDialog}>close</button></div>:null}));
let reduced=false,hidden=false;const media=new Set<()=>void>(),onCovered=vi.fn();
const catalog={...arrivalCatalog,supportedConnections:[...arrivalCatalog.supportedConnections,{mode:'flight' as const,scope:'domestic' as const,originCityId:'a',destinationCityId:'c'}]};
beforeEach(()=>{
 reduced=false;hidden=false;media.clear();vi.stubGlobal('matchMedia',()=>({get matches(){return reduced;},addEventListener:(_:string,fn:()=>void)=>media.add(fn),removeEventListener:(_:string,fn:()=>void)=>media.delete(fn)}));vi.spyOn(document,'visibilityState','get').mockImplementation(()=>hidden?'hidden':'visible');vi.spyOn(apiClient,'startHotelSearch').mockImplementation(async input=>arrivalSnapshot(input));
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();document.querySelectorAll('[data-test-dock]').forEach(node=>node.remove());});
function setup(){
 const controller={state:{...createSearchState(query),committed:query,generation:'g',searchId:'s'},resetting:false,pending:false,startLimitReached:false,resultIsCurrent:()=>true,submit:vi.fn()} as unknown as SearchController;controller.currentIntent=()=>controller.state;
 const row=group('arrival'),itinerary={...row.itinerary,outbound:{...row.itinerary.outbound,segments:row.itinerary.outbound.segments.map(segment=>({...segment,arrivalAt:'2026-10-25T07:30:00Z'}))}},quote={...row.eligibleQuotes[0]!,observedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()};
 const map={state:{selection:{quote,inspection:{itinerary,query,owner:{generation:'g',searchId:'s'}},valid:true,source:'result'}}} as unknown as TripMapController;
 const dock=document.createElement('div');dock.dataset['testDock']='';document.body.append(dock);
 const props={controller,map,catalog,session,onCovered};
 return{controller,dock,props};
}
const entry=()=>document.querySelector<HTMLElement>('[data-hotel-entry]')!;
const frame=(node:HTMLElement)=>node.closest<HTMLElement>('[data-hotel-presence-frame]')!;
const opacity=(node:HTMLElement)=>Number(node.style.opacity||'1');

it('retains a mid-entry dock exit without brightening, revokes its action and moves focused removal to the form',async()=>{
 const {controller,dock,props}=setup(),tree=()=><StrictMode><form aria-label="جست‌وجوی سفر"><input aria-label="شهر"/></form><HotelEntry {...props} desktop portalTarget={dock}/></StrictMode>,view=render(tree()),original=entry();
 await waitFor(()=>{expect(opacity(original)).toBeGreaterThan(0);expect(opacity(original)).toBeLessThan(.8);},{interval:10});const button=screen.getByRole('button',{name:'مقایسه اقامتگاه‌های پایان'});act(()=>button.focus());
 controller.state={...controller.state,draft:{...query,destinationCityId:''},intentRevision:1};view.rerender(tree());expect(original).toBeInTheDocument();expect(original).toHaveAttribute('data-hotel-presence','exiting');expect(original).toHaveAttribute('inert');expect(original).toHaveAttribute('aria-hidden','true');expect(button).toBeDisabled();expect(screen.getByRole('textbox',{name:'شهر'})).toHaveFocus();fireEvent.click(button);expect(controller.submit).not.toHaveBeenCalled();expect(screen.queryByRole('dialog')).toBeNull();
 await waitFor(()=>{expect(opacity(frame(original))).toBeLessThan(1);expect(opacity(frame(original))).toBeGreaterThan(0);},{interval:10});const held=opacity(original),outer=opacity(frame(original));await waitFor(()=>expect(opacity(frame(original))).toBeLessThan(outer*.7),{interval:10});expect(opacity(original)).toBeCloseTo(held,5);expect(opacity(original)*opacity(frame(original))).toBeLessThan(held*outer);
 await waitFor(()=>expect(original.isConnected).toBe(false));expect(dock).toBeEmptyDOMElement();
});

it('keeps one outgoing visual through rapid route replacement, then enters the latest city and preserves unchanged focus',async()=>{
 const {controller,dock,props}=setup(),tree=()=><StrictMode><HotelEntry {...props} desktop portalTarget={dock}/></StrictMode>,view=render(tree()),original=entry();await waitFor(()=>expect(opacity(original)).toBeGreaterThan(0),{interval:10});
 controller.state={...controller.state,draft:{...query,destinationCityId:''},intentRevision:1};view.rerender(tree());controller.state={...controller.state,draft:{...query,destinationCityId:'c'},intentRevision:2};view.rerender(tree());controller.state={...controller.state,draft:{...query,destinationCityId:'c',departureDate:'2026-10-26'},intentRevision:3};view.rerender(tree());
 expect(original).toHaveAttribute('data-hotel-presence','exiting');expect(document.querySelectorAll('[data-hotel-entry]')).toHaveLength(1);expect(screen.queryByRole('button',{name:'مقایسه اقامتگاه‌های پایان'})).toBeNull();
 const latest=await screen.findByRole('button',{name:'مقایسه اقامتگاه‌های دیگر'});expect(original.isConnected).toBe(false);expect(document.querySelectorAll('[data-hotel-entry]')).toHaveLength(1);const current=entry();expect(current).not.toBe(original);expect(current.dataset['hotelRoute']).toContain('2026-10-26');await waitFor(()=>expect(opacity(current)).toBe(1));
 act(()=>latest.focus());controller.state={...controller.state,draft:{...controller.state.draft,sort:'fastest'}};view.rerender(tree());expect(entry()).toBe(current);expect(latest).toHaveFocus();expect(opacity(current)).toBe(1);expect(controller.submit).not.toHaveBeenCalled();
});

it.each(['reduced','hidden','covered','disabled'] as const)('settles %s removals/reentries and never replays them on policy resume',async kind=>{
 const {controller,dock,props}=setup();if(kind==='reduced')reduced=true;if(kind==='hidden')hidden=true;
 const tree=(suppressed:boolean)=><StrictMode><MotionPolicyProvider covered={suppressed&&kind==='covered'} disabled={suppressed&&kind==='disabled'}><HotelEntry {...props} desktop portalTarget={dock}/></MotionPolicyProvider></StrictMode>,view=render(tree(true));await waitFor(()=>expect(opacity(entry())).toBe(1));
 controller.state={...controller.state,draft:{...query,destinationCityId:''},intentRevision:1};view.rerender(tree(true));await waitFor(()=>expect(dock.querySelector('[data-hotel-entry]')).toBeNull());controller.state={...controller.state,draft:query,intentRevision:2};view.rerender(tree(true));const restored=entry();await waitFor(()=>expect(opacity(restored)).toBe(1));
 act(()=>{reduced=false;hidden=false;media.forEach(listener=>listener());document.dispatchEvent(new Event('visibilitychange'));});view.rerender(tree(false));expect(entry()).toBe(restored);expect(opacity(restored)).toBe(1);expect(document.querySelector('[data-hotel-presence="exiting"]')).toBeNull();
});

it('animates when a late portal attaches and keeps one dialog/model and ordering across map/inline placement',async()=>{
 const {controller,dock,props}=setup(),tree=(target:HTMLElement|null,desktop=true)=><StrictMode><HotelEntry {...props} desktop={desktop} portalTarget={target}/></StrictMode>,view=render(tree(null));expect(document.querySelector('[data-hotel-entry]')).toBeNull();view.rerender(tree(dock));const attached=entry();await waitFor(()=>{expect(opacity(attached)).toBeGreaterThan(0);expect(opacity(attached)).toBeLessThan(1);},{interval:10});
 fireEvent.click(screen.getByRole('button',{name:'مقایسه اقامتگاه‌های پایان'}));await waitFor(()=>expect(apiClient.startHotelSearch).toHaveBeenCalledTimes(1));fireEvent.click(screen.getByRole('button',{name:'stars'}));await waitFor(()=>expect(apiClient.startHotelSearch).toHaveBeenCalledTimes(2));expect(screen.getByTestId('stay-sort')).toHaveTextContent('stars');
 view.rerender(tree(null,false));expect(dock).toBeEmptyDOMElement();expect(screen.getAllByRole('dialog')).toHaveLength(1);expect(screen.getByTestId('stay-sort')).toHaveTextContent('stars');view.rerender(tree(dock));expect(screen.getAllByRole('dialog')).toHaveLength(1);expect(apiClient.startHotelSearch).toHaveBeenCalledTimes(2);expect(controller.submit).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'close'}));await waitFor(()=>expect(screen.getByRole('button',{name:'مقایسه اقامتگاه‌های پایان'})).toHaveFocus());
});
