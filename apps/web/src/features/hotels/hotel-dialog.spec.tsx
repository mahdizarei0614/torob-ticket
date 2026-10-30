import {fireEvent,render,screen,waitFor,within,cleanup} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {HotelSearchQuery} from '@torob-ticket/contracts';
import type {ApiClient} from '@torob-ticket/client';
import {HotelDialog} from './hotel-dialog';
import {useHotelDiscovery} from './use-hotel-discovery';
import {arrivalCatalog,arrivingTrip,arrivalSnapshot} from './arrival-hotel-test-data';
import {session} from '../search/search-test-data';
import type {FreeLocationMapProps} from './free-location-map';

const map=vi.hoisted(()=>({current:undefined as FreeLocationMapProps|undefined}));
vi.mock('./free-location-map',()=>({FreeLocationMap:(props:FreeLocationMapProps)=>{map.current=props;return <section aria-label="map"><span>{props.choices.find(choice=>choice.kind==='arrival')?.name}</span>{props.choices.filter(choice=>choice.kind==='hotel').map(choice=><button key={choice.id} aria-label={`pin ${choice.id}`} aria-pressed={props.selectedHotelId===choice.id} onClick={()=>props.onSelectHotel?.(choice.id)}>{choice.name}</button>)}{props.pickingPoint&&<button onClick={()=>props.onPoint({latitude:30.2,longitude:50.3})}>pick point</button>}</section>;}}));
const scrollDescriptor=Object.getOwnPropertyDescriptor(HTMLElement.prototype,'scrollTo');
beforeEach(()=>{vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener(){},removeEventListener(){}}));Object.defineProperty(HTMLElement.prototype,'scrollTo',{value:vi.fn(),configurable:true});});
afterEach(()=>{cleanup();vi.unstubAllGlobals();map.current=undefined;if(scrollDescriptor)Object.defineProperty(HTMLElement.prototype,'scrollTo',scrollDescriptor);else Reflect.deleteProperty(HTMLElement.prototype,'scrollTo');});
function setup(transform=(snapshot:ReturnType<typeof arrivalSnapshot>)=>snapshot,trip=arrivingTrip('2026-10-25T22:00:00Z')){
 const queries:HotelSearchQuery[]=[];
 const client={startHotelSearch:vi.fn(async(query:HotelSearchQuery)=>{queries.push(query);return transform(arrivalSnapshot(query));})} as unknown as ApiClient;
 function App(){const model=useHotelDiscovery({trip,catalog:arrivalCatalog,session,client});return <><button onClick={()=>model.openDialog()}>open hotels</button><HotelDialog model={model} catalog={arrivalCatalog} session={session} canApplyTrip/></>;}
 render(<App/>);fireEvent.click(screen.getByText('open hotels'));
 return {queries,dialog:()=>screen.getByRole('dialog',{name:'هتل‌های پایان'})};
}

