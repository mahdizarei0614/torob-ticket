import {act,fireEvent,render,screen} from '@testing-library/react';
import {StrictMode} from 'react';
import {beforeEach,expect,it,vi} from 'vitest';
import {createFreeMap,type FreeMapController,type FreeMapInput,type FreeMapSdk,type MapPort} from './free-map-adapter';
import {FreeLocationMap,type FreeLocationMapProps} from './free-location-map';
import {loadFreeMapSdk} from './free-map-sdk';

const harness=vi.hoisted(()=>({records:[] as {input:FreeMapInput;controller:FreeMapController}[]}));
vi.mock('@torob-ticket/ui',async original=>({...await original<typeof import('@torob-ticket/ui')>(),useTheme:()=>({appearance:'light'}),useMotionPolicy:()=>({enabled:true})}));
vi.mock('./free-map-sdk',()=>({loadFreeMapSdk:vi.fn()}));
vi.mock('./free-map-adapter',async original=>({...await original<typeof import('./free-map-adapter')>(),createFreeMap:vi.fn((_element:HTMLElement,input:FreeMapInput)=>{
 const controller:FreeMapController={ready:Promise.resolve(true),update:vi.fn(),dispose:vi.fn(),getCamera:()=>({center:{latitude:35.6,longitude:51.4},zoom:14})};
 harness.records.push({input,controller});input.onStatus('loading');return controller;
})}));
const props=():FreeLocationMapProps=>({identity:'mashhad:MHD',variant:'discovery',center:{latitude:36.2,longitude:59.6},choices:[{id:'arrival:MHD',name:'فرودگاه مشهد',code:'MHD',kind:'arrival',point:{latitude:36.2,longitude:59.6}},{id:'h',name:'هتل آفتاب',kind:'hotel',point:{latitude:36.25,longitude:59.58}}],isCurrent:()=>true,onPoint:vi.fn(),onSelectHotel:vi.fn(),selectedHotelId:'h'});
beforeEach(()=>{harness.records.length=0;vi.clearAllMocks();});

it('updates selection/sorting in the same provider and publishes only through the latest current callbacks',()=>{
 const first=props(),view=render(<FreeLocationMap {...first}/>),original=harness.records[0]!;
 const onPoint=vi.fn(),onSelectHotel=vi.fn();let current=true;
 view.rerender(<FreeLocationMap {...first} choices={[...first.choices].reverse()} selectedHotelId={undefined} pickingPoint onPoint={onPoint} onSelectHotel={onSelectHotel} isCurrent={()=>current}/>);
 expect(harness.records).toHaveLength(1);expect(original.controller.dispose).not.toHaveBeenCalled();
 expect(original.controller.update).toHaveBeenLastCalledWith(expect.objectContaining({selectedHotelId:undefined,pickingPoint:true,choices:[...first.choices].reverse()}));
 original.input.onSelectHotel?.('h');original.input.onPoint({latitude:36.3,longitude:59.5});
 expect(onSelectHotel).toHaveBeenCalledExactlyOnceWith('h');expect(onPoint).toHaveBeenCalledExactlyOnceWith({latitude:36.3,longitude:59.5});expect(first.onSelectHotel).not.toHaveBeenCalled();expect(first.onPoint).not.toHaveBeenCalled();
 current=false;original.input.onSelectHotel?.('h');original.input.onPoint({latitude:0,longitude:0});expect(onSelectHotel).toHaveBeenCalledTimes(1);expect(onPoint).toHaveBeenCalledTimes(1);
});

it('changes arrival ownership without importing the prior camera and rejects callbacks from the disposed owner',()=>{
 const first=props(),view=render(<FreeLocationMap {...first}/>),old=harness.records[0]!;
 view.rerender(<FreeLocationMap {...first} identity="tehran:IKA" center={{latitude:35.4,longitude:51.2}}/>);
 expect(old.controller.dispose).toHaveBeenCalledTimes(1);expect(harness.records).toHaveLength(2);expect(harness.records[1]!.input.camera).toBeUndefined();
 old.input.onSelectHotel?.('h');old.input.onPoint({latitude:1,longitude:2});old.input.onStatus('unavailable');
 expect(first.onSelectHotel).not.toHaveBeenCalled();expect(first.onPoint).not.toHaveBeenCalled();expect(screen.queryByText('نقشه شهری در دسترس نیست.')).not.toBeInTheDocument();
 view.unmount();expect(harness.records[1]!.controller.dispose).toHaveBeenCalledTimes(1);
});

