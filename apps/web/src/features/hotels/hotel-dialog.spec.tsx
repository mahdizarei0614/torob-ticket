import {act,fireEvent,render,screen,waitFor,within,cleanup} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {HotelSearchQuery,HotelSearchSnapshot} from '@torob-ticket/contracts';
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
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();map.current=undefined;if(scrollDescriptor)Object.defineProperty(HTMLElement.prototype,'scrollTo',scrollDescriptor);else Reflect.deleteProperty(HTMLElement.prototype,'scrollTo');});
function setup(transform=(snapshot:ReturnType<typeof arrivalSnapshot>)=>snapshot,trip=arrivingTrip('2026-10-25T22:00:00Z')){
 const queries:HotelSearchQuery[]=[];
 const client={startHotelSearch:vi.fn(async(query:HotelSearchQuery)=>{queries.push(query);return transform(arrivalSnapshot(query));})} as unknown as ApiClient;
 function App(){const model=useHotelDiscovery({trip,catalog:arrivalCatalog,session,client});return <><button onClick={()=>model.openDialog()}>open hotels</button><HotelDialog model={model} catalog={arrivalCatalog} session={session} canApplyTrip/></>;}
 render(<App/>);fireEvent.click(screen.getByText('open hotels'));
 return {queries,dialog:()=>screen.getByRole('dialog',{name:'هتل‌های پایان'})};
}