describe('arrival map and square hotel collection',()=>{
 it('loads one arrival-local night automatically with no configuration and the actual hub on the map',async()=>{
  const {queries,dialog}=setup();await waitFor(()=>expect(dialog().querySelectorAll('[data-hotel-id]')).toHaveLength(2));
  expect(queries).toHaveLength(1);expect(queries[0]).toMatchObject({checkIn:'2026-10-26',checkOut:'2026-10-27',rooms:1,arrivalPlaceId:'MHD'});
  expect(dialog().querySelectorAll('form,input:not([type=radio]),select')).toHaveLength(0);expect(within(dialog()).getByText('۱ شب · ۱ اتاق')).toBeInTheDocument();
  expect(map.current?.choices.find(choice=>choice.kind==='arrival')).toMatchObject({id:'arrival:MHD',point:{latitude:30,longitude:50},code:'MHD'});
  expect(within(dialog()).getByRole('radiogroup',{name:'مرتب‌سازی اقامتگاه‌ها'}).querySelectorAll('input[type=radio]')).toHaveLength(4);
 });
 it('binds map and card selection both ways while preserving the clicked control focus',async()=>{
  const {dialog}=setup();await waitFor(()=>expect(dialog().querySelectorAll('[data-hotel-id]')).toHaveLength(2));
  const pin=within(dialog()).getByRole('button',{name:'pin hotel-b'});pin.focus();fireEvent.click(pin);
  await waitFor(()=>expect(dialog().querySelector('[data-hotel-id="hotel-b"]')).toHaveAttribute('data-selected','true'));expect(pin).toHaveFocus();
  const card=dialog().querySelector<HTMLButtonElement>('[data-hotel-id="hotel-a"] [data-hotel-card-select]')!;card.focus();fireEvent.click(card);
  await waitFor(()=>expect(map.current?.selectedHotelId).toBe('hotel-a'));expect(card).toHaveFocus();expect(within(dialog()).getByRole('complementary',{name:'هتل انتخاب‌شده'})).toHaveAttribute('data-selected-hotel-id','hotel-a');
 });
 it('keeps all four orders and applies a chosen map reference directly without a setup/confirm screen',async()=>{
  const {queries,dialog}=setup();await waitFor(()=>expect(dialog().querySelectorAll('[data-hotel-id]')).toHaveLength(2));
  const sort=within(dialog()).getByRole('radiogroup',{name:'مرتب‌سازی اقامتگاه‌ها'});
  fireEvent.click(within(sort).getByRole('radio',{name:'نزدیک به نقطه دلخواه'}));await waitFor(()=>expect(map.current?.pickingPoint).toBe(true));expect(queries).toHaveLength(1);
  fireEvent.click(within(dialog()).getByText('pick point'));await waitFor(()=>expect(queries).toHaveLength(2));
  expect(queries[1]).toMatchObject({sort:'location-distance',customPoint:{latitude:30.2,longitude:50.3},checkIn:'2026-10-26',checkOut:'2026-10-27'});await waitFor(()=>expect(map.current?.pickingPoint).toBe(false));
  fireEvent.click(within(dialog()).getByRole('button',{name:'تغییر نقطه مرجع'}));await waitFor(()=>expect(map.current?.pickingPoint).toBe(true));fireEvent.click(within(dialog()).getByRole('button',{name:'انصراف'}));await waitFor(()=>expect(map.current?.pickingPoint).toBe(false));expect(queries).toHaveLength(2);
 });
 it('never presents an incomplete subtotal as a live quote when its named pin is inspected',async()=>{
  const {dialog}=setup(snapshot=>({...snapshot,quotes:snapshot.quotes.filter(quote=>quote.hotelId==='hotel-a'),results:snapshot.results!.map(result=>result.hotelId==='hotel-b'?{...result,status:'incomplete',representativeQuoteId:null,quoteIds:[],reasons:['local-mandatory-fee'],knownSubtotal:{amountRial:5000000,currency:'IRR'}}:result)}));
  await waitFor(()=>expect(dialog().querySelectorAll('[data-hotel-id]')).toHaveLength(2));fireEvent.click(within(dialog()).getByRole('button',{name:'pin hotel-b'}));
  await waitFor(()=>expect(map.current?.selectedHotelId).toBe('hotel-b'));const selection=within(dialog()).getByRole('complementary',{name:'هتل انتخاب‌شده'});expect(selection).not.toHaveAttribute('data-selected-hotel-quote');expect(within(selection).queryByRole('group',{name:/تومان/})).toBeNull();
 });
 it('keeps failed retrieval distinct from no matching stay and provides an explicit retry',async()=>{
  const {queries,dialog}=setup(snapshot=>({...snapshot,status:'failed',quotes:[],results:[]}));
  await waitFor(()=>expect(within(dialog()).getByText('دریافت هتل‌ها کامل نشد')).toBeInTheDocument());
  expect(within(dialog()).queryByText('برای این شب اقامتگاهی با شرایط کامل پیدا نشد')).toBeNull();expect(queries).toHaveLength(1);
  fireEvent.click(within(dialog()).getByRole('button',{name:'تلاش دوباره'}));await waitFor(()=>expect(queries).toHaveLength(2));
 });
 it('shows unknown arrival without an invented query, configuration or permanent busy state',async()=>{
  const {queries,dialog}=setup(undefined,{...arrivingTrip(),itinerary:undefined,available:false});
  await waitFor(()=>expect(within(dialog()).getByText('محل رسیدن این بلیت هنوز مشخص نیست.')).toBeInTheDocument());
  expect(queries).toHaveLength(0);expect(within(dialog()).getByRole('region',{name:'نتایج مقایسه اقامتگاه‌ها'})).toHaveAttribute('aria-busy','false');
  expect(dialog().querySelectorAll('form,input:not([type=radio]),select')).toHaveLength(0);
 });

 it('uses Escape first for open room details and then for the enclosing hotel dialog',async()=>{
  const {dialog}=setup();await waitFor(()=>expect(dialog().querySelectorAll('[data-hotel-id]')).toHaveLength(2));
  fireEvent.click(dialog().querySelector('[data-hotel-card-select]')!);const summary=dialog().querySelector<HTMLElement>('aside details summary')!;summary.focus();fireEvent.click(summary);
  expect(summary.closest('details')?.open).toBe(true);fireEvent.keyDown(summary,{key:'Escape',code:'Escape'});expect(summary.closest('details')?.open).toBe(false);expect(dialog()).toBeInTheDocument();
  fireEvent.keyDown(summary,{key:'Escape',code:'Escape'});await waitFor(()=>expect(screen.queryByRole('dialog',{name:'هتل‌های پایان'})).toBeNull());
 });

});