it('retains a retry camera and keeps honest local reference choices usable when the street map fails',()=>{
 const first=props(),view=render(<FreeLocationMap {...first}/>),old=harness.records[0]!;
 act(()=>old.input.onStatus('unavailable'));
 expect(screen.getByText('نقشه شهری در دسترس نیست.')).toBeVisible();expect(screen.getByText('قیمت اقامتگاه‌ها در کارت‌ها در دسترس است.')).toBeVisible();
 expect(screen.queryByRole('button',{name:'هتل آفتاب'})).not.toBeInTheDocument();
 view.rerender(<FreeLocationMap {...first} pickingPoint/>);
 fireEvent.click(screen.getByRole('button',{name:'هتل آفتاب'}));expect(first.onPoint).toHaveBeenCalledExactlyOnceWith({latitude:36.25,longitude:59.58});
 fireEvent.click(screen.getByRole('button',{name:'تلاش دوباره برای نقشه شهری'}));expect(old.controller.dispose).toHaveBeenCalledTimes(1);expect(harness.records).toHaveLength(2);
 expect(harness.records[1]!.input.camera).toEqual({center:{latitude:35.6,longitude:51.4},zoom:14});
});

it('cleans the first StrictMode owner before the replacement and rejects late callbacks after unmount',()=>{
 const input=props(),view=render(<StrictMode><FreeLocationMap {...input}/></StrictMode>);
 expect(harness.records).toHaveLength(2);expect(harness.records[0]!.controller.dispose).toHaveBeenCalledTimes(1);expect(harness.records[1]!.controller.dispose).not.toHaveBeenCalled();
 harness.records[0]!.input.onSelectHotel?.('h');expect(input.onSelectHotel).not.toHaveBeenCalled();
 harness.records[1]!.input.onSelectHotel?.('h');expect(input.onSelectHotel).toHaveBeenCalledTimes(1);view.unmount();
 harness.records[1]!.input.onSelectHotel?.('h');harness.records[1]!.input.onPoint({latitude:1,longitude:2});expect(input.onSelectHotel).toHaveBeenCalledTimes(1);expect(input.onPoint).not.toHaveBeenCalled();expect(harness.records[1]!.controller.dispose).toHaveBeenCalledTimes(1);
});

it('reacquires an SDK that resolved while a closed dialog retained the same map component for its exit',async()=>{
 const actual=await vi.importActual<typeof import('./free-map-adapter')>('./free-map-adapter');
 vi.mocked(createFreeMap).mockImplementationOnce(actual.createFreeMap).mockImplementationOnce(actual.createFreeMap);
 let resolve!:(sdk:FreeMapSdk)=>void;const pending=new Promise<FreeMapSdk>(done=>{resolve=done;}),events=new Map<string,(event:unknown)=>void>();
 const map:MapPort={on:(name,fn)=>events.set(name,fn),off:(name)=>events.delete(name),remove:vi.fn(),resize:vi.fn(),setStyle:vi.fn(),isStyleLoaded:()=>true,queryRenderedFeatures:()=>[{source:'openmaptiles'}],getCenter:()=>({lat:36.2,lng:59.6}),getZoom:()=>12,jumpTo:vi.fn()};
 const sdk:FreeMapSdk={createMap:vi.fn(()=>map),createMarker:vi.fn(()=>{const marker={setLngLat:()=>marker,addTo:()=>marker,remove:vi.fn(),getLngLat:()=>({lat:36.2,lng:59.6}),on:vi.fn(),off:vi.fn()};return marker;})};
 vi.mocked(loadFreeMapSdk).mockReturnValue(pending);
 let open=true;const options={...props(),isCurrent:()=>open};const view=render(<FreeLocationMap {...options} active/>);
 open=false;view.rerender(<FreeLocationMap {...options} active={false}/>);
 await act(async()=>{resolve(sdk);await pending;});expect(sdk.createMap).not.toHaveBeenCalled();
 open=true;await act(async()=>view.rerender(<FreeLocationMap {...options} active/>));
 expect(sdk.createMap).toHaveBeenCalledTimes(1);act(()=>{events.get('style.load')?.({});events.get('load')?.({});});
 expect(screen.getByRole('region',{name:'نقشه اقامتگاه‌ها و نقطه رسیدن'})).toHaveAttribute('data-free-map-status','ready');
 view.unmount();expect(map.remove).toHaveBeenCalledTimes(1);
});