describe('arrival map and square hotel collection',()=>{
 it('loads one arrival-local night automatically and retains the actual hub without a duplicate arrival/date summary',async()=>{
  const {queries,dialog}=setup();await waitFor(()=>expect(dialog().querySelectorAll('[data-hotel-id]')).toHaveLength(2));
  expect(queries).toHaveLength(1);expect(queries[0]).toMatchObject({checkIn:'2026-10-26',checkOut:'2026-10-27',rooms:1,arrivalPlaceId:'MHD'});
  expect(dialog().querySelectorAll('form,input:not([type=radio])')).toHaveLength(0);expect(dialog().querySelector('[data-arrival-stay-summary]')).toBeNull();expect(within(dialog()).getByRole('combobox',{name:'ظرفیت اتاق'})).toHaveValue('1');
  expect(map.current?.choices.find(choice=>choice.kind==='arrival')).toMatchObject({id:'arrival:MHD',point:{latitude:30,longitude:50},code:'MHD'});
  expect(within(dialog()).getByRole('radiogroup',{name:'مرتب‌سازی اقامتگاه‌ها'}).querySelectorAll('input[type=radio]')).toHaveLength(4);
  expect(within(dialog()).getAllByRole('group',{name:/قیمت هر شب:/})).toHaveLength(2);
 });
 it('keeps the map separate from card scrolling and preserves its identity when capacity or ordering changes',async()=>{
  const trip=arrivingTrip('2026-10-25T22:00:00Z'),intent=JSON.stringify(trip.query),{queries,dialog}=setup(undefined,trip);await waitFor(()=>expect(dialog().querySelectorAll('[data-hotel-id]')).toHaveLength(2));
  const mapElement=within(dialog()).getByRole('region',{name:'map'}),identity=map.current?.identity,mapPane=dialog().querySelector('[data-hotel-map-pane]')!,cardsPane=dialog().querySelector('[data-hotel-cards-pane]')!,cardScroll=dialog().querySelector('[data-hotel-scroll]')!;
  expect(mapPane.parentElement).toBe(cardsPane.parentElement);expect(mapPane.contains(mapElement)).toBe(true);expect(cardsPane.contains(cardScroll)).toBe(true);expect(cardScroll.contains(mapElement)).toBe(false);
  fireEvent.click(within(dialog()).getByRole('button',{name:'pin hotel-b'}));const capacity=within(dialog()).getByRole('combobox',{name:'ظرفیت اتاق'});expect(within(capacity).getAllByRole('option').map(option=>(option as HTMLOptionElement).value)).toEqual(['1','2','3','4']);expect(within(capacity).getAllByRole('option').map(option=>option.textContent)).toEqual(['اتاق ۱ نفره','اتاق ۲ نفره','اتاق ۳ نفره','اتاق ۴ نفره']);
  fireEvent.change(capacity,{target:{value:'2'}});await waitFor(()=>expect(queries).toHaveLength(2));expect(queries[1]).toMatchObject({party:{adults:2,children:0,infants:0},rooms:1,checkIn:'2026-10-26',checkOut:'2026-10-27'});
  await waitFor(()=>expect(dialog().querySelector('[data-hotel-id="hotel-b"]')).toHaveAttribute('data-selected','true'));
  expect(map.current?.identity).toBe(identity);expect(within(dialog()).getByRole('region',{name:'map'})).toBe(mapElement);expect(map.current?.selectedHotelId).toBe('hotel-b');
  fireEvent.click(within(dialog()).getByRole('radio',{name:'ستاره بیشتر'}));await waitFor(()=>expect(queries).toHaveLength(3));expect(queries[2]).toMatchObject({sort:'stars',party:{adults:2}});expect(within(dialog()).getByRole('region',{name:'map'})).toBe(mapElement);expect(JSON.stringify(trip.query)).toBe(intent);
 });
 it('keeps capacity editable while loading and replaces an older occupancy request before adopting cards',async()=>{
  const requests:{query:HotelSearchQuery;signal?:AbortSignal;resolve:(snapshot:HotelSearchSnapshot)=>void}[]=[],trip=arrivingTrip();
  const client={startHotelSearch:vi.fn((query:HotelSearchQuery,signal?:AbortSignal)=>new Promise<HotelSearchSnapshot>(resolve=>requests.push({query,signal,resolve})))} as unknown as ApiClient;
  function App(){const model=useHotelDiscovery({trip,catalog:arrivalCatalog,session,client});return <><button onClick={()=>model.openDialog()}>open hotels</button><HotelDialog model={model} catalog={arrivalCatalog} session={session} canApplyTrip/></>;}
  render(<App/>);fireEvent.click(screen.getByText('open hotels'));await waitFor(()=>expect(requests).toHaveLength(1));
  const capacity=screen.getByRole('combobox',{name:'ظرفیت اتاق'});expect(capacity).toBeEnabled();fireEvent.change(capacity,{target:{value:'2'}});expect(requests).toHaveLength(2);expect(requests[0]!.signal?.aborted).toBe(true);expect(capacity).toBeEnabled();
  fireEvent.change(capacity,{target:{value:'3'}});expect(requests).toHaveLength(3);expect(requests[1]!.signal?.aborted).toBe(true);
  await act(async()=>requests[1]!.resolve(arrivalSnapshot(requests[1]!.query)));expect(screen.getByRole('region',{name:'نتایج مقایسه اقامتگاه‌ها'})).toHaveAttribute('aria-busy','true');
  await act(async()=>requests[2]!.resolve(arrivalSnapshot(requests[2]!.query)));await waitFor(()=>expect(screen.getByRole('list',{name:'هتل‌ها و قیمت اقامت'})).toBeInTheDocument());expect(capacity).toHaveValue('3');expect(requests[2]!.query.party.adults).toBe(3);
 });
 it('shows the bottom fade only when more content remains, including when short landscape uses the outer scroll host',async()=>{
  const {dialog}=setup();await waitFor(()=>expect(dialog().querySelectorAll('[data-hotel-id]')).toHaveLength(2));
  const panel=dialog().querySelector<HTMLDivElement>('[data-hotel-scroll]')!,layout=dialog().querySelector<HTMLDivElement>('[data-hotel-layout]')!,cue=dialog().querySelector('[data-hotel-overflow-cue]')!;let height=700;
  Object.defineProperties(panel,{clientHeight:{configurable:true,value:300},scrollHeight:{configurable:true,get:()=>height}});expect(cue).toHaveAttribute('data-visible','false');fireEvent.resize(window);expect(cue).toHaveAttribute('data-visible','true');
  panel.scrollTop=400;fireEvent.scroll(panel);expect(cue).toHaveAttribute('data-visible','false');panel.scrollTop=0;height=280;fireEvent.resize(window);expect(cue).toHaveAttribute('data-visible','false');
  layout.style.overflowY='auto';Object.defineProperties(layout,{clientHeight:{configurable:true,value:350},scrollHeight:{configurable:true,value:900}});fireEvent.resize(window);expect(cue).toHaveAttribute('data-visible','true');layout.scrollTop=550;fireEvent.scroll(layout);expect(cue).toHaveAttribute('data-visible','false');
 });
 it('keeps the shared measured indicator sliding and resizing while a newly chosen order is loading',async()=>{
  vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener(){},removeEventListener(){}}));vi.spyOn(document,'visibilityState','get').mockReturnValue('visible');
  const nativeBox=HTMLElement.prototype.getBoundingClientRect,boxes:Record<string,[number,number]>={cheapest:[420,90],stars:[310,110],'arrival-distance':[140,170],'location-distance':[0,140]};
  vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){
   if(this.hasAttribute('data-segment-track'))return new DOMRect(0,0,510,54);
   const option=this.hasAttribute('data-segment-option')?this:this.matches('[data-segment-slot],[data-segment-slot]>div')?this.querySelector<HTMLElement>('[data-segment-option]'):null,box=option?boxes[option.dataset['segmentOption']!]:undefined;
   return box?new DOMRect(box[0],5,box[1],44):nativeBox.call(this);
  });
  const requests:{query:HotelSearchQuery;resolve:(snapshot:HotelSearchSnapshot)=>void}[]=[],client={startHotelSearch:vi.fn((query:HotelSearchQuery)=>new Promise<HotelSearchSnapshot>(resolve=>requests.push({query,resolve})))} as unknown as ApiClient;
  function App(){const model=useHotelDiscovery({trip:arrivingTrip(),catalog:arrivalCatalog,session,client});return <><button onClick={model.openDialog}>open hotels</button><HotelDialog model={model} catalog={arrivalCatalog} session={session} canApplyTrip/></>;}
  render(<App/>);fireEvent.click(screen.getByText('open hotels'));await waitFor(()=>expect(requests).toHaveLength(1));await act(async()=>requests[0]!.resolve(arrivalSnapshot(requests[0]!.query)));await waitFor(()=>expect(screen.getByRole('list',{name:'هتل‌ها و قیمت اقامت'})).toBeInTheDocument());
  const group=screen.getByRole('radiogroup',{name:'مرتب‌سازی اقامتگاه‌ها'}),indicator=group.querySelector<HTMLElement>('[data-segment-indicator]')!;expect(Number.parseFloat(indicator.style.width)).toBe(90);
  fireEvent.click(screen.getByRole('radio',{name:'ستاره بیشتر'}));expect(requests).toHaveLength(2);expect(screen.getByRole('radio',{name:'ستاره بیشتر'})).toBeEnabled();expect(screen.getByRole('region',{name:'نتایج مقایسه اقامتگاه‌ها'})).toHaveAttribute('aria-busy','true');
  await waitFor(()=>{const width=Number.parseFloat(indicator.style.width);expect(width).toBeGreaterThan(90);expect(width).toBeLessThan(110);},{interval:10});await waitFor(()=>expect(Number.parseFloat(indicator.style.width)).toBe(110));expect(requests[1]!.query.sort).toBe('stars');
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
  expect(dialog().querySelectorAll('form,input:not([type=radio])')).toHaveLength(0);expect(within(dialog()).getByRole('combobox',{name:'ظرفیت اتاق'})).toBeDisabled();
 });

 it('uses Escape first for open room details and then for the enclosing hotel dialog',async()=>{
  const {dialog}=setup();await waitFor(()=>expect(dialog().querySelectorAll('[data-hotel-id]')).toHaveLength(2));
  fireEvent.click(dialog().querySelector('[data-hotel-card-select]')!);const summary=dialog().querySelector<HTMLElement>('aside details summary')!;summary.focus();fireEvent.click(summary);
  expect(summary.closest('details')?.open).toBe(true);fireEvent.keyDown(summary,{key:'Escape',code:'Escape'});expect(summary.closest('details')?.open).toBe(false);expect(dialog()).toBeInTheDocument();
  fireEvent.keyDown(summary,{key:'Escape',code:'Escape'});await waitFor(()=>expect(screen.queryByRole('dialog',{name:'هتل‌های پایان'})).toBeNull());
 });

});

