import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {apiClient} from '@torob-ticket/client';
import {HotelEntry} from './hotel-entry';
import type {SearchController,TripMapController} from '../map/use-trip-map';
import type {HotelDiscovery,HotelRestore} from './use-hotel-discovery';
import {query,session} from '../search/search-test-data';
import {group} from '../results/results-test-data';
import {arrivalCatalog,arrivalSnapshot} from './arrival-hotel-test-data';
vi.mock('./hotel-dialog',()=>({HotelDialogContents:({model}:{model:HotelDiscovery})=><output data-testid="restored-arrival" data-stale={model.stale} data-version={model.selected?.version} data-checkout={model.state.draft.checkOut}>{model.state.trip.itinerary?.itineraryId??'none'}</output>}));
beforeEach(()=>{vi.spyOn(apiClient,'startHotelSearch').mockImplementation(async input=>arrivalSnapshot(input));});
afterEach(()=>vi.restoreAllMocks());
function fixture(contextBlocked=false){
 const input={destinationCityId:'b',checkIn:'2026-10-25',checkOut:'2026-10-26',party:query.party,rooms:1,sort:'cheapest' as const,arrivalPlaceId:'MHD'};const snapshot=arrivalSnapshot(input,Date.now()-1000),g=group('selected-transport'),stay={...snapshot.quotes[0]!,version:2,observedAt:new Date().toISOString()},quote={...g.eligibleQuotes[0]!,observedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()};
 const restore:HotelRestore={snapshot,draft:{checkIn:input.checkIn,checkOut:input.checkOut,rooms:1,childAges:[],arrivalConfirmed:true,sort:'cheapest',arrivalPlaceId:'MHD'},selected:stay,open:true,scrollTop:0,tripItinerary:g.itinerary,contextBlocked};const controller={state:{committed:query,draft:query,generation:'g',searchId:'s'},resetting:false,resultIsCurrent:()=>true} as unknown as SearchController;controller.currentIntent=()=>controller.state;const map={state:{selection:undefined}} as unknown as TripMapController;
 return {restore,controller,map,g,quote};
}
it('seeds trusted selected arrival and higher accepted one-night quote before map hydration without replacing it',async()=>{
 const f=fixture(),props={controller:f.controller,map:f.map,catalog:arrivalCatalog,session,restore:f.restore,onCovered:vi.fn()};const view=render(<HotelEntry {...props}/>);await screen.findByTestId('restored-arrival');expect(screen.getByTestId('restored-arrival')).toHaveAttribute('data-stale','false');expect(screen.getByTestId('restored-arrival')).toHaveAttribute('data-version','2');expect(screen.getByTestId('restored-arrival').textContent).toBe(f.g.itinerary.itineraryId);
 f.map.state.selection={quote:f.quote,inspection:{itinerary:f.g.itinerary,query,owner:{generation:'g',searchId:'s'}},valid:true,source:'result'};view.rerender(<HotelEntry {...props}/>);await waitFor(()=>expect(screen.getByTestId('restored-arrival')).toHaveAttribute('data-stale','false'));expect(screen.getByTestId('restored-arrival')).toHaveAttribute('data-version','2');expect(apiClient.startHotelSearch).not.toHaveBeenCalled();
});
it('does not trust a blocked restored arrival, but rebinds automatically once a current selected ticket arrives',async()=>{
 const f=fixture(true),props={controller:f.controller,map:f.map,catalog:arrivalCatalog,session,restore:f.restore,onCovered:vi.fn()};const view=render(<HotelEntry {...props}/>);await screen.findByTestId('restored-arrival');expect(screen.getByTestId('restored-arrival')).toHaveAttribute('data-stale','true');expect(screen.getByTestId('restored-arrival').textContent).toBe('none');expect(screen.getByTestId('restored-arrival')).not.toHaveAttribute('data-version');expect(apiClient.startHotelSearch).not.toHaveBeenCalled();
 f.map.state.selection={quote:f.quote,inspection:{itinerary:f.g.itinerary,query,owner:{generation:'g',searchId:'s'}},valid:true,source:'result'};view.rerender(<HotelEntry {...props}/>);await waitFor(()=>expect(apiClient.startHotelSearch).toHaveBeenCalledTimes(1));expect(screen.getByTestId('restored-arrival')).toHaveAttribute('data-checkout','2026-10-26');expect(screen.getByTestId('restored-arrival')).toHaveAttribute('data-stale','false');
});
it('an unopened optional hotel does not manufacture a return context; explicit open captures UI origin while awaiting arrival',()=>{
 const controller={state:{committed:query,draft:query,generation:'g',searchId:'s'},resetting:false,resultIsCurrent:()=>true} as unknown as SearchController;controller.currentIntent=()=>controller.state;const map={state:{selection:undefined}} as unknown as TripMapController,checkpoint=vi.fn(),origin=vi.fn();render(<HotelEntry controller={controller} map={map} catalog={arrivalCatalog} session={session} onCovered={()=>undefined} onCheckpoint={checkpoint} onOriginScroll={origin}/>);expect(checkpoint.mock.calls.at(-1)?.[0]).toBeUndefined();fireEvent.click(screen.getByRole('button',{name:'مقایسه اقامتگاه‌های پایان'}));expect(origin).toHaveBeenCalledTimes(1);expect(checkpoint.mock.calls.at(-1)?.[0]).toMatchObject({open:true,stale:true});expect(apiClient.startHotelSearch).not.toHaveBeenCalled();
});
