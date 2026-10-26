import {render,screen,fireEvent} from '@testing-library/react';
import {it,expect,vi} from 'vitest';
import {HotelEntry} from './hotel-entry';
import type {SearchController,TripMapController} from '../map/use-trip-map';
import type {HotelDiscovery,HotelRestore} from './use-hotel-discovery';
import {hotelSnapshot} from './hotel-test-data';
import {catalog,query,session} from '../search/search-test-data';
import {group} from '../results/results-test-data';
vi.mock('./hotel-dialog',()=>({HotelDialog:({model}:{model:HotelDiscovery})=><output data-testid="restored-arrival" data-stale={model.stale}>{model.state.trip.itinerary?.itineraryId??'none'}</output>}));
it('seeds validated selected arrival before hotel model creation and stays coherent when map layout hydrates',()=>{
 const snapshot=hotelSnapshot(),stay=snapshot.quotes[0]!,tripQuery={...query,party:stay.query.party};const g=group('selected-transport'),quote={...g.eligibleQuotes[0]!,party:stay.query.party,observedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()};
 const restore:HotelRestore={snapshot,draft:{checkIn:stay.query.checkIn,checkOut:stay.query.checkOut,rooms:2,childAges:[],arrivalConfirmed:true,sort:'cheapest'},selected:stay,open:true,scrollTop:0,tripItinerary:g.itinerary};
 const controller={state:{committed:tripQuery,draft:tripQuery,generation:'g',searchId:'s'},resetting:false,resultIsCurrent:()=>true} as unknown as SearchController;const map={state:{selection:undefined}} as unknown as TripMapController;const covered=vi.fn();
 const view=render(<HotelEntry controller={controller} map={map} catalog={catalog} session={session} restore={restore} onCovered={covered}/>);expect(screen.getByTestId('restored-arrival')).toHaveAttribute('data-stale','false');expect(screen.getByTestId('restored-arrival').textContent).toBe(g.itinerary.itineraryId);
 map.state.selection={quote,inspection:{itinerary:g.itinerary,query:tripQuery,owner:{generation:'g',searchId:'s'}},valid:true,source:'result'};view.rerender(<HotelEntry controller={controller} map={map} catalog={catalog} session={session} restore={restore} onCovered={covered}/>);expect(screen.getByTestId('restored-arrival')).toHaveAttribute('data-stale','false');
});

it('an unopened optional hotel does not manufacture a return context; an explicit open captures UI origin',()=>{
 const controller={state:{committed:query,draft:query,generation:'g',searchId:'s'},resetting:false,resultIsCurrent:()=>true} as unknown as SearchController;const map={state:{selection:undefined}} as unknown as TripMapController;const checkpoint=vi.fn(),origin=vi.fn();
 render(<HotelEntry controller={controller} map={map} catalog={catalog} session={session} onCovered={()=>undefined} onCheckpoint={checkpoint} onOriginScroll={origin}/>);expect(checkpoint.mock.calls.at(-1)?.[0]).toBeUndefined();fireEvent.click(screen.getByRole('button',{name:'مقایسه اقامتگاه‌های پایان'}));expect(origin).toHaveBeenCalledTimes(1);expect(checkpoint.mock.calls.at(-1)?.[0]).toMatchObject({open:true,stale:false});
});