describe('keyboard reference coordinates',()=>{
 it('validates coordinates without writes, commits one exact reference and cancels a replacement draft',async()=>{
  const {queries,dialog}=setup();await waitFor(()=>expect(dialog().querySelectorAll('[data-hotel-id]')).toHaveLength(2));
  fireEvent.click(within(dialog()).getByRole('radio',{name:'نزدیک به نقطه دلخواه'}));
  const details=within(dialog()).getByText('انتخاب با مختصات').closest('details')!;fireEvent.click(within(dialog()).getByText('انتخاب با مختصات'));details.open=true;
  const latitude=within(dialog()).getByRole('spinbutton',{name:'عرض جغرافیایی نقطه مرجع'}),longitude=within(dialog()).getByRole('spinbutton',{name:'طول جغرافیایی نقطه مرجع'}),form=within(dialog()).getByRole('form',{name:'مختصات نقطه مرجع'});
  expect(latitude).toHaveAttribute('dir','ltr');expect(longitude).toHaveAttribute('dir','ltr');
  fireEvent.change(latitude,{target:{value:'91'}});fireEvent.change(longitude,{target:{value:'51.5'}});expect(queries).toHaveLength(1);expect(map.current?.point).toBeUndefined();
  fireEvent.submit(form);expect(latitude).toHaveAttribute('aria-invalid','true');expect(latitude).toHaveFocus();expect(within(dialog()).getByRole('alert')).toHaveTextContent('عرض جغرافیایی');expect(queries).toHaveLength(1);
  fireEvent.change(latitude,{target:{value:'35.5'}});expect(queries).toHaveLength(1);fireEvent.submit(form);await waitFor(()=>expect(queries).toHaveLength(2));
  expect(queries[1]).toMatchObject({sort:'location-distance',customPoint:{latitude:35.5,longitude:51.5},checkIn:queries[0]!.checkIn,checkOut:queries[0]!.checkOut,party:queries[0]!.party,rooms:1});
  await waitFor(()=>expect(map.current?.pickingPoint).toBe(false));expect(within(dialog()).getByRole('radio',{name:'نزدیک به نقطه دلخواه'})).toHaveFocus();
  fireEvent.click(within(dialog()).getByRole('button',{name:'تغییر نقطه مرجع'}));const disclosure=within(dialog()).getByText('انتخاب با مختصات').closest('details')!;disclosure.open=true;
  const edited=within(dialog()).getByRole('spinbutton',{name:'عرض جغرافیایی نقطه مرجع'});expect(edited).toHaveValue(35.5);fireEvent.change(edited,{target:{value:'10'}});fireEvent.keyDown(edited,{key:'Escape'});
  await waitFor(()=>expect(map.current?.pickingPoint).toBe(false));expect(queries).toHaveLength(2);expect(map.current?.point).toEqual({latitude:35.5,longitude:51.5});
  fireEvent.click(within(dialog()).getByRole('button',{name:'تغییر نقطه مرجع'}));const reopened=within(dialog()).getByText('انتخاب با مختصات').closest('details')!;reopened.open=true;expect(within(dialog()).getByRole('spinbutton',{name:'عرض جغرافیایی نقطه مرجع'})).toHaveValue(35.5);
 });
 it('retires the coordinate form and fences its retained point owner when authority is blocked',async()=>{
  const queries:HotelSearchQuery[]=[],trip=arrivingTrip();const client={startHotelSearch:vi.fn(async(query:HotelSearchQuery)=>{queries.push(query);return arrivalSnapshot(query);})} as unknown as ApiClient;
  let current!:ReturnType<typeof useHotelDiscovery>;
  function App({blocked=false}:{blocked?:boolean}){current=useHotelDiscovery({trip,catalog:arrivalCatalog,session,client,blocked});return <><button onClick={current.openDialog}>open hotels</button><HotelDialog model={current} catalog={arrivalCatalog} session={session} canApplyTrip/></>;}
  const view=render(<App/>);fireEvent.click(screen.getByText('open hotels'));await waitFor(()=>expect(queries).toHaveLength(1));await waitFor(()=>expect(current.state.status).toBe('ready'));
  fireEvent.click(screen.getByRole('radio',{name:'نزدیک به نقطه دلخواه'}));const details=screen.getByText('انتخاب با مختصات').closest('details')!;details.open=true;
  const retained=current;expect(retained.isPointCurrent()).toBe(true);fireEvent.change(screen.getByRole('spinbutton',{name:'عرض جغرافیایی نقطه مرجع'}),{target:{value:'35.5'}});
  view.rerender(<App blocked/>);await waitFor(()=>expect(screen.queryByRole('form',{name:'مختصات نقطه مرجع'})).not.toBeInTheDocument());expect(retained.isPointCurrent()).toBe(false);
  await act(async()=>retained.chooseLocation({latitude:35.5,longitude:51.5}));expect(queries).toHaveLength(1);expect(current.state.draft.customPoint).toBeUndefined();expect(current.state.draft.sort).toBe('cheapest');
 });
});
